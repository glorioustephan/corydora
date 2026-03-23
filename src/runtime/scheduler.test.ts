import { describe, expect, it } from 'vitest';
import { noteFileProcessed, restoreSchedulerState, selectScanBatch } from './scheduler.js';

describe('scheduler', () => {
  it('round-robins across grouped files', () => {
    const files = [
      'packages/core/src/a.ts',
      'packages/core/src/b.ts',
      'apps/web/app/page.tsx',
      'apps/web/app/layout.tsx',
    ];
    const state = restoreSchedulerState(undefined, files);
    const batch = selectScanBatch(state, files, 2);

    expect(batch).toHaveLength(2);
    expect(batch.some((file) => file.startsWith('packages/core'))).toBe(true);
    expect(batch.some((file) => file.startsWith('apps/web'))).toBe(true);
  });

  it('advances cursors when files are processed', () => {
    const state = restoreSchedulerState(undefined, ['src/a.ts']);
    const next = noteFileProcessed(state, 'src/a.ts', true);
    expect(next.completedFiles).toContain('src/a.ts');
  });
});
