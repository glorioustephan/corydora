import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';
import { commandExists } from '../providers/utils.js';

export function supportsTmux(): boolean {
  return platform() !== 'win32' && commandExists('tmux');
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

export function launchBackgroundRun(sessionName: string, args: string[], cwd: string): void {
  if (!supportsTmux()) {
    throw new Error('tmux is not available on this machine.');
  }

  const command = buildSelfCommand(args);
  const result = spawnSync('tmux', ['new-session', '-d', '-s', sessionName, command], {
    cwd,
    stdio: 'ignore',
  });

  if (result.status !== 0) {
    throw new Error(`Unable to start tmux session "${sessionName}".`);
  }
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
