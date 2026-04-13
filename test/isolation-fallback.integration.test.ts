import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  cleanupDirectory,
  createTempFixture,
  initializeGitRepository,
  patchConfig,
  runCli,
} from './helpers.js';

const directories: string[] = [];
const integrationTestTimeoutMs = 15_000;

afterEach(async () => {
  await Promise.all(directories.splice(0).map(cleanupDirectory));
});

describe('worktree preflight fallback', () => {
  it(
    'falls back to branch isolation when the run needs local tooling access',
    async () => {
      const directory = await createTempFixture('node-lib');
      directories.push(directory);
      initializeGitRepository(directory);
      runCli(['init', '--yes'], directory);
      await patchConfig(directory, (config) => ({
        ...config,
        runtime: {
          ...(config.runtime as Record<string, unknown>),
          provider: 'fake',
          model: 'fake-corydora-model',
        },
        git: {
          ...(config.git as Record<string, unknown>),
          isolationMode: 'worktree',
        },
      }));
      execFileSync('git', ['add', '.'], { cwd: directory, stdio: 'ignore' });
      execFileSync('git', ['commit', '-m', 'configure fixture'], {
        cwd: directory,
        stdio: 'ignore',
      });

      const output = runCli(['run', '--json'], directory);
      const parsed = JSON.parse(output) as {
        status: string;
        effectiveIsolationMode: string;
      };

      expect(parsed.status).toBe('completed');
      expect(parsed.effectiveIsolationMode).toBe('branch');
    },
    integrationTestTimeoutMs,
  );
});
