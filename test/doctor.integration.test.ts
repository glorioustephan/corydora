import { afterEach, describe, expect, it } from 'vitest';
import { cleanupDirectory, createTempFixture, initializeGitRepository, runCli } from './helpers.js';

const directories: string[] = [];
const integrationTestTimeoutMs = 15_000;

afterEach(async () => {
  await Promise.all(directories.splice(0).map(cleanupDirectory));
});

describe('doctor command', () => {
  it(
    'reports project fingerprint and runtime probes',
    async () => {
      const directory = await createTempFixture('next-app');
      directories.push(directory);
      initializeGitRepository(directory);

      const output = runCli(['doctor', '--json'], directory);
      const parsed = JSON.parse(output) as {
        fingerprint: { frameworks: string[] };
        runtimes: Array<{ provider: string }>;
      };

      expect(parsed.fingerprint.frameworks).toContain('nextjs');
      expect(parsed.runtimes.length).toBeGreaterThan(0);
    },
    integrationTestTimeoutMs,
  );
});
