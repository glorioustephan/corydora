import { describe, expect, it } from 'vitest';
import { FakeRuntimeAdapter } from './fake.js';

describe('fake runtime adapter', () => {
  it('returns deterministic scan and fix payloads', async () => {
    const adapter = new FakeRuntimeAdapter();

    const scan = await adapter.executeScan({
      rootDir: '/tmp/repo',
      workingDirectory: '/tmp/repo',
      model: 'fake',
      prompt: 'TARGET_FILE: src/index.ts',
      dryRun: false,
    });
    const fix = await adapter.executeFix({
      rootDir: '/tmp/repo',
      workingDirectory: '/tmp/repo',
      model: 'fake',
      prompt: 'TARGET_FILE: src/index.ts',
      dryRun: false,
    });

    expect(scan.tasks[0]?.file).toBe('src/index.ts');
    expect(fix.changedFiles).toContain('src/index.ts');
  });
});
