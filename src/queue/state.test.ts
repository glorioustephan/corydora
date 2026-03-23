import { describe, expect, it } from 'vitest';
import { claimNextTask, mergeScanFindings, updateTaskStatus } from './state.js';

describe('task state', () => {
  it('dedupes repeated scan findings', () => {
    const result = mergeScanFindings(
      { tasks: [] },
      [
        {
          category: 'bugs',
          title: 'Fix null guard',
          file: 'src/index.ts',
          rationale: 'Null access can throw.',
          validation: 'Run tests.',
          severity: 'medium',
          effort: 'small',
          risk: 'low',
          sourceAgent: 'bug-investigator',
          techLenses: ['typescript'],
        },
        {
          category: 'bugs',
          title: 'Fix null guard',
          file: 'src/index.ts',
          rationale: 'Null access can throw.',
          validation: 'Run tests.',
          severity: 'medium',
          effort: 'small',
          risk: 'low',
          sourceAgent: 'bug-investigator',
          techLenses: ['typescript'],
        },
      ]
    );

    expect(result.store.tasks).toHaveLength(1);
  });

  it('claims and updates task status', () => {
    const merged = mergeScanFindings(
      { tasks: [] },
      [
        {
          category: 'todo',
          title: 'Refactor helper',
          file: 'src/index.ts',
          rationale: 'Helper is duplicated.',
          validation: 'Run tests.',
          severity: 'low',
          effort: 'small',
          risk: 'low',
          sourceAgent: 'refactoring-engineer',
          techLenses: ['refactoring'],
        },
      ]
    );

    const claimed = claimNextTask(merged.store, 'run-1', false);
    expect(claimed?.status).toBe('claimed');

    const updated = updateTaskStatus(merged.store, claimed!.id, 'done');
    expect(updated.tasks[0]?.status).toBe('done');
  });
});
