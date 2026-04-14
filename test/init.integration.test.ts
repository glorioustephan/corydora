import { afterEach, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
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

describe('init command', () => {
  it(
    'creates config and queues in non-interactive mode',
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

  it(
    'does not modify an existing gitignore in non-interactive mode',
    async () => {
      const directory = await createTempFixture('node-lib');
      directories.push(directory);
      initializeGitRepository(directory);

      const originalGitignore = ['node_modules/', 'dist/', '# keep this order'].join('\n');
      await writeFile(`${directory}/.gitignore`, `${originalGitignore}\n`, 'utf8');

      const output = runCli(['init', '--yes', '--json'], directory);
      const parsed = JSON.parse(output) as {
        gitignore: { modified: boolean; missingEntries: string[] };
      };

      expect(parsed.gitignore.modified).toBe(false);
      expect(parsed.gitignore.missingEntries).toContain('.corydora/.env.local');
      expect(await readFile(`${directory}/.gitignore`, 'utf8')).toBe(`${originalGitignore}\n`);
    },
    integrationTestTimeoutMs,
  );

  it(
    'preserves configured categories when init is re-run',
    async () => {
      const directory = await createTempFixture('node-lib');
      directories.push(directory);
      initializeGitRepository(directory);

      runCli(['init', '--yes', '--json'], directory);
      await patchConfig(directory, (config) => ({
        ...config,
        agents: {
          ...(config.agents as Record<string, unknown>),
          enabledCategories: ['bugs', 'todo'],
        },
        execution: {
          ...(config.execution as Record<string, unknown>),
          maxRuntimeMinutes: 30,
        },
      }));

      runCli(['init', '--yes', '--json'], directory);
      const config = JSON.parse(await readFile(`${directory}/.corydora.json`, 'utf8')) as {
        agents: { enabledCategories: string[] };
        execution: { maxRuntimeMinutes: number };
      };

      expect(config.agents.enabledCategories).toEqual(['bugs', 'todo']);
      expect(config.execution.maxRuntimeMinutes).toBe(30);
    },
    integrationTestTimeoutMs,
  );
});
