import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join, resolve } from 'node:path';
import { ensureCleanWorktree, currentBranch } from './repository.js';
import type { GitIsolationMode, CorydoraConfig } from '../types/domain.js';

export interface IsolationContext {
  mode: GitIsolationMode;
  workRoot: string;
  branchName?: string;
  baseBranch: string;
  worktreePath?: string;
}

function defaultWorktreeRoot(): string {
  if (platform() === 'darwin') {
    return resolve(homedir(), 'Library', 'Caches', 'corydora', 'worktrees');
  }

  return resolve(homedir(), '.cache', 'corydora', 'worktrees');
}

function sanitizedSlug(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
}

export function resolveWorktreeRoot(config: CorydoraConfig): string {
  return config.git.worktreeRoot ? resolve(config.git.worktreeRoot) : defaultWorktreeRoot();
}

export function prepareIsolationContext(options: {
  projectRoot: string;
  config: CorydoraConfig;
  runId: string;
  dryRun: boolean;
  isolationMode?: GitIsolationMode;
}): IsolationContext {
  const baseBranch = currentBranch(options.projectRoot);
  const branchName = `${options.config.git.branchPrefix}/${new Date().toISOString().slice(0, 10)}-${options.runId}`;
  const isolationMode = options.isolationMode ?? options.config.git.isolationMode;

  if (isolationMode === 'current-branch' || options.dryRun) {
    return {
      mode: isolationMode,
      workRoot: options.projectRoot,
      baseBranch,
      ...(isolationMode !== 'current-branch' ? { branchName } : {}),
    };
  }

  ensureCleanWorktree(options.projectRoot);

  if (isolationMode === 'branch') {
    execFileSync('git', ['checkout', '-B', branchName, baseBranch], {
      cwd: options.projectRoot,
      stdio: 'ignore',
    });
    return {
      mode: 'branch',
      workRoot: options.projectRoot,
      branchName,
      baseBranch,
    };
  }

  const rootDirectory = resolveWorktreeRoot(options.config);
  const repositoryName = sanitizedSlug(
    options.projectRoot.split('/').filter(Boolean).at(-1) ?? 'repo',
  );
  const worktreePath = join(rootDirectory, `${repositoryName}-${options.runId}`);
  if (existsSync(worktreePath)) {
    execFileSync('git', ['worktree', 'remove', '--force', worktreePath], {
      cwd: options.projectRoot,
      stdio: 'ignore',
    });
  }

  execFileSync('mkdir', ['-p', rootDirectory], { stdio: 'ignore' });
  execFileSync('git', ['worktree', 'add', '-B', branchName, worktreePath, baseBranch], {
    cwd: options.projectRoot,
    stdio: 'ignore',
  });

  return {
    mode: 'worktree',
    workRoot: worktreePath,
    branchName,
    baseBranch,
    worktreePath,
  };
}
