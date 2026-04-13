import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  discoverCandidateFiles,
  filePriority,
  groupFilesForScheduling,
} from '../filesystem/discovery.js';
import type {
  AgentDefinition,
  CorydoraConfig,
  CorydoraMode,
  EvidenceSpan,
  FileRecord,
  FileStore,
  FileWindow,
  ProjectFingerprint,
  TaskStore,
} from '../types/domain.js';
import { createFileId, createSnapshotHash } from '../queue/state.js';

export interface AnalysisMaterial {
  strategy: 'full' | 'windowed' | 'tooling';
  filePath: string;
  estimatedTokens: number;
  fullContent?: string;
  outline?: string;
  windows: Array<FileWindow & { content: string }>;
}

const MODE_PROMPTS: Record<CorydoraMode, string> = {
  auto: 'Balance correctness, maintainability, and likely user impact. Prefer concrete, scoped work.',
  churn:
    'Prioritize recently touched, frequently modified, and large files. Prefer tasks that reduce churn and future edit cost.',
  clean:
    'Prioritize low-risk cleanup, consistency, and technical-debt reduction with behavior-preserving changes.',
  refactor:
    'Prioritize complexity hotspots, duplicated logic, and structural cleanup that reduces future work.',
  performance:
    'Prioritize render-heavy, I/O-heavy, and repeated-work hotspots with credible user-facing impact.',
  linting:
    'Prefer tool-backed correctness and style issues first. Fall back to AI only when tooling has no concrete findings.',
  documentation:
    'Prioritize docs, schema, README, CLI help, and public-entrypoint clarity. Focus on documentation-facing quality.',
};

function fileGroup(filePath: string): string {
  return Object.keys(groupFilesForScheduling([filePath]))[0] ?? '.';
}

function documentationPriority(filePath: string): number {
  if (filePath.startsWith('docs/')) {
    return 1;
  }

  if (filePath.startsWith('schemas/')) {
    return 0.9;
  }

  if (filePath.startsWith('README')) {
    return 0.95;
  }

  if (filePath.includes('cli') || filePath.includes('config')) {
    return 0.75;
  }

  return 0.1;
}

function loadGitTouchMetrics(
  workRoot: string,
): Map<string, { count: number; lastTouchedAt?: string | undefined }> {
  try {
    const raw = execFileSync(
      'git',
      ['log', '--format=commit %ct', '--name-only', '-n', '200', '--'],
      {
        cwd: workRoot,
        encoding: 'utf8',
      },
    );
    const metrics = new Map<string, { count: number; lastTouchedAt?: string }>();
    let currentTimestamp: string | undefined;

    for (const line of raw.split('\n')) {
      if (line.startsWith('commit ')) {
        currentTimestamp = line.slice('commit '.length).trim();
        continue;
      }

      const filePath = line.trim();
      if (!filePath) {
        continue;
      }

      const existing: { count: number; lastTouchedAt?: string | undefined } = metrics.get(
        filePath,
      ) ?? { count: 0 };
      const isoTimestamp =
        currentTimestamp && Number.isFinite(Number(currentTimestamp))
          ? new Date(Number(currentTimestamp) * 1000).toISOString()
          : existing.lastTouchedAt;
      const nextTouchedAt =
        existing.lastTouchedAt && isoTimestamp
          ? existing.lastTouchedAt > isoTimestamp
            ? existing.lastTouchedAt
            : isoTimestamp
          : (existing.lastTouchedAt ?? isoTimestamp);
      metrics.set(filePath, {
        count: existing.count + 1,
        ...(nextTouchedAt ? { lastTouchedAt: nextTouchedAt } : {}),
      });
    }

    return metrics;
  } catch {
    return new Map();
  }
}

function loadDirtyFiles(workRoot: string): Set<string> {
  try {
    const raw = execFileSync('git', ['status', '--porcelain'], {
      cwd: workRoot,
      encoding: 'utf8',
    });
    return new Set(
      raw
        .split('\n')
        .map((line) => line.trimEnd())
        .filter(Boolean)
        .map((line) => line.slice(3).trim())
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

function normalize(value: number, maxValue: number): number {
  if (maxValue <= 0) {
    return 0;
  }

  return value / maxValue;
}

function performanceSignal(content: string): number {
  const matches = [
    /\buseEffect\b/,
    /\bfetch\b/,
    /\bquery\b/i,
    /\bfor\s*\(/,
    /\bwhile\s*\(/,
    /\bmap\(/,
    /\bsetInterval\b/,
  ].filter((pattern) => pattern.test(content)).length;
  return Math.min(1, matches / 4);
}

function deferredTaskWeight(taskStore: TaskStore, filePath: string): number {
  const count = taskStore.tasks.filter(
    (task) => task.file === filePath && ['deferred', 'blocked', 'manual'].includes(task.status),
  ).length;
  return Math.min(1, count / 3);
}

function buildScore(options: {
  mode: CorydoraMode;
  priority: number;
  touches: number;
  recency: number;
  size: number;
  currentDiff: number;
  deferredWeight: number;
  performanceWeight: number;
  documentationWeight: number;
}): {
  priority: number;
  gitTouches: number;
  recency: number;
  size: number;
  currentDiff: number;
  deferredTaskWeight: number;
  total: number;
} {
  switch (options.mode) {
    case 'churn':
      return {
        priority: options.priority,
        gitTouches: options.touches,
        recency: options.recency,
        size: options.size,
        currentDiff: options.currentDiff,
        deferredTaskWeight: options.deferredWeight,
        total:
          0.45 * options.touches +
          0.25 * options.recency +
          0.2 * options.size +
          0.1 * options.currentDiff,
      };
    case 'clean':
      return {
        priority: options.priority,
        gitTouches: options.touches,
        recency: options.recency,
        size: options.size,
        currentDiff: options.currentDiff,
        deferredTaskWeight: options.deferredWeight,
        total:
          0.35 * options.priority +
          0.25 * options.deferredWeight +
          0.2 * options.size +
          0.2 * options.recency,
      };
    case 'refactor':
      return {
        priority: options.priority,
        gitTouches: options.touches,
        recency: options.recency,
        size: options.size,
        currentDiff: options.currentDiff,
        deferredTaskWeight: options.deferredWeight,
        total:
          0.3 * options.size +
          0.25 * options.touches +
          0.2 * options.priority +
          0.15 * options.deferredWeight +
          0.1 * options.currentDiff,
      };
    case 'performance':
      return {
        priority: options.priority,
        gitTouches: options.touches,
        recency: options.recency,
        size: options.size,
        currentDiff: options.currentDiff,
        deferredTaskWeight: options.deferredWeight,
        total:
          0.3 * options.size +
          0.25 * options.touches +
          0.2 * options.performanceWeight +
          0.15 * options.recency +
          0.1 * options.currentDiff,
      };
    case 'linting':
      return {
        priority: options.priority,
        gitTouches: options.touches,
        recency: options.recency,
        size: options.size,
        currentDiff: options.currentDiff,
        deferredTaskWeight: options.deferredWeight,
        total:
          0.35 * options.currentDiff +
          0.25 * options.priority +
          0.2 * options.touches +
          0.2 * options.recency,
      };
    case 'documentation':
      return {
        priority: options.documentationWeight,
        gitTouches: options.touches,
        recency: options.recency,
        size: options.size,
        currentDiff: options.currentDiff,
        deferredTaskWeight: options.deferredWeight,
        total:
          0.5 * options.documentationWeight +
          0.2 * options.recency +
          0.15 * options.currentDiff +
          0.15 * options.touches,
      };
    case 'auto':
    default:
      return {
        priority: options.priority,
        gitTouches: options.touches,
        recency: options.recency,
        size: options.size,
        currentDiff: options.currentDiff,
        deferredTaskWeight: options.deferredWeight,
        total:
          0.3 * options.priority +
          0.25 * options.touches +
          0.15 * options.recency +
          0.15 * options.size +
          0.15 * options.deferredWeight,
      };
  }
}

function buildOutline(lines: string[]): string {
  const outlineLines = lines
    .map((line, index) => ({ line, index: index + 1 }))
    .filter(
      ({ line }) =>
        /^\s*(export\s+)?(async\s+)?function\b/.test(line) ||
        /^\s*class\b/.test(line) ||
        /^\s*(export\s+)?const\s+\w+\s*=/.test(line),
    )
    .slice(0, 10)
    .map(({ line, index }) => `${index}: ${line.trim()}`);

  return outlineLines.length > 0
    ? outlineLines.join('\n')
    : 'No obvious top-level symbols detected.';
}

function mergeWindows(windows: FileWindow[]): FileWindow[] {
  const ordered = [...windows].sort((left, right) => left.startLine - right.startLine);
  const merged: FileWindow[] = [];

  for (const window of ordered) {
    const previous = merged.at(-1);
    if (previous && window.startLine <= previous.endLine + 5) {
      previous.endLine = Math.max(previous.endLine, window.endLine);
      previous.reason = `${previous.reason}; ${window.reason}`;
      continue;
    }

    merged.push({ ...window });
  }

  return merged.slice(0, 3);
}

function windowsFromDiff(workRoot: string, filePath: string, lineCount: number): FileWindow[] {
  try {
    const raw = execFileSync('git', ['diff', '--unified=0', '--', filePath], {
      cwd: workRoot,
      encoding: 'utf8',
    });
    const windows = raw
      .split('\n')
      .filter((line) => line.startsWith('@@ '))
      .map((line) => {
        const match = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
        const start = Number(match?.[1] ?? '1');
        const span = Number(match?.[2] ?? '1');
        return {
          startLine: Math.max(1, start - 25),
          endLine: Math.min(lineCount, start + Math.max(25, span + 25)),
          reason: 'changed-hunk',
        };
      });
    return mergeWindows(windows);
  } catch {
    return [];
  }
}

function windowsFromOutline(lines: string[], lineCount: number): FileWindow[] {
  const anchorLines = lines
    .map((line, index) => ({ line, index: index + 1 }))
    .filter(
      ({ line }) =>
        /^\s*(export\s+)?(async\s+)?function\b/.test(line) ||
        /^\s*class\b/.test(line) ||
        /^\s*(export\s+)?const\s+\w+\s*=/.test(line),
    )
    .slice(0, 3)
    .map(({ index }) => ({
      startLine: Math.max(1, index - 20),
      endLine: Math.min(lineCount, index + 40),
      reason: 'outline-anchor',
    }));

  if (anchorLines.length > 0) {
    return mergeWindows(anchorLines);
  }

  const fallbackStarts = [
    1,
    Math.max(1, Math.floor(lineCount / 2) - 20),
    Math.max(1, lineCount - 60),
  ];
  return mergeWindows(
    fallbackStarts.map((startLine, index) => ({
      startLine,
      endLine: Math.min(lineCount, startLine + 60),
      reason: `fallback-window-${index + 1}`,
    })),
  );
}

function buildWindows(workRoot: string, filePath: string, lines: string[]): FileWindow[] {
  const lineCount = lines.length;
  return windowsFromDiff(workRoot, filePath, lineCount).length > 0
    ? windowsFromDiff(workRoot, filePath, lineCount)
    : windowsFromOutline(lines, lineCount);
}

export function buildFileQueue(options: {
  projectRoot: string;
  workRoot: string;
  config: CorydoraConfig;
  mode: CorydoraMode;
  taskStore: TaskStore;
}): FileStore {
  const files = discoverCandidateFiles(options.workRoot, {
    includeExtensions: options.config.scan.includeExtensions,
    excludeDirectories: options.config.scan.excludeDirectories,
  });
  const touchMetrics = loadGitTouchMetrics(options.workRoot);
  const dirtyFiles = loadDirtyFiles(options.workRoot);
  const maxTouches = Math.max(
    1,
    ...files.map((filePath) => touchMetrics.get(filePath)?.count ?? 0),
  );
  const newestTouch = Math.max(
    1,
    ...files.map((filePath) => new Date(touchMetrics.get(filePath)?.lastTouchedAt ?? 0).getTime()),
  );
  const maxLineCount = Math.max(
    1,
    ...files.map((filePath) => {
      const content = readFileSync(resolve(options.workRoot, filePath), 'utf8');
      return content.split('\n').length;
    }),
  );
  const analyzeTokenBudget =
    options.config.runtime.stages.analyze.maxOutputTokens ?? options.config.runtime.maxOutputTokens;

  return {
    files: files.map((filePath) => {
      const absolutePath = resolve(options.workRoot, filePath);
      const content = readFileSync(absolutePath, 'utf8');
      const lines = content.split('\n');
      const lineCount = lines.length;
      const estimatedTokens = Math.ceil(content.length / 4);
      const windows = buildWindows(options.workRoot, filePath, lines);
      const metric = touchMetrics.get(filePath);
      const priority = 1 - filePriority(filePath) / 2;
      const touches = normalize(metric?.count ?? 0, maxTouches);
      const recency = normalize(
        Math.max(0, new Date(metric?.lastTouchedAt ?? 0).getTime()),
        newestTouch,
      );
      const size = normalize(Math.log(lineCount + 1), Math.log(maxLineCount + 1));
      const currentDiff = dirtyFiles.has(filePath) ? 1 : 0;
      const deferredWeight = deferredTaskWeight(options.taskStore, filePath);
      const performanceWeight = performanceSignal(content);
      const documentationWeight = documentationPriority(filePath);
      const score = buildScore({
        mode: options.mode,
        priority,
        touches,
        recency,
        size,
        currentDiff,
        deferredWeight,
        performanceWeight,
        documentationWeight,
      });
      const analysisStrategy =
        options.mode === 'linting'
          ? 'tooling'
          : estimatedTokens > Math.floor(analyzeTokenBudget * 0.75)
            ? 'windowed'
            : 'full';

      return {
        id: createFileId(filePath),
        path: filePath,
        group: fileGroup(filePath),
        mode: options.mode,
        status: 'queued',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attemptCount: 0,
        snapshotHash: createSnapshotHash(content),
        lineCount,
        estimatedTokens,
        changedInWorktree: dirtyFiles.has(filePath),
        gitTouchCount: metric?.count ?? 0,
        lastTouchedAt: metric?.lastTouchedAt,
        score,
        analysisStrategy,
        windows,
      } satisfies FileRecord;
    }),
  };
}

export function prepareAnalysisMaterial(workRoot: string, file: FileRecord): AnalysisMaterial {
  const absolutePath = resolve(workRoot, file.path);
  const content = existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : '';
  const lines = content.split('\n');

  if (file.analysisStrategy === 'tooling') {
    return {
      strategy: 'tooling',
      filePath: file.path,
      estimatedTokens: file.estimatedTokens,
      windows: [],
    };
  }

  if (file.analysisStrategy === 'full') {
    return {
      strategy: 'full',
      filePath: file.path,
      estimatedTokens: file.estimatedTokens,
      fullContent: content,
      windows: [],
    };
  }

  return {
    strategy: 'windowed',
    filePath: file.path,
    estimatedTokens: file.estimatedTokens,
    outline: buildOutline(lines),
    windows: file.windows.map((window) => ({
      ...window,
      content: lines.slice(window.startLine - 1, window.endLine).join('\n'),
    })),
  };
}

export function modePrompt(mode: CorydoraMode): string {
  return MODE_PROMPTS[mode];
}

export function resolveSelectedAgents(options: {
  allAgents: AgentDefinition[];
  config: CorydoraConfig;
  mode: CorydoraMode;
  projectFingerprint: ProjectFingerprint;
  overrideAgentIds?: string[];
}): AgentDefinition[] {
  const profile = options.config.modes.profiles[options.mode];
  const requestedIds =
    options.overrideAgentIds && options.overrideAgentIds.length > 0
      ? options.overrideAgentIds
      : profile.agentIds && profile.agentIds.length > 0
        ? profile.agentIds
        : options.config.agents.selectedBuiltinAgents;
  const enabledCategories =
    profile.categoryBias && profile.categoryBias.length > 0
      ? new Set(
          profile.categoryBias.filter((category) =>
            options.config.agents.enabledCategories.includes(category),
          ),
        )
      : new Set(options.config.agents.enabledCategories);

  const filtered = options.allAgents.filter(
    (agent) =>
      requestedIds.includes(agent.id) &&
      agent.categories.some((category) => enabledCategories.has(category)) &&
      agent.techLenses.some((lens) => options.projectFingerprint.techLenses.includes(lens)),
  );

  if (filtered.length > 0) {
    return filtered;
  }

  return options.allAgents.filter(
    (agent) =>
      requestedIds.includes(agent.id) &&
      agent.categories.some((category) => enabledCategories.has(category)),
  );
}

export function canRunSecondFixWorker(filePaths: string[]): boolean {
  const groups = new Set(filePaths.map((filePath) => fileGroup(filePath)));
  return groups.size === filePaths.length;
}

export function summarizeEvidence(evidence: EvidenceSpan[]): string {
  return evidence
    .map((item) => `${item.file}:${item.startLine}-${item.endLine} ${item.note}`)
    .join('; ');
}
