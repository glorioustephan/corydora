import { basename } from 'node:path';
import { listAgents } from '../agents/catalog.js';
import { loadRequiredConfig } from './helpers.js';
import { discoverCandidateFiles } from '../filesystem/discovery.js';
import { loadRunState, loadTaskStore } from '../queue/state.js';
import { launchBackgroundRun, supportsTmux } from '../runtime/tmux.js';
import { runCorydoraSession } from '../runtime/run-session.js';
import { restoreSchedulerState, selectScanBatch } from '../runtime/scheduler.js';
import type { Ui } from '../ui/output.js';

export interface RunCommandOptions {
  projectRoot: string;
  json: boolean;
  dryRun?: boolean;
  background?: boolean;
  foreground?: boolean;
  resume?: boolean;
  sessionName?: string;
}

export async function runRunCommand(options: RunCommandOptions, ui: Ui): Promise<void> {
  const config = await loadRequiredConfig(options.projectRoot);
  if (options.dryRun) {
    const [store, runState] = await Promise.all([
      loadTaskStore(options.projectRoot, config),
      loadRunState(options.projectRoot, config),
    ]);
    const files = discoverCandidateFiles(options.projectRoot, {
      includeExtensions: config.scan.includeExtensions,
      excludeDirectories: config.scan.excludeDirectories,
    });
    const scheduler = restoreSchedulerState(runState?.scheduler, files);
    const nextScanBatch = selectScanBatch(scheduler, files, config.scan.batchSize);
    const nextTask =
      store.tasks.find(task => task.status === 'pending' && (config.scan.allowBroadRisk || task.risk !== 'broad')) ??
      null;

    const preview = {
      dryRun: true,
      provider: config.runtime.provider,
      model: config.runtime.model,
      nextScanBatch,
      nextTask,
    };

    if (options.json) {
      ui.printJson(preview);
      return;
    }

    ui.info(`Dry run preview for ${config.runtime.provider} (${config.runtime.model})`);
    ui.info(`Next scan batch: ${nextScanBatch.length > 0 ? nextScanBatch.join(', ') : 'none'}`);
    ui.info(`Next task: ${nextTask ? nextTask.title : 'none queued'}`);
    return;
  }

  if (options.background && !options.foreground) {
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
      ...(options.resume ? ['--resume'] : []),
      ...(options.dryRun ? ['--dry-run'] : []),
    ];
    launchBackgroundRun(sessionName, args, options.projectRoot);

    if (options.json) {
      ui.printJson({ background: true, sessionName });
      return;
    }

    ui.success(`Started background run in tmux session "${sessionName}".`);
    return;
  }

  const agents = await listAgents(options.projectRoot, config);
  const state = await runCorydoraSession({
    projectRoot: options.projectRoot,
    config,
    agents,
    dryRun: Boolean(options.dryRun),
    resume: Boolean(options.resume),
    ...(options.sessionName ? { sessionName: options.sessionName } : {}),
  });

  if (options.json) {
    ui.printJson(state);
    return;
  }

  ui.success(`Run ${state.runId} finished with status "${state.status}".`);
  ui.info(`Provider: ${state.provider}`);
  ui.info(`Isolation mode: ${state.isolationMode}`);
  if (state.branchName) {
    ui.info(`Branch: ${state.branchName}`);
  }
  if (state.worktreePath) {
    ui.info(`Worktree: ${state.worktreePath}`);
  }
}
