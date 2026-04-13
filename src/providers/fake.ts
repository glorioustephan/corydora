import type {
  DoctorCheck,
  FixResult,
  RuntimeAdapter,
  RuntimeExecutionContext,
  RuntimeProbe,
  ScanResult,
} from '../types/domain.js';
import { buildProbe, successAuth } from './utils.js';

export class FakeRuntimeAdapter implements RuntimeAdapter {
  readonly id = 'fake';
  readonly label = 'Fake Runtime';
  readonly executionMode = 'fake' as const;

  suggestModels(): string[] {
    return ['fake-corydora-model'];
  }

  async probe(_projectRoot: string): Promise<RuntimeProbe> {
    return buildProbe({
      provider: this.id,
      label: this.label,
      installed: true,
      auth: successAuth('Fake runtime is always ready.'),
      models: this.suggestModels(),
      recommended: false,
    });
  }

  async doctor(_projectRoot: string): Promise<DoctorCheck[]> {
    return [
      {
        id: 'fake-runtime',
        ok: true,
        message: 'Fake runtime is available for tests and dry runs.',
      },
    ];
  }

  async executeScan(context: RuntimeExecutionContext): Promise<ScanResult> {
    if (process.env.CORYDORA_FAKE_SCAN_FAIL === '1') {
      throw new Error('Synthetic scan failure.');
    }

    const targetFile = context.prompt.match(/TARGET_FILE:\s*(.+)$/m)?.[1] ?? 'src/index.ts';
    return {
      fileSummary: `Synthetic scan result for ${targetFile}.`,
      tasks: [
        {
          category: 'todo' as const,
          title: 'Replace placeholder implementation with a concrete branch.',
          file: targetFile,
          targetFiles: [targetFile],
          rationale:
            'The fake runtime emits a stable task so the scheduler and queue renderer can be tested deterministically.',
          validation: 'Run the narrowest existing project test command.',
          severity: 'low' as const,
          effort: 'small' as const,
          risk: 'low' as const,
          sourceAgent: 'fake-agent',
          evidence: [
            {
              file: targetFile,
              startLine: 1,
              endLine: 1,
              note: 'Synthetic evidence span.',
            },
          ],
          confidence: 0.8,
          techLenses: ['refactoring' as const],
        },
      ],
      needsHumanReview: false,
      rawText: '',
    };
  }

  async executeFix(context: RuntimeExecutionContext): Promise<FixResult> {
    if (process.env.CORYDORA_FAKE_FIX_FAIL === '1') {
      throw new Error('Synthetic fix failure.');
    }

    const targetFile = context.prompt.match(/TARGET_FILE:\s*(.+)$/m)?.[1] ?? 'src/index.ts';
    return {
      summary: `Fake runtime produced a synthetic fix for ${targetFile}.`,
      validationSummary: 'Synthetic validation succeeded.',
      changedFiles: [targetFile],
      needsHumanReview: false,
      rawText: '',
    };
  }
}
