import { appendFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type {
  AgentDefinition,
  CorydoraConfig,
  FileStore,
  RunEvent,
  RunState,
  TaskRecord,
  TaskStore,
  WorkerState,
} from '../types/domain.js';
import { ensureCorydoraStructure, resolveStatePath } from '../config/files.js';
import { detectProjectFingerprint } from '../filesystem/project.js';
import { commitTaskChanges } from '../git/repository.js';
import { prepareIsolationContext } from '../git/isolation.js';
import {
  appendRunEvent,
  countTasksByStatus,
  loadFileStore,
  loadRunState,
  loadTaskStore,
  mergeScanFindings,
  noteFileAnalyzed,
  noteFileRetry,
  noteTaskCompleted,
  noteTaskProgress,
  noteTaskRetry,
  reclaimExpiredFileLeases,
  reclaimExpiredTaskLeases,
  reconcileFileStore,
  saveFileStore,
  saveRunArtifact,
  saveRunState,
  saveTaskStore,
  leaseFilesForAnalysis,
  leaseTasksForFix,
} from '../queue/state.js';
import { renderTaskQueues } from '../queue/render.js';
import { buildFixPrompt, buildScanPrompt } from './prompts.js';
import {
  buildFileQueue,
  canRunSecondFixWorker,
  modePrompt,
  prepareAnalysisMaterial,
} from './modes.js';
import {
  executeStageFix,
  executeStageScan,
  getStageAdapter,
  preflightIsolationMode,
  resolveStageRoute,
} from './routes.js';
import { runValidation } from './validation.js';
import { collectLintFindings } from './tooling.js';

export interface RunSessionOptions {
  projectRoot: string;
  config: CorydoraConfig;
  agents: AgentDefinition[];
  dryRun: boolean;
  resume: boolean;
  mode: CorydoraConfig['modes']['default'];
  selectedAgentIds: string[];
  sessionName?: string;
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

function createWorkers(config: CorydoraConfig): WorkerState[] {
  const analyzeWorkers = Array.from(
    { length: config.execution.maxAnalyzeWorkers },
    (_value, index) => ({
      id: `analyze-${index + 1}`,
      kind: 'analyze' as const,
      status: 'idle' as const,
    }),
  );
  const fixWorkers = Array.from({ length: config.execution.maxFixWorkers }, (_value, index) => ({
    id: `fix-${index + 1}`,
    kind: 'fix' as const,
    status: 'idle' as const,
  }));
  return [...analyzeWorkers, ...fixWorkers];
}

function setWorkerState(
  workers: WorkerState[],
  workerId: string,
  updates: Partial<WorkerState>,
): WorkerState[] {
  return workers.map((worker) =>
    worker.id === workerId
      ? {
          ...worker,
          ...updates,
        }
      : worker,
  );
}

function resetWorkers(workers: WorkerState[]): WorkerState[] {
  return workers.map((worker) => ({
    ...worker,
    status: 'idle',
    targetId: undefined,
    startedAt: undefined,
    details: undefined,
  }));
}

function countRunnableFiles(store: FileStore, now: Date): number {
  return store.files.filter((file) => {
    if (!['queued', 'deferred'].includes(file.status)) {
      return false;
    }

    return !file.nextEligibleAt || new Date(file.nextEligibleAt) <= now;
  }).length;
}

function countRunnableTasks(store: TaskStore, config: CorydoraConfig, now: Date): number {
  return store.tasks.filter((task) => {
    if (!['queued', 'deferred'].includes(task.status)) {
      return false;
    }

    if (!config.scan.allowBroadRisk && task.risk === 'broad') {
      return false;
    }

    return !task.nextEligibleAt || new Date(task.nextEligibleAt) <= now;
  }).length;
}

function listFixCandidates(store: TaskStore, config: CorydoraConfig, now: Date): TaskRecord[] {
  return store.tasks.filter((task) => {
    if (!['queued', 'deferred'].includes(task.status)) {
      return false;
    }

    if (!config.scan.allowBroadRisk && task.risk === 'broad') {
      return false;
    }

    if (task.nextEligibleAt && new Date(task.nextEligibleAt) > now) {
      return false;
    }

    return task.effort === 'small' || task.effort === 'medium';
  });
}

function outstandingAnalyzeTokens(store: FileStore): number {
  return store.files
    .filter((file) => file.status === 'leased')
    .reduce((total, file) => total + file.estimatedTokens, 0);
}

function buildRunSummary(taskStore: TaskStore, fileStore: FileStore): string {
  return [
    `done=${countTasksByStatus(taskStore, 'done')}`,
    `deferred=${countTasksByStatus(taskStore, 'deferred')}`,
    `blocked=${countTasksByStatus(taskStore, 'blocked')}`,
    `manual=${countTasksByStatus(taskStore, 'manual')}`,
    `queued-files=${fileStore.files.filter((file) => file.status === 'queued').length}`,
  ].join(', ');
}

async function saveAllState(
  projectRoot: string,
  config: CorydoraConfig,
  store: TaskStore,
  fileStore: FileStore,
  state: RunState,
): Promise<void> {
  await saveTaskStore(projectRoot, config, store);
  await saveFileStore(projectRoot, config, fileStore);
  await renderTaskQueues(projectRoot, config, store);
  await saveRunState(projectRoot, config, state);
  await saveRunArtifact(projectRoot, config, state);
}

async function emitEvent(
  projectRoot: string,
  config: CorydoraConfig,
  logger: RunLogger,
  event: RunEvent,
): Promise<void> {
  await appendRunEvent(projectRoot, config, event);
  await logger(`${event.type}: ${event.message}`);
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
  const analyzeRoute = resolveStageRoute(options.config, 'analyze');
  const fixRoute = resolveStageRoute(options.config, 'fix');
  const isolationPreflight = preflightIsolationMode({
    projectRoot: options.projectRoot,
    config: options.config,
    fixRoute,
    mode: options.mode,
  });
  const isolation = prepareIsolationContext({
    projectRoot: options.projectRoot,
    config: options.config,
    runId,
    dryRun: options.dryRun,
    isolationMode: isolationPreflight.effectiveIsolationMode,
  });
  const fingerprint = detectProjectFingerprint(isolation.workRoot);
  const filesStatePath = resolveStatePath(options.projectRoot, options.config, 'files.json');

  let taskStore = reclaimExpiredTaskLeases(
    await loadTaskStore(options.projectRoot, options.config),
  );
  let fileStore = reclaimExpiredFileLeases(
    await loadFileStore(options.projectRoot, options.config),
  );
  fileStore = reconcileFileStore(
    fileStore,
    buildFileQueue({
      projectRoot: options.projectRoot,
      workRoot: isolation.workRoot,
      config: options.config,
      mode: options.mode,
      taskStore,
    }),
  );

  let state: RunState = existingRun ?? {
    runId,
    status: 'running',
    phase: 'analyze',
    repositoryRoot: options.projectRoot,
    workRoot: isolation.workRoot,
    provider: options.config.runtime.provider,
    model: options.config.runtime.model,
    isolationMode: options.config.git.isolationMode,
    effectiveIsolationMode: isolationPreflight.effectiveIsolationMode,
    mode: options.mode,
    selectedAgentIds: options.selectedAgentIds,
    startedAt: nowIso(),
    updatedAt: nowIso(),
    stopRequested: false,
    claimedTaskIds: [],
    completedTaskIds: [],
    consecutiveFailures: 0,
    completedFixCount: 0,
    filesPath: filesStatePath,
    workers: createWorkers(options.config),
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
    phase: 'analyze',
    workRoot: isolation.workRoot,
    effectiveIsolationMode: isolationPreflight.effectiveIsolationMode,
    mode: options.mode,
    selectedAgentIds: options.selectedAgentIds,
    filesPath: filesStatePath,
    updatedAt: nowIso(),
    workers: resetWorkers(state.workers.length > 0 ? state.workers : createWorkers(options.config)),
    ...(isolation.branchName ? { branchName: isolation.branchName } : {}),
    ...(isolation.baseBranch ? { baseBranch: isolation.baseBranch } : {}),
    ...(isolation.worktreePath ? { worktreePath: isolation.worktreePath } : {}),
  };

  await saveAllState(options.projectRoot, options.config, taskStore, fileStore, state);
  await emitEvent(options.projectRoot, options.config, logger, {
    runId,
    at: nowIso(),
    type: 'run.prepared',
    stage: 'summary',
    message: `Prepared run with ${fileStore.files.length} file candidates.`,
    metadata: {
      isolationMode: isolation.mode,
      effectiveIsolationMode: isolationPreflight.effectiveIsolationMode,
      mode: options.mode,
    },
  });
  if (isolationPreflight.reason) {
    await emitEvent(options.projectRoot, options.config, logger, {
      runId,
      at: nowIso(),
      type: 'run.preflight',
      stage: 'summary',
      message: isolationPreflight.reason,
    });
  }

  const deadline = Date.now() + options.config.execution.maxRuntimeMinutes * 60_000;
  const leaseTtlMs = options.config.execution.leaseTtlMinutes * 60_000;

  try {
    while (Date.now() < deadline) {
      if (await shouldStop(options.projectRoot, options.config)) {
        state = {
          ...state,
          status: 'stopped',
          phase: 'summary',
          finishedAt: nowIso(),
          updatedAt: nowIso(),
        };
        await emitEvent(options.projectRoot, options.config, logger, {
          runId,
          at: nowIso(),
          type: 'run.stopped',
          stage: 'summary',
          message: 'Stop requested. Finishing with stopped status.',
        });
        break;
      }

      taskStore = reclaimExpiredTaskLeases(taskStore);
      fileStore = reclaimExpiredFileLeases(fileStore);
      fileStore = reconcileFileStore(
        fileStore,
        buildFileQueue({
          projectRoot: options.projectRoot,
          workRoot: isolation.workRoot,
          config: options.config,
          mode: options.mode,
          taskStore,
        }),
      );
      state = {
        ...state,
        workers: resetWorkers(state.workers),
        updatedAt: nowIso(),
      };

      const now = new Date();
      const queuedTasks = countRunnableTasks(taskStore, options.config, now);
      const queuedFiles = countRunnableFiles(fileStore, now);
      const pendingBacklog =
        queuedTasks +
        taskStore.tasks.filter((task) => ['leased', 'applying', 'validating'].includes(task.status))
          .length;
      let analyzeWorkerCount = Math.min(
        options.config.execution.maxAnalyzeWorkers,
        options.config.scan.maxConcurrentScans,
      );
      if (
        pendingBacklog >= options.config.execution.backlogTarget ||
        outstandingAnalyzeTokens(fileStore) >
          analyzeRoute.settings.maxOutputTokens * Math.max(1, analyzeWorkerCount)
      ) {
        analyzeWorkerCount = Math.min(analyzeWorkerCount, 1);
      }
      if (pendingBacklog >= options.config.execution.backlogTarget * 2) {
        analyzeWorkerCount = 0;
      }
      if (state.consecutiveFailures >= 2) {
        analyzeWorkerCount = Math.min(analyzeWorkerCount, 1);
      }

      if (analyzeWorkerCount > 0 && queuedFiles > 0) {
        const leasedFiles = leaseFilesForAnalysis({
          store: fileStore,
          runId,
          maxCount: analyzeWorkerCount,
          leaseTtlMs,
          now,
        });
        fileStore = leasedFiles.store;
        leasedFiles.leased.forEach((file, index) => {
          const worker = state.workers.filter((candidate) => candidate.kind === 'analyze')[index];
          if (worker) {
            state = {
              ...state,
              workers: setWorkerState(state.workers, worker.id, {
                status: 'running',
                targetId: file.id,
                startedAt: nowIso(),
                details: file.path,
              }),
            };
          }
        });
        await saveAllState(options.projectRoot, options.config, taskStore, fileStore, state);

        const analyzeResults = await Promise.all(
          leasedFiles.leased.map(async (file) => {
            try {
              const analysisMaterial =
                file.analysisStrategy === 'tooling'
                  ? null
                  : prepareAnalysisMaterial(isolation.workRoot, file);
              const toolingFindings =
                options.mode === 'linting'
                  ? collectLintFindings(isolation.workRoot, file.path)
                  : null;
              if (toolingFindings && toolingFindings.length > 0) {
                return {
                  kind: 'success' as const,
                  file,
                  provider: 'tooling',
                  findings: toolingFindings,
                  analysisStrategy: 'tooling' as const,
                };
              }

              const aiMaterial =
                analysisMaterial ??
                prepareAnalysisMaterial(isolation.workRoot, {
                  ...file,
                  analysisStrategy:
                    file.estimatedTokens > Math.floor(analyzeRoute.settings.maxOutputTokens * 0.75)
                      ? 'windowed'
                      : 'full',
                });
              const scanPrompt = buildScanPrompt({
                filePath: file.path,
                material: aiMaterial,
                fingerprint,
                agents: options.agents,
                modePrompt: modePrompt(options.mode),
              });
              const scanExecution = await executeStageScan(analyzeRoute, {
                rootDir: options.projectRoot,
                workingDirectory: isolation.workRoot,
                prompt: scanPrompt,
                dryRun: false,
              });
              return {
                kind: 'success' as const,
                file,
                provider: scanExecution.provider,
                findings: scanExecution.result.tasks,
                analysisStrategy: aiMaterial.strategy,
              };
            } catch (error) {
              return {
                kind: 'failure' as const,
                file,
                error: error instanceof Error ? error.message : String(error),
              };
            }
          }),
        );

        for (const result of analyzeResults) {
          if (result.kind === 'success') {
            const merged = mergeScanFindings(taskStore, result.findings, result.file.snapshotHash);
            taskStore = merged.store;
            fileStore = noteFileAnalyzed(fileStore, result.file.id, {
              analysisStrategy: result.analysisStrategy,
            });
            state = {
              ...state,
              phase: 'analyze',
              consecutiveFailures: 0,
              updatedAt: nowIso(),
            };
            await emitEvent(options.projectRoot, options.config, logger, {
              runId,
              at: nowIso(),
              type: 'analysis.completed',
              stage: 'analyze',
              itemId: result.file.id,
              itemPath: result.file.path,
              message: `Analyzed ${result.file.path} with ${result.findings.length} finding(s).`,
              metadata: {
                provider: result.provider,
                findings: result.findings.length,
              },
            });
          } else {
            fileStore = noteFileRetry({
              store: fileStore,
              fileId: result.file.id,
              error: result.error,
              maxAttempts: options.config.execution.maxAttempts,
            });
            state = {
              ...state,
              consecutiveFailures: state.consecutiveFailures + 1,
              updatedAt: nowIso(),
            };
            await emitEvent(options.projectRoot, options.config, logger, {
              runId,
              at: nowIso(),
              type: 'analysis.failed',
              stage: 'analyze',
              itemId: result.file.id,
              itemPath: result.file.path,
              message: result.error,
            });
          }
        }

        await saveAllState(options.projectRoot, options.config, taskStore, fileStore, state);
      }

      const noRunnableFiles = countRunnableFiles(fileStore, new Date()) === 0;
      const shouldFix =
        countRunnableTasks(taskStore, options.config, new Date()) > 0 &&
        (countRunnableTasks(taskStore, options.config, new Date()) >=
          options.config.execution.backlogTarget ||
          noRunnableFiles) &&
        state.completedFixCount < options.config.execution.maxFixesPerRun;

      if (shouldFix) {
        const fixCandidates = listFixCandidates(taskStore, options.config, new Date());
        const requestedFixWorkers =
          options.config.execution.maxFixWorkers > 1 &&
          canRunSecondFixWorker(fixCandidates.slice(0, 2).flatMap((task) => task.targetFiles))
            ? Math.min(options.config.execution.maxFixWorkers, 2)
            : 1;
        const leasedTasks = leaseTasksForFix({
          store: taskStore,
          runId,
          maxCount: requestedFixWorkers,
          leaseTtlMs,
          allowBroadRisk: options.config.scan.allowBroadRisk,
          now: new Date(),
        });
        taskStore = leasedTasks.store;
        state = {
          ...state,
          phase: 'fix',
          claimedTaskIds: [
            ...new Set([...state.claimedTaskIds, ...leasedTasks.leased.map((task) => task.id)]),
          ],
          workers: leasedTasks.leased.reduce((workers, task, index) => {
            const fixWorker = workers.filter((candidate) => candidate.kind === 'fix')[index];
            if (!fixWorker) {
              return workers;
            }

            return setWorkerState(workers, fixWorker.id, {
              status: 'running',
              targetId: task.id,
              startedAt: nowIso(),
              details: task.title,
            });
          }, state.workers),
        };
        await saveAllState(options.projectRoot, options.config, taskStore, fileStore, state);

        for (const task of leasedTasks.leased) {
          taskStore = noteTaskProgress(taskStore, task.id, 'applying');
          await emitEvent(options.projectRoot, options.config, logger, {
            runId,
            at: nowIso(),
            type: 'fix.started',
            stage: 'fix',
            itemId: task.id,
            itemPath: task.file,
            message: `Fix started for ${task.title}.`,
          });
          await saveAllState(options.projectRoot, options.config, taskStore, fileStore, state);

          try {
            const fileContents = await Promise.all(
              task.handoff.targetFiles.map(async (filePath) => ({
                path: filePath,
                content: await readFileIfExists(resolve(isolation.workRoot, filePath)),
              })),
            );
            const fixExecution = await executeStageFix(fixRoute, {
              rootDir: options.projectRoot,
              workingDirectory: isolation.workRoot,
              prompt: buildFixPrompt({
                adapter: getStageAdapter(fixRoute),
                task,
                fileContents,
                modePrompt: modePrompt(options.mode),
              }),
              dryRun: false,
            });
            taskStore = noteTaskProgress(taskStore, task.id, 'validating');
            await saveAllState(options.projectRoot, options.config, taskStore, fileStore, state);

            const adapter = getStageAdapter({
              ...fixRoute,
              provider: fixExecution.provider,
            });
            const validationResult = runValidation(
              isolation.workRoot,
              options.mode,
              options.config.execution.validateAfterFix,
            );
            if (validationResult.status === 'failed') {
              taskStore = noteTaskRetry({
                store: taskStore,
                taskId: task.id,
                error: validationResult.summary,
                maxAttempts: options.config.execution.maxAttempts,
                blocked: true,
                validationResult,
              });
              state = {
                ...state,
                consecutiveFailures: state.consecutiveFailures + 1,
                updatedAt: nowIso(),
              };
              await emitEvent(options.projectRoot, options.config, logger, {
                runId,
                at: nowIso(),
                type: 'fix.validation-failed',
                stage: 'fix',
                itemId: task.id,
                itemPath: task.file,
                message: validationResult.summary,
              });
              continue;
            }

            const changedFiles =
              fixExecution.result.changedFiles.length > 0
                ? fixExecution.result.changedFiles
                : task.handoff.targetFiles;
            const committed =
              adapter.executionMode === 'fake'
                ? changedFiles.length > 0
                : commitTaskChanges(
                    isolation.workRoot,
                    `corydora: ${task.category}: ${task.title.slice(0, 60)}`,
                    changedFiles,
                    options.skipCommitHooks ? { skipHooks: true } : {},
                  );

            if (!committed) {
              taskStore = noteTaskRetry({
                store: taskStore,
                taskId: task.id,
                error: 'No changes were produced.',
                maxAttempts: options.config.execution.maxAttempts,
                blocked: true,
                validationResult,
              });
              state = {
                ...state,
                consecutiveFailures: state.consecutiveFailures + 1,
                updatedAt: nowIso(),
              };
              await emitEvent(options.projectRoot, options.config, logger, {
                runId,
                at: nowIso(),
                type: 'fix.blocked',
                stage: 'fix',
                itemId: task.id,
                itemPath: task.file,
                message: 'No changes were produced.',
              });
              continue;
            }

            taskStore = noteTaskCompleted(taskStore, task.id, validationResult);
            state = {
              ...state,
              completedFixCount: state.completedFixCount + 1,
              completedTaskIds: [...new Set([...state.completedTaskIds, task.id])],
              consecutiveFailures: 0,
              updatedAt: nowIso(),
            };
            await emitEvent(options.projectRoot, options.config, logger, {
              runId,
              at: nowIso(),
              type: 'fix.completed',
              stage: 'fix',
              itemId: task.id,
              itemPath: task.file,
              message: `Completed fix for ${task.title}.`,
              metadata: {
                changedFiles: changedFiles.length,
                validation: validationResult.status,
              },
            });
          } catch (error) {
            taskStore = noteTaskRetry({
              store: taskStore,
              taskId: task.id,
              error: error instanceof Error ? error.message : String(error),
              maxAttempts: options.config.execution.maxAttempts,
            });
            state = {
              ...state,
              consecutiveFailures: state.consecutiveFailures + 1,
              updatedAt: nowIso(),
            };
            await emitEvent(options.projectRoot, options.config, logger, {
              runId,
              at: nowIso(),
              type: 'fix.failed',
              stage: 'fix',
              itemId: task.id,
              itemPath: task.file,
              message: error instanceof Error ? error.message : String(error),
            });
          } finally {
            await saveAllState(options.projectRoot, options.config, taskStore, fileStore, state);
          }
        }
      }

      const remainingRunnableFiles = countRunnableFiles(fileStore, new Date());
      const remainingRunnableTasks = countRunnableTasks(taskStore, options.config, new Date());
      const activeTaskCount = taskStore.tasks.filter((task) =>
        ['leased', 'applying', 'validating'].includes(task.status),
      ).length;
      if (remainingRunnableFiles === 0 && remainingRunnableTasks === 0 && activeTaskCount === 0) {
        await emitEvent(options.projectRoot, options.config, logger, {
          runId,
          at: nowIso(),
          type: 'run.drained',
          stage: 'summary',
          message: 'All file and task queues are drained.',
        });
        break;
      }

      if (remainingRunnableFiles === 0 && remainingRunnableTasks === 0) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
      }
    }

    if (state.status === 'running') {
      state = {
        ...state,
        status: 'completed',
        phase: 'summary',
        finishedAt: nowIso(),
        updatedAt: nowIso(),
        summary: buildRunSummary(taskStore, fileStore),
      };
      await emitEvent(options.projectRoot, options.config, logger, {
        runId,
        at: nowIso(),
        type: 'run.completed',
        stage: 'summary',
        message: state.summary ?? 'Run completed.',
      });
    }
  } catch (error) {
    state = {
      ...state,
      status: 'failed',
      phase: 'summary',
      finishedAt: nowIso(),
      updatedAt: nowIso(),
      summary: buildRunSummary(taskStore, fileStore),
    };
    await emitEvent(options.projectRoot, options.config, logger, {
      runId,
      at: nowIso(),
      type: 'run.failed',
      stage: 'summary',
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await saveAllState(options.projectRoot, options.config, taskStore, fileStore, state);
  }

  return state;
}
