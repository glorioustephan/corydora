import { countTasksByStatus, loadFileStore, loadRunState, loadTaskStore } from '../queue/state.js';
import { loadRequiredConfig } from './helpers.js';
import { tmuxSessionExists } from '../runtime/tmux.js';
import type { Ui } from '../ui/output.js';

function nextRetryTimes(taskStore: Awaited<ReturnType<typeof loadTaskStore>>): string[] {
  return taskStore.tasks
    .filter((task) => task.nextEligibleAt)
    .sort((left, right) => (left.nextEligibleAt ?? '').localeCompare(right.nextEligibleAt ?? ''))
    .slice(0, 3)
    .map((task) => `${task.id} @ ${task.nextEligibleAt}`);
}

export async function runStatusCommand(projectRoot: string, json: boolean, ui: Ui): Promise<void> {
  const config = await loadRequiredConfig(projectRoot);
  const [runState, taskStore, fileStore] = await Promise.all([
    loadRunState(projectRoot, config),
    loadTaskStore(projectRoot, config),
    loadFileStore(projectRoot, config),
  ]);

  const payload = {
    runState,
    queue: {
      queued: countTasksByStatus(taskStore, 'queued'),
      leased: countTasksByStatus(taskStore, 'leased'),
      applying: countTasksByStatus(taskStore, 'applying'),
      validating: countTasksByStatus(taskStore, 'validating'),
      done: countTasksByStatus(taskStore, 'done'),
      deferred: countTasksByStatus(taskStore, 'deferred'),
      blocked: countTasksByStatus(taskStore, 'blocked'),
      manual: countTasksByStatus(taskStore, 'manual'),
    },
    files: {
      queued: fileStore.files.filter((file) => file.status === 'queued').length,
      leased: fileStore.files.filter((file) => file.status === 'leased').length,
      analyzed: fileStore.files.filter((file) => file.status === 'analyzed').length,
      deferred: fileStore.files.filter((file) => file.status === 'deferred').length,
      manual: fileStore.files.filter((file) => file.status === 'manual').length,
    },
    nextRetry: nextRetryTimes(taskStore),
    tmuxAttached: runState?.background?.sessionName
      ? tmuxSessionExists(runState.background.sessionName)
      : false,
  };

  if (json) {
    ui.printJson(payload);
    return;
  }

  if (!runState) {
    ui.info('No recorded Corydora run yet.');
    return;
  }

  ui.info(`Run: ${runState.runId} (${runState.status})`);
  ui.info(`Phase: ${runState.phase}`);
  ui.info(`Mode: ${runState.mode}`);
  ui.info(`Queued tasks: ${payload.queue.queued}`);
  ui.info(`Deferred tasks: ${payload.queue.deferred}`);
  ui.info(`Done tasks: ${payload.queue.done}`);
  ui.info(`Queued files: ${payload.files.queued}`);
  ui.info(`Effective isolation: ${runState.effectiveIsolationMode}`);
  if (payload.nextRetry.length > 0) {
    ui.info(`Next retries: ${payload.nextRetry.join(', ')}`);
  }
  if (runState.workers.length > 0) {
    ui.info(
      `Workers: ${runState.workers
        .map(
          (worker) => `${worker.id}=${worker.status}${worker.details ? `(${worker.details})` : ''}`,
        )
        .join(', ')}`,
    );
  }
  if (runState.background?.sessionName) {
    ui.info(`tmux session: ${runState.background.sessionName}`);
    ui.info(`Keep awake: ${runState.background.keepAwake ? 'enabled' : 'disabled'}`);
  }
}
