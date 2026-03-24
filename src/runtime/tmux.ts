import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';
import { commandExists } from '../providers/utils.js';

export function supportsTmux(): boolean {
  return platform() !== 'win32' && commandExists('tmux');
}

export function supportsBackgroundKeepAwake(): boolean {
  return platform() === 'darwin' && commandExists('caffeinate');
}

export function tmuxSessionExists(sessionName: string): boolean {
  if (!supportsTmux()) {
    return false;
  }

  return spawnSync('tmux', ['has-session', '-t', sessionName], { stdio: 'ignore' }).status === 0;
}

function buildSelfCommand(args: string[]): string {
  const entry = process.argv[1] ?? '';
  if (entry.endsWith('.ts')) {
    return ['node', '--import', 'tsx', entry, ...args].map(shellEscape).join(' ');
  }

  return [process.execPath, entry, ...args].map(shellEscape).join(' ');
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildBackgroundCommand(
  args: string[],
  preventIdleSleep: boolean,
): {
  command: string;
  keepAwake: boolean;
} {
  const keepAwake = preventIdleSleep && supportsBackgroundKeepAwake();
  const command = buildSelfCommand(args);

  return {
    command: keepAwake ? `CORYDORA_BACKGROUND_KEEP_AWAKE=1 caffeinate -i ${command}` : command,
    keepAwake,
  };
}

export function launchBackgroundRun(
  sessionName: string,
  args: string[],
  cwd: string,
  preventIdleSleep: boolean,
): { keepAwake: boolean } {
  if (!supportsTmux()) {
    throw new Error('tmux is not available on this machine.');
  }

  const launch = buildBackgroundCommand(args, preventIdleSleep);
  const result = spawnSync('tmux', ['new-session', '-d', '-s', sessionName, launch.command], {
    cwd,
    stdio: 'ignore',
  });

  if (result.status !== 0) {
    throw new Error(`Unable to start tmux session "${sessionName}".`);
  }

  return { keepAwake: launch.keepAwake };
}

export function attachToSession(sessionName: string): never {
  const result = spawnSync('tmux', ['attach', '-t', sessionName], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

export function stopSession(sessionName: string): boolean {
  if (!tmuxSessionExists(sessionName)) {
    return false;
  }

  return spawnSync('tmux', ['kill-session', '-t', sessionName], { stdio: 'ignore' }).status === 0;
}
