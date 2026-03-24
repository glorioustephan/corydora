import { describe, expect, it } from 'vitest';
import { FakeRuntimeAdapter } from './fake.js';

describe('fake runtime adapter', () => {
  it('returns deterministic scan and fix payloads', async () => {
    const adapter = new FakeRuntimeAdapter();
    const settings = {
      maxOutputTokens: 8192,
      requestTimeoutMs: 900_000,
      maxRetries: 3,
    };

    const scan = await adapter.executeScan({
      rootDir: '/tmp/repo',
      workingDirectory: '/tmp/repo',
      model: 'fake',
      prompt: 'TARGET_FILE: src/index.ts',
      dryRun: false,
      settings,
    });
    const fix = await adapter.executeFix({
      rootDir: '/tmp/repo',
      workingDirectory: '/tmp/repo',
      model: 'fake',
      prompt: 'TARGET_FILE: src/index.ts',
      dryRun: false,
      settings,
    });

    expect(scan.tasks[0]?.file).toBe('src/index.ts');
    expect(fix.changedFiles).toContain('src/index.ts');
  });
});
