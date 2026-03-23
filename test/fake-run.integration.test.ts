import { afterEach, describe, expect, it } from 'vitest';
import { cleanupDirectory, createTempFixture, initializeGitRepository, patchConfig, runCli } from './helpers.js';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map(cleanupDirectory));
});

describe('fake runtime run', () => {
  it('completes a run with the deterministic fake provider', async () => {
    const directory = await createTempFixture('node-lib');
    directories.push(directory);
    initializeGitRepository(directory);
    runCli(['init', '--yes'], directory);
    await patchConfig(directory, config => ({
      ...config,
      runtime: {
        ...(config.runtime as Record<string, unknown>),
        provider: 'fake',
        model: 'fake-corydora-model',
      },
      git: {
        ...(config.git as Record<string, unknown>),
        isolationMode: 'current-branch',
      },
    }));

    const output = runCli(['run', '--json'], directory);
    const parsed = JSON.parse(output) as { status: string; runId: string };

    expect(parsed.status).toBe('completed');
    expect(parsed.runId.length).toBeGreaterThan(0);
  });
});
