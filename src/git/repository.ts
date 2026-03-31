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

export function commitAllChanges(
  cwd: string,
  message: string,
  options: { skipHooks?: boolean } = {},
): boolean {
  if (!hasDirtyWorktree(cwd)) {
    return false;
  }

  const prettier = spawnSync('pnpm', ['exec', 'prettier', '.', '--write'], {
    cwd,
    encoding: 'utf8',
  });
  if (prettier.status !== 0) {
    const details = [prettier.stdout?.trim(), prettier.stderr?.trim()].filter(Boolean).join('\n');
    throw new Error(
      `Prettier formatting failed before commit.${details.length > 0 ? ` ${details}` : ''}`,
    );
  }

  execFileSync('git', ['add', '-A'], { cwd, stdio: 'ignore' });
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
