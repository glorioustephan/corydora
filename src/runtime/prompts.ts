import type {
  AgentDefinition,
  FixResult,
  ProjectFingerprint,
  RuntimeAdapter,
  ScanResult,
  TaskRecord,
} from '../types/domain.js';

function fencedFileBlock(filePath: string, content: string): string {
  const extension = filePath.split('.').at(-1) ?? 'txt';
  return `TARGET_FILE: ${filePath}\n\n\`\`\`${extension}\n${content}\n\`\`\``;
}

export function scanJsonSchemaExample(): string {
  return JSON.stringify(
    {
      fileSummary: 'Short factual summary of the file.',
      tasks: [
        {
          category: 'bugs',
          title: 'Concrete small task title',
          file: 'src/example.ts',
          rationale: 'Why this matters.',
          validation: 'How to verify the change.',
          severity: 'medium',
          effort: 'small',
          risk: 'low',
          sourceAgent: 'bug-investigator',
          techLenses: ['typescript'],
        },
      ],
      needsHumanReview: false,
    },
    null,
    2,
  );
}

export function fixJsonSchemaExample(adapter: RuntimeAdapter): string {
  const base = {
    summary: 'Short summary of the applied change.',
    validationSummary: 'What validation ran.',
    changedFiles: ['src/example.ts'],
    needsHumanReview: false,
  };

  if (adapter.executionMode === 'single-file-json') {
    return JSON.stringify(
      {
        ...base,
        fileEdits: [
          {
            path: 'src/example.ts',
            content: '// full updated file content here',
          },
        ],
      },
      null,
      2,
    );
  }

  return JSON.stringify(base, null, 2);
}

export function buildScanPrompt(input: {
  filePath: string;
  fileContent: string;
  fingerprint: ProjectFingerprint;
  agents: AgentDefinition[];
}): string {
  return [
    'You are Corydora, a code scrubbing agent.',
    'Review exactly one file and produce only small, concrete, non-duplicative tasks.',
    'Do not suggest broad rewrites unless risk is explicitly broad.',
    '',
    `Project frameworks: ${input.fingerprint.frameworks.join(', ') || 'unknown'}`,
    `Project tech lenses: ${input.fingerprint.techLenses.join(', ') || 'refactoring'}`,
    `Active agents: ${input.agents.map((agent) => `${agent.id} (${agent.description})`).join('; ')}`,
    '',
    fencedFileBlock(input.filePath, input.fileContent),
    '',
    'Return JSON only matching this shape:',
    scanJsonSchemaExample(),
  ].join('\n');
}

export function buildFixPrompt(input: {
  adapter: RuntimeAdapter;
  task: TaskRecord;
  fileContent: string;
  validateAfterFix: boolean;
}): string {
  const instructions =
    input.adapter.executionMode === 'native-agent'
      ? [
          'Use available tools to edit the working tree directly.',
          'Keep the change behavior-preserving and low/medium risk unless the task says otherwise.',
          input.validateAfterFix
            ? 'Run the narrowest sensible validation after the change.'
            : 'Validation can be deferred if no narrow command exists.',
        ]
      : [
          'Return a JSON object with full replacement file contents in `fileEdits`.',
          'Only rewrite the target file unless the task explicitly requires more.',
          'Do not return prose outside the JSON object.',
        ];

  return [
    'You are Corydora, executing one queued task.',
    ...instructions,
    '',
    `TASK_ID: ${input.task.id}`,
    `TARGET_FILE: ${input.task.file}`,
    `TASK_TITLE: ${input.task.title}`,
    `TASK_CATEGORY: ${input.task.category}`,
    `TASK_RISK: ${input.task.risk}`,
    `TASK_VALIDATION_HINT: ${input.task.validation}`,
    '',
    'Rationale:',
    input.task.rationale,
    '',
    'Current file content:',
    fencedFileBlock(input.task.file, input.fileContent),
    '',
    'Return JSON only matching this shape:',
    fixJsonSchemaExample(input.adapter),
  ].join('\n');
}

export function summarizeScanResult(result: ScanResult): string {
  return `${result.tasks.length} task(s), review=${result.needsHumanReview ? 'yes' : 'no'}`;
}

export function summarizeFixResult(result: FixResult): string {
  return `${result.changedFiles.length} changed file(s), review=${result.needsHumanReview ? 'yes' : 'no'}`;
}
