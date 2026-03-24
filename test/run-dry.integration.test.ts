import { afterEach, describe, expect, it } from 'vitest';
import { cleanupDirectory, createTempFixture, initializeGitRepository, runCli } from './helpers.js';

const directories: string[] = [];
const integrationTestTimeoutMs = 15_000;

afterEach(async () => {
  await Promise.all(directories.splice(0).map(cleanupDirectory));
});

describe('run --dry-run', () => {
  it(
    'returns a preview of the next scan batch',
    async () => {
      const directory = await createTempFixture('mixed-workspace');
      directories.push(directory);
      initializeGitRepository(directory);
      runCli(['init', '--yes'], directory);

      const output = runCli(['run', '--dry-run', '--json'], directory);
      const parsed = JSON.parse(output) as { nextScanBatch: string[] };

      expect(parsed.nextScanBatch.length).toBeGreaterThan(0);
    },
    integrationTestTimeoutMs,
  );
});
