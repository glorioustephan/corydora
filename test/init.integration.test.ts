import { afterEach, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { createTempFixture, initializeGitRepository, runCli, cleanupDirectory } from './helpers.js';

const directories: string[] = [];
const integrationTestTimeoutMs = 15_000;

afterEach(async () => {
  await Promise.all(directories.splice(0).map(cleanupDirectory));
});

describe('init command', () => {
  it(
    'creates config, queues, and gitignore entries',
    async () => {
      const directory = await createTempFixture('node-lib');
      directories.push(directory);
      initializeGitRepository(directory);

      const output = runCli(['init', '--yes', '--json'], directory);
      const parsed = JSON.parse(output) as { provider: string };

      expect(parsed.provider.length).toBeGreaterThan(0);
      expect(existsSync(`${directory}/.corydora.json`)).toBe(true);
      expect(existsSync(`${directory}/.corydora/todo.md`)).toBe(true);
      expect(existsSync(`${directory}/.corydora/.env.local`)).toBe(true);
    },
    integrationTestTimeoutMs,
  );
});
