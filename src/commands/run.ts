import { basename } from 'node:path';
import { listAgents } from '../agents/catalog.js';
import { loadRequiredConfig } from './helpers.js';
import { loadFileStore, loadTaskStore, reconcileFileStore } from '../queue/state.js';
import { launchBackgroundRun, supportsTmux } from '../runtime/tmux.js';
import { runCorydoraSession } from '../runtime/run-session.js';
import { buildFileQueue, resolveSelectedAgents } from '../runtime/modes.js';
import { detectProjectFingerprint } from '../filesystem/project.js';
import type { CorydoraMode } from '../types/domain.js';
import type { Ui } from '../ui/output.js';

export interface RunCommandOptions {
  projectRoot: string;
  json: boolean;
  dryRun?: boolean;
  background?: boolean;
  foreground?: boolean;
  resume?: boolean;
  sessionName?: string;
  skipCommitHooks?: boolean;
  mode?: CorydoraMode;
  agentIds?: string[];
}

function nextRunnableTaskTitle(
  taskStore: Awaited<ReturnType<typeof loadTaskStore>>,
): string | null {
  const task = taskStore.tasks.find((candidate) =>
    ['queued', 'deferred'].includes(candidate.status),
  );
  return task?.title ?? null;
}

export async function runRunCommand(options: RunCommandOptions, ui: Ui): Promise<void> {
  const config = await loadRequiredConfig(options.projectRoot);
  const mode = options.mode ?? config.modes.default;
  const allAgents = await listAgents(options.projectRoot, config);
  const fingerprint = detectProjectFingerprint(options.projectRoot);
  const selectedAgents = resolveSelectedAgents({
    allAgents,
    config,
    mode,
    projectFingerprint: fingerprint,
    ...(options.agentIds ? { overrideAgentIds: options.agentIds } : {}),
  });
  const selectedAgentIds = selectedAgents.map((agent) => agent.id);

  if (options.dryRun) {
    const [taskStore, existingFileStore] = await Promise.all([
      loadTaskStore(options.projectRoot, config),
      loadFileStore(options.projectRoot, config),
    ]);
    const fileStore = reconcileFileStore(
      existingFileStore,
      buildFileQueue({
        projectRoot: options.projectRoot,
        workRoot: options.projectRoot,
        config,
        mode,
        taskStore,
      }),
    );
    const nextFiles = fileStore.files
      .filter((file) => ['queued', 'deferred'].includes(file.status))
      .sort((left, right) => right.score.total - left.score.total)
      .slice(0, Math.max(1, config.execution.maxAnalyzeWorkers))
      .map((file) => file.path);

    const preview = {
      dryRun: true,
      provider: config.runtime.provider,
      model: config.runtime.model,
      mode,
      selectedAgents: selectedAgentIds,
      nextScanBatch: nextFiles,
      nextAnalysisBatch: nextFiles,
      nextTask: nextRunnableTaskTitle(taskStore),
    };

    if (options.json) {
      ui.printJson(preview);
      return;
    }

    ui.info(`Dry run preview for ${config.runtime.provider} (${config.runtime.model})`);
    ui.info(`Mode: ${mode}`);
    ui.info(`Agents: ${selectedAgentIds.join(', ') || 'none selected'}`);
    ui.info(`Next analysis batch: ${nextFiles.length > 0 ? nextFiles.join(', ') : 'none'}`);
    ui.info(`Next task: ${preview.nextTask ?? 'none queued'}`);
    return;
  }

  const shouldBackground =
    !options.foreground && (Boolean(options.background) || config.execution.backgroundByDefault);

  if (shouldBackground) {
    if (!supportsTmux()) {
      throw new Error('tmux is unavailable. Use --foreground on this platform.');
    }

    const sessionName =
      options.sessionName ??
      `corydora-${basename(options.projectRoot).replace(/[^a-zA-Z0-9_-]+/g, '-')}-${Date.now()
        .toString()
        .slice(-6)}`;
    const args = [
      'run',
      '--foreground',
      '--session-name',
      sessionName,
      '--mode',
      mode,
      ...(selectedAgentIds.length > 0 ? ['--agent', selectedAgentIds.join(',')] : []),
      ...(options.resume ? ['--resume'] : []),
      ...(options.skipCommitHooks ? ['--no-verify'] : []),
    ];
    const backgroundLaunch = launchBackgroundRun(
      sessionName,
      args,
      options.projectRoot,
      config.execution.preventIdleSleep,
    );

    if (options.json) {
      ui.printJson({ background: true, sessionName, keepAwake: backgroundLaunch.keepAwake });
      return;
    }

    ui.success(`Started background run in tmux session "${sessionName}".`);
    if (backgroundLaunch.keepAwake) {
      ui.info('macOS idle sleep prevention is active for this session.');
    }
    return;
  }

  const state = await runCorydoraSession({
    projectRoot: options.projectRoot,
    config,
    agents: selectedAgents,
    dryRun: Boolean(options.dryRun),
    resume: Boolean(options.resume),
    mode,
    selectedAgentIds,
    logToConsole: !options.json,
    skipCommitHooks: Boolean(options.skipCommitHooks),
    ...(options.sessionName ? { sessionName: options.sessionName } : {}),
  });

  if (options.json) {
    ui.printJson(state);
    return;
  }

  ui.success(`Run ${state.runId} finished with status "${state.status}".`);
  ui.info(`Provider: ${state.provider}`);
  ui.info(`Configured isolation: ${state.isolationMode}`);
  ui.info(`Effective isolation: ${state.effectiveIsolationMode}`);
  ui.info(`Mode: ${state.mode}`);
  ui.info(`Agents: ${state.selectedAgentIds.join(', ') || 'none selected'}`);
  if (state.branchName) {
    ui.info(`Branch: ${state.branchName}`);
  }
  if (state.worktreePath) {
    ui.info(`Worktree: ${state.worktreePath}`);
  }
}
