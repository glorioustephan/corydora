import { countTasksByStatus, loadRunState, loadTaskStore } from '../queue/state.js';
import { loadRequiredConfig } from './helpers.js';
import { tmuxSessionExists } from '../runtime/tmux.js';
import type { Ui } from '../ui/output.js';

export async function runStatusCommand(
  projectRoot: string,
  json: boolean,
  ui: Ui
): Promise<void> {
  const config = await loadRequiredConfig(projectRoot);
  const [runState, taskStore] = await Promise.all([
    loadRunState(projectRoot, config),
    loadTaskStore(projectRoot, config),
  ]);

  const payload = {
    runState,
    queue: {
      pending: countTasksByStatus(taskStore, 'pending'),
      claimed: countTasksByStatus(taskStore, 'claimed'),
      done: countTasksByStatus(taskStore, 'done'),
      failed: countTasksByStatus(taskStore, 'failed'),
      blocked: countTasksByStatus(taskStore, 'blocked'),
    },
    tmuxAttached:
      runState?.background?.sessionName ? tmuxSessionExists(runState.background.sessionName) : false,
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
  ui.info(`Pending tasks: ${payload.queue.pending}`);
  ui.info(`Done tasks: ${payload.queue.done}`);
  if (runState.background?.sessionName) {
    ui.info(`tmux session: ${runState.background.sessionName}`);
  }
}
