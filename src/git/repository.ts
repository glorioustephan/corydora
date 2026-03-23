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

export function commitAllChanges(cwd: string, message: string): boolean {
  if (!hasDirtyWorktree(cwd)) {
    return false;
  }

  execFileSync('git', ['add', '-A'], { cwd, stdio: 'ignore' });
  const result = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd, stdio: 'ignore' });
  if (result.status === 0) {
    return false;
  }

  execFileSync('git', ['commit', '-m', message], { cwd, stdio: 'ignore' });
  return true;
}
