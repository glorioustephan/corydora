import type {
  AgentDefinition,
  FixResult,
  ProjectFingerprint,
  RuntimeAdapter,
  ScanResult,
  TaskRecord,
} from '../types/domain.js';
import type { AnalysisMaterial } from './modes.js';

function fencedFileBlock(filePath: string, content: string): string {
  const extension = filePath.split('.').at(-1) ?? 'txt';
  return `TARGET_FILE: ${filePath}\n\n\`\`\`${extension}\n${content}\n\`\`\``;
}

export function scanJsonSchemaExample(): string {
  return JSON.stringify(
    {
      fileSummary: 'Short factual summary of the file or analyzed windows.',
      tasks: [
        {
          category: 'bugs',
          title: 'Concrete small task title',
          file: 'src/example.ts',
          targetFiles: ['src/example.ts'],
          rationale: 'Why this matters.',
          validation: 'How to verify the change.',
          severity: 'medium',
          effort: 'small',
          risk: 'low',
          sourceAgent: 'bug-investigator',
          evidence: [
            {
              file: 'src/example.ts',
              startLine: 10,
              endLine: 16,
              note: 'Null path is missing a guard.',
            },
          ],
          confidence: 0.82,
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
    validationSummary: 'Host validation runs after the fix.',
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

function renderAgentPrompts(agents: AgentDefinition[]): string {
  if (agents.length === 0) {
    return 'No explicit agent prompts were selected. Use the file evidence and mode instructions only.';
  }

  return agents.map((agent) => `- ${agent.id}: ${agent.prompt}`).join('\n');
}

function renderAnalysisMaterial(material: AnalysisMaterial): string {
  if (material.strategy === 'full') {
    return fencedFileBlock(material.filePath, material.fullContent ?? '');
  }

  if (material.strategy === 'tooling') {
    return `TARGET_FILE: ${material.filePath}\n\nTooling-first mode is active. Use AI only if tool diagnostics are absent.`;
  }

  const sections = [
    `TARGET_FILE: ${material.filePath}`,
    '',
    'The file exceeded the full-context budget. Use the outline and windows below.',
    '',
    'Outline:',
    material.outline ?? 'No outline available.',
    '',
  ];

  for (const window of material.windows) {
    sections.push(
      `Window ${window.startLine}-${window.endLine} (${window.reason})`,
      '',
      fencedFileBlock(material.filePath, window.content),
      '',
    );
  }

  return sections.join('\n');
}

export function buildScanPrompt(input: {
  filePath: string;
  material: AnalysisMaterial;
  fingerprint: ProjectFingerprint;
  agents: AgentDefinition[];
  modePrompt: string;
}): string {
  return [
    'You are Corydora, a code scrubbing agent.',
    input.modePrompt,
    'Review exactly one file target and produce only small, concrete, non-duplicative tasks.',
    'Prefer fixes that can be executed independently and validated automatically.',
    '',
    `Project frameworks: ${input.fingerprint.frameworks.join(', ') || 'unknown'}`,
    `Project tech lenses: ${input.fingerprint.techLenses.join(', ') || 'refactoring'}`,
    `Analysis strategy: ${input.material.strategy}`,
    '',
    'Selected agent prompts:',
    renderAgentPrompts(input.agents),
    '',
    renderAnalysisMaterial(input.material),
    '',
    'Return JSON only matching this shape:',
    scanJsonSchemaExample(),
  ].join('\n');
}

export function buildFixPrompt(input: {
  adapter: RuntimeAdapter;
  task: TaskRecord;
  fileContents: Array<{ path: string; content: string }>;
  modePrompt: string;
}): string {
  const instructions =
    input.adapter.executionMode === 'native-agent'
      ? [
          'Use available tools to edit the working tree directly.',
          'Only touch the files in TARGET_FILES unless the task evidence makes an additional nearby edit necessary.',
          'Host validation runs after the fix. Do not run repo-wide formatting.',
        ]
      : [
          'Return a JSON object with full replacement file contents in `fileEdits`.',
          'Only rewrite the target files unless the task explicitly requires more.',
          'Do not return prose outside the JSON object.',
        ];

  return [
    'You are Corydora, executing one queued task.',
    input.modePrompt,
    ...instructions,
    '',
    `TASK_ID: ${input.task.id}`,
    `TARGET_FILE: ${input.task.file}`,
    `TARGET_FILES: ${input.task.handoff.targetFiles.join(', ')}`,
    `TASK_TITLE: ${input.task.title}`,
    `TASK_CATEGORY: ${input.task.category}`,
    `TASK_RISK: ${input.task.risk}`,
    `TASK_VALIDATION_HINT: ${input.task.validation}`,
    `TASK_CONFIDENCE: ${input.task.handoff.confidence}`,
    `TASK_SNAPSHOT_HASH: ${input.task.snapshotHash}`,
    '',
    'Rationale:',
    input.task.rationale,
    '',
    'Evidence:',
    ...input.task.handoff.evidence.map(
      (item) => `- ${item.file}:${item.startLine}-${item.endLine} ${item.note}`,
    ),
    '',
    'Current file content:',
    ...input.fileContents.map(({ path, content }) => fencedFileBlock(path, content)),
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
