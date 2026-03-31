import { appendFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { AgentDefinition, RunState, CorydoraConfig, TaskStore } from '../types/domain.js';
import { ensureCorydoraStructure } from '../config/files.js';
import { discoverCandidateFiles } from '../filesystem/discovery.js';
import { detectProjectFingerprint } from '../filesystem/project.js';
import { commitAllChanges } from '../git/repository.js';
import { prepareIsolationContext } from '../git/isolation.js';
import {
  countTasksByStatus,
  loadRunState,
  loadTaskStore,
  mergeScanFindings,
  saveRunArtifact,
  saveRunState,
  saveTaskStore,
  claimNextTask,
  updateTaskStatus,
} from '../queue/state.js';
import { renderTaskQueues } from '../queue/render.js';
import { buildFixPrompt, buildScanPrompt } from './prompts.js';
import { getRuntimeAdapter } from '../providers/index.js';
import { noteFileProcessed, restoreSchedulerState, selectScanBatch } from './scheduler.js';

export interface RunSessionOptions {
  projectRoot: string;
  config: CorydoraConfig;
  agents: AgentDefinition[];
  dryRun: boolean;
  resume: boolean;
  sessionName?: string;
  forceCurrentBranch?: boolean;
  skipCommitHooks?: boolean;
  logToConsole?: boolean;
}

type RunLogger = (message: string) => Promise<void>;

function nowIso(): string {
  return new Date().toISOString();
}

function createRunLogger(logFilePath: string, emitToConsole: boolean): RunLogger {
  return async (message: string): Promise<void> => {
    const line = `[${nowIso()}] ${message}\n`;
    if (emitToConsole) {
      process.stdout.write(line);
    }
    try {
      await appendFile(logFilePath, line, 'utf8');
    } catch {
      // Ignore logging errors to keep runtime execution unchanged.
    }
  };
}

async function readFileIfExists(path: string): Promise<string> {
  if (!existsSync(path)) {
    return '';
  }

  return readFile(path, 'utf8');
}

async function saveAllState(
  projectRoot: string,
  config: CorydoraConfig,
  store: TaskStore,
  state: RunState,
): Promise<void> {
  await saveTaskStore(projectRoot, config, store);
  await renderTaskQueues(projectRoot, config, store);
  await saveRunState(projectRoot, config, state);
  await saveRunArtifact(projectRoot, config, state);
}

async function processScans(options: {
  files: string[];
  projectRoot: string;
  workRoot: string;
  config: CorydoraConfig;
  agents: AgentDefinition[];
  state: RunState;
  store: TaskStore;
  logger: RunLogger;
}): Promise<{ state: RunState; store: TaskStore }> {
  const adapter = getRuntimeAdapter(options.config.runtime.provider);
  const fingerprint = detectProjectFingerprint(options.workRoot);

  let nextState = options.state;
  let nextStore = options.store;

  await options.logger(`Scanning ${options.files.length} files.`);

  const concurrency = Math.max(1, options.config.scan.maxConcurrentScans);
  for (let index = 0; index < options.files.length; index += concurrency) {
    const slice = options.files.slice(index, index + concurrency);
    const results = await Promise.all(
      slice.map(async (file) => {
        await options.logger(`Starting scan: ${file}`);
        const fileContent = await readFile(resolve(options.workRoot, file), 'utf8');
        const prompt = buildScanPrompt({
          filePath: file,
          fileContent,
          fingerprint,
          agents: options.agents.filter((agent) =>
            agent.categories.some((category) =>
              options.config.agents.enabledCategories.includes(category),
            ),
          ),
        });

        try {
          const result = await adapter.executeScan({
            rootDir: options.projectRoot,
            workingDirectory: options.workRoot,
            model: options.config.runtime.model,
            prompt,
            dryRun: false,
            settings: {
              maxOutputTokens: options.config.runtime.maxOutputTokens,
              requestTimeoutMs: options.config.runtime.requestTimeoutMs,
              maxRetries: options.config.runtime.maxRetries,
            },
          });
          return { file, result, success: true as const };
        } catch (error) {
          return {
            file,
            result: error instanceof Error ? error.message : String(error),
            success: false as const,
          };
        }
      }),
    );

    for (const item of results) {
      if (item.success) {
        const merged = mergeScanFindings(nextStore, item.result.tasks);
        nextStore = merged.store;
        await options.logger(
          `Scan complete: ${item.file} (${item.result.tasks.length} raw, ${merged.added.length} new tasks).`,
        );
        nextState = {
          ...nextState,
          scheduler: noteFileProcessed(nextState.scheduler, item.file, true),
          updatedAt: nowIso(),
          selectedFiles: [...new Set([...nextState.selectedFiles, item.file])],
        };
      } else {
        await options.logger(`Scan failed: ${item.file} -> ${item.result}`);
        nextState = {
          ...nextState,
          scheduler: noteFileProcessed(nextState.scheduler, item.file, false),
          updatedAt: nowIso(),
          consecutiveFailures: nextState.consecutiveFailures + 1,
        };
      }
    }
  }

  return {
    state: nextState,
    store: nextStore,
  };
}

async function processSingleFix(options: {
  projectRoot: string;
  workRoot: string;
  config: CorydoraConfig;
  state: RunState;
  store: TaskStore;
  logger: RunLogger;
  skipCommitHooks?: boolean;
}): Promise<{ state: RunState; store: TaskStore; fixedTaskId?: string }> {
  const adapter = getRuntimeAdapter(options.config.runtime.provider);
  const claimedTask = claimNextTask(
    options.store,
    options.state.runId,
    options.config.scan.allowBroadRisk,
  );
  if (!claimedTask) {
    return { state: options.state, store: options.store };
  }

  let nextStore = updateTaskStatus(options.store, claimedTask.id, 'claimed');
  let nextState = {
    ...options.state,
    claimedTaskIds: [...new Set([...options.state.claimedTaskIds, claimedTask.id])],
    phase: 'fix' as const,
    updatedAt: nowIso(),
  };
  await options.logger(`Fix started: ${claimedTask.id} ${claimedTask.title}`);

  await saveAllState(options.projectRoot, options.config, nextStore, nextState);

  const fileContent = await readFileIfExists(resolve(options.workRoot, claimedTask.file));
  const prompt = buildFixPrompt({
    adapter,
    task: claimedTask,
    fileContent,
    validateAfterFix: options.config.execution.validateAfterFix,
  });

  try {
    const result = await adapter.executeFix({
      rootDir: options.projectRoot,
      workingDirectory: options.workRoot,
      model: options.config.runtime.model,
      prompt,
      dryRun: false,
      settings: {
        maxOutputTokens: options.config.runtime.maxOutputTokens,
        requestTimeoutMs: options.config.runtime.requestTimeoutMs,
        maxRetries: options.config.runtime.maxRetries,
      },
    });

    const committed =
      adapter.executionMode === 'fake'
        ? false
        : commitAllChanges(
            options.workRoot,
            `corydora: ${claimedTask.category}: ${claimedTask.title.slice(0, 60)}`,
            options.skipCommitHooks ? { skipHooks: true } : {},
          );

    nextStore = updateTaskStatus(
      nextStore,
      claimedTask.id,
      committed || result.changedFiles.length > 0 ? 'done' : 'blocked',
      committed || result.changedFiles.length > 0 ? undefined : 'No changes were produced.',
    );
    nextState = {
      ...nextState,
      completedFixCount: nextState.completedFixCount + 1,
      completedTaskIds: [...new Set([...nextState.completedTaskIds, claimedTask.id])],
      consecutiveFailures: 0,
      updatedAt: nowIso(),
    };
    return {
      state: nextState,
      store: nextStore,
      fixedTaskId: claimedTask.id,
    };
  } catch (error) {
    await options.logger(
      `Fix failed: ${claimedTask.id} ${error instanceof Error ? error.message : String(error)}`,
    );
    nextStore = updateTaskStatus(
      nextStore,
      claimedTask.id,
      'failed',
      error instanceof Error ? error.message : String(error),
    );
    nextState = {
      ...nextState,
      consecutiveFailures: nextState.consecutiveFailures + 1,
      updatedAt: nowIso(),
    };
    return {
      state: nextState,
      store: nextStore,
      fixedTaskId: claimedTask.id,
    };
  }
}

async function shouldStop(projectRoot: string, config: CorydoraConfig): Promise<boolean> {
  const state = await loadRunState(projectRoot, config);
  return state?.stopRequested ?? false;
}

export async function runCorydoraSession(options: RunSessionOptions): Promise<RunState> {
  await ensureCorydoraStructure(options.projectRoot, options.config);

  const existingRun = options.resume
    ? await loadRunState(options.projectRoot, options.config)
    : null;
  const runId = existingRun?.runId ?? randomUUID().slice(0, 8);
  const logger = createRunLogger(
    resolve(options.projectRoot, options.config.paths.logsDir, `${runId}.log`),
    options.logToConsole ?? true,
  );
  const isolation = prepareIsolationContext({
    projectRoot: options.projectRoot,
    config: options.config,
    runId,
    dryRun: options.dryRun,
  });

  const files = discoverCandidateFiles(isolation.workRoot, {
    includeExtensions: options.config.scan.includeExtensions,
    excludeDirectories: options.config.scan.excludeDirectories,
  });

  let store = await loadTaskStore(options.projectRoot, options.config);
  let state: RunState = existingRun ?? {
    runId,
    status: 'running',
    phase: 'scan',
    repositoryRoot: options.projectRoot,
    workRoot: isolation.workRoot,
    provider: options.config.runtime.provider,
    model: options.config.runtime.model,
    isolationMode: options.config.git.isolationMode,
    startedAt: nowIso(),
    updatedAt: nowIso(),
    stopRequested: false,
    selectedFiles: [],
    claimedTaskIds: [],
    completedTaskIds: [],
    consecutiveFailures: 0,
    completedFixCount: 0,
    scheduler: restoreSchedulerState(undefined, files),
    ...(isolation.branchName ? { branchName: isolation.branchName } : {}),
    ...(isolation.baseBranch ? { baseBranch: isolation.baseBranch } : {}),
    ...(isolation.worktreePath ? { worktreePath: isolation.worktreePath } : {}),
    ...(options.sessionName
      ? {
          background: {
            sessionName: options.sessionName,
            launchCommand: '',
            launchedAt: nowIso(),
            keepAwake: process.env.CORYDORA_BACKGROUND_KEEP_AWAKE === '1',
          },
        }
      : {}),
  };

  state = {
    ...state,
    status: 'running',
    phase: 'scan',
    workRoot: isolation.workRoot,
    scheduler: restoreSchedulerState(state.scheduler, files),
    updatedAt: nowIso(),
  };

  await saveAllState(options.projectRoot, options.config, store, state);
  await logger(
    `Run ${runId} prepared (isolation=${isolation.mode}, branch=${
      isolation.branchName ?? 'current-branch'
    }).`,
  );

  const deadline = Date.now() + options.config.execution.maxRuntimeMinutes * 60_000;

  try {
    while (Date.now() < deadline) {
      if (await shouldStop(options.projectRoot, options.config)) {
        state = {
          ...state,
          status: 'stopped',
          phase: 'idle',
          finishedAt: nowIso(),
          updatedAt: nowIso(),
        };
        await logger('Stop requested. Finishing with stopped status.');
        break;
      }

      const latestFiles = discoverCandidateFiles(isolation.workRoot, {
        includeExtensions: options.config.scan.includeExtensions,
        excludeDirectories: options.config.scan.excludeDirectories,
      });
      state = {
        ...state,
        scheduler: restoreSchedulerState(state.scheduler, latestFiles),
        updatedAt: nowIso(),
      };

      const scanBatch = selectScanBatch(
        state.scheduler,
        latestFiles,
        options.config.scan.batchSize,
      );
      if (scanBatch.length > 0) {
        await logger(`Scan batch selected (${scanBatch.length}): ${scanBatch.join(', ')}`);
        const processed = await processScans({
          files: scanBatch,
          projectRoot: options.projectRoot,
          workRoot: isolation.workRoot,
          config: options.config,
          agents: options.agents,
          state,
          store,
          logger,
        });
        state = {
          ...processed.state,
          phase: 'scan',
        };
        store = processed.store;
        await saveAllState(options.projectRoot, options.config, store, state);
      }

      const pendingCount = countTasksByStatus(store, 'pending');
      const noRemainingFiles = scanBatch.length === 0;
      const shouldFix =
        pendingCount >= options.config.execution.backlogTarget ||
        (noRemainingFiles && pendingCount > 0);

      if (shouldFix && state.completedFixCount < options.config.execution.maxFixesPerRun) {
        const fixed = await processSingleFix({
          projectRoot: options.projectRoot,
          workRoot: isolation.workRoot,
          config: options.config,
          state,
          store,
          logger,
          ...(options.skipCommitHooks ? { skipCommitHooks: true } : {}),
        });
        state = fixed.state;
        store = fixed.store;
        if (fixed.fixedTaskId) {
          await logger(`Fix attempted for task ${fixed.fixedTaskId}.`);
        }
        await saveAllState(options.projectRoot, options.config, store, state);
      }

      const exhaustedFiles = selectScanBatch(state.scheduler, latestFiles, 1).length === 0;
      const exhaustedTasks = countTasksByStatus(store, 'pending') === 0;
      if (exhaustedFiles && exhaustedTasks) {
        await logger('All scan and task queues are empty. Finishing.');
        break;
      }
    }

    if (state.status === 'running') {
      state = {
        ...state,
        status: 'completed',
        phase: 'idle',
        finishedAt: nowIso(),
        updatedAt: nowIso(),
      };
      await logger('Run completed.');
    }
  } catch (error) {
    state = {
      ...state,
      status: 'failed',
      phase: 'idle',
      finishedAt: nowIso(),
      updatedAt: nowIso(),
    };
    await logger(`Run failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await saveAllState(options.projectRoot, options.config, store, state);
  }

  return state;
}
