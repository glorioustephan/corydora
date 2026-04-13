import { describe, expect, it } from 'vitest';
import {
  leaseFilesForAnalysis,
  leaseTasksForFix,
  mergeScanFindings,
  noteTaskCompleted,
  reclaimExpiredFileLeases,
  reclaimExpiredTaskLeases,
} from './state.js';

describe('task state', () => {
  it('dedupes repeated scan findings', () => {
    const result = mergeScanFindings(
      { tasks: [] },
      [
        {
          category: 'bugs',
          title: 'Fix null guard',
          file: 'src/index.ts',
          targetFiles: ['src/index.ts'],
          rationale: 'Null access can throw.',
          validation: 'Run tests.',
          severity: 'medium',
          effort: 'small',
          risk: 'low',
          sourceAgent: 'bug-investigator',
          techLenses: ['typescript'],
          evidence: [
            {
              file: 'src/index.ts',
              startLine: 1,
              endLine: 3,
              note: 'Null branch.',
            },
          ],
          confidence: 0.9,
        },
        {
          category: 'bugs',
          title: 'Fix null guard',
          file: 'src/index.ts',
          targetFiles: ['src/index.ts'],
          rationale: 'Null access can throw.',
          validation: 'Run tests.',
          severity: 'medium',
          effort: 'small',
          risk: 'low',
          sourceAgent: 'bug-investigator',
          techLenses: ['typescript'],
          evidence: [
            {
              file: 'src/index.ts',
              startLine: 1,
              endLine: 3,
              note: 'Null branch.',
            },
          ],
          confidence: 0.9,
        },
      ],
      'snapshot-1',
    );

    expect(result.store.tasks).toHaveLength(1);
  });

  it('leases and completes a queued task', () => {
    const merged = mergeScanFindings(
      { tasks: [] },
      [
        {
          category: 'todo',
          title: 'Refactor helper',
          file: 'src/index.ts',
          targetFiles: ['src/index.ts'],
          rationale: 'Helper is duplicated.',
          validation: 'Run tests.',
          severity: 'low',
          effort: 'small',
          risk: 'low',
          sourceAgent: 'refactoring-engineer',
          techLenses: ['refactoring'],
          evidence: [
            {
              file: 'src/index.ts',
              startLine: 2,
              endLine: 5,
              note: 'Duplicate helper.',
            },
          ],
          confidence: 0.85,
        },
      ],
      'snapshot-2',
    );

    const leased = leaseTasksForFix({
      store: merged.store,
      runId: 'run-1',
      maxCount: 1,
      leaseTtlMs: 60_000,
      allowBroadRisk: false,
    });
    expect(leased.leased[0]?.status).toBe('leased');

    const completed = noteTaskCompleted(leased.store, leased.leased[0]!.id, {
      status: 'passed',
      summary: 'typecheck passed.',
    });
    expect(completed.tasks[0]?.status).toBe('done');
  });

  it('reclaims expired file and task leases on resume', () => {
    const now = new Date('2026-04-12T12:00:00.000Z');
    const leasedFiles = leaseFilesForAnalysis({
      store: {
        files: [
          {
            id: 'file-1',
            path: 'src/index.ts',
            group: 'src',
            mode: 'auto',
            status: 'queued',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            attemptCount: 0,
            snapshotHash: 'snap',
            lineCount: 10,
            estimatedTokens: 20,
            changedInWorktree: false,
            gitTouchCount: 1,
            score: {
              priority: 1,
              gitTouches: 1,
              recency: 1,
              size: 1,
              currentDiff: 0,
              deferredTaskWeight: 0,
              total: 1,
            },
            analysisStrategy: 'full',
            windows: [],
          },
        ],
      },
      runId: 'run-1',
      maxCount: 1,
      leaseTtlMs: 1_000,
      now,
    });
    const leasedTasks = leaseTasksForFix({
      store: mergeScanFindings(
        { tasks: [] },
        [
          {
            category: 'todo',
            title: 'Refactor helper',
            file: 'src/index.ts',
            targetFiles: ['src/index.ts'],
            rationale: 'Helper is duplicated.',
            validation: 'Run tests.',
            severity: 'low',
            effort: 'small',
            risk: 'low',
            sourceAgent: 'refactoring-engineer',
            techLenses: ['refactoring'],
            evidence: [
              {
                file: 'src/index.ts',
                startLine: 1,
                endLine: 1,
                note: 'Duplicate helper.',
              },
            ],
            confidence: 0.8,
          },
        ],
        'snapshot-lease',
      ).store,
      runId: 'run-1',
      maxCount: 1,
      leaseTtlMs: 1_000,
      allowBroadRisk: false,
      now,
    });

    const reclaimedFiles = reclaimExpiredFileLeases(
      leasedFiles.store,
      new Date('2026-04-12T12:00:02.000Z'),
    );
    const reclaimedTasks = reclaimExpiredTaskLeases(
      leasedTasks.store,
      new Date('2026-04-12T12:00:02.000Z'),
    );

    expect(reclaimedFiles.files[0]?.status).toBe('queued');
    expect(reclaimedTasks.tasks[0]?.status).toBe('queued');
  });
});
