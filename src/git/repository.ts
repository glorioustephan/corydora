import { execFileSync, spawnSync } from 'node:child_process';

export function runGit(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

export function hasDirtyWorktree(cwd: string): boolean {
  return runGit(['status', '--porcelain'], cwd).length > 0;
}

export function currentBranch(cwd: string): string {
  return runGit(['branch', '--show-current'], cwd);
}

export function ensureCleanWorktree(cwd: string): void {
  if (hasDirtyWorktree(cwd)) {
    throw new Error('Working tree is dirty. Commit or stash changes before running Corydora.');
  }
}

export function listChangedFiles(cwd: string): string[] {
  try {
    const raw = execFileSync('git', ['status', '--porcelain'], {
      cwd,
      encoding: 'utf8',
    });

    return raw
      .split('\n')
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map((line) => line.slice(3).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function commitTaskChanges(
  cwd: string,
  message: string,
  changedFiles: string[],
  options: { skipHooks?: boolean } = {},
): boolean {
  const uniqueFiles = [...new Set(changedFiles)].filter(Boolean);
  if (uniqueFiles.length === 0) {
    return false;
  }

  execFileSync('git', ['add', '-A', '--', ...uniqueFiles], { cwd, stdio: 'ignore' });
  const result = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd, stdio: 'ignore' });
  if (result.status === 0) {
    return false;
  }

  const commitArgs = ['commit', '-m', message];
  if (options.skipHooks) {
    commitArgs.push('--no-verify');
  }

  execFileSync('git', commitArgs, { cwd, stdio: 'ignore' });
  return true;
}
