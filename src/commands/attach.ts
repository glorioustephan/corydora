import { loadRunState } from '../queue/state.js';
import { loadRequiredConfig } from './helpers.js';
import { attachToSession, tmuxSessionExists } from '../runtime/tmux.js';

export async function runAttachCommand(projectRoot: string): Promise<void> {
  const config = await loadRequiredConfig(projectRoot);
  const runState = await loadRunState(projectRoot, config);
  const sessionName = runState?.background?.sessionName;
  if (!sessionName) {
    throw new Error('No tmux-backed Corydora session is recorded for this project.');
  }

  if (!tmuxSessionExists(sessionName)) {
    throw new Error(`tmux session "${sessionName}" is not running.`);
  }

  attachToSession(sessionName);
}
