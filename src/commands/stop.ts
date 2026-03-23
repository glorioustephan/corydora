import { loadRequiredConfig } from './helpers.js';
import { loadRunState, saveRunState } from '../queue/state.js';
import { stopSession } from '../runtime/tmux.js';
import type { Ui } from '../ui/output.js';

export async function runStopCommand(projectRoot: string, json: boolean, ui: Ui): Promise<void> {
  const config = await loadRequiredConfig(projectRoot);
  const runState = await loadRunState(projectRoot, config);
  if (!runState) {
    throw new Error('No Corydora run state exists for this project.');
  }

  runState.stopRequested = true;
  runState.updatedAt = new Date().toISOString();
  await saveRunState(projectRoot, config, runState);

  const tmuxStopped = runState.background?.sessionName
    ? stopSession(runState.background.sessionName)
    : false;

  if (json) {
    ui.printJson({ stopRequested: true, tmuxStopped });
    return;
  }

  ui.success('Stop requested for the active Corydora run.');
  if (tmuxStopped) {
    ui.info('tmux session was stopped.');
  }
}
