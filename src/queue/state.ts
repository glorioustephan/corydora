import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  RunState,
  ScanFinding,
  CorydoraConfig,
  TaskRecord,
  TaskStatus,
  TaskStore,
} from '../types/domain.js';

function createDedupeKey(finding: ScanFinding): string {
  return createHash('sha256')
    .update(
      [
        finding.category,
        finding.file,
        finding.title.trim().toLowerCase(),
        finding.rationale.trim().toLowerCase(),
      ].join('|'),
    )
    .digest('hex')
    .slice(0, 16);
}

function createTaskId(dedupeKey: string): string {
  return `task_${dedupeKey}`;
}

function tasksPath(projectRoot: string, config: CorydoraConfig): string {
  return resolve(projectRoot, config.paths.stateDir, 'tasks.json');
}

function runStatePath(projectRoot: string, config: CorydoraConfig): string {
  return resolve(projectRoot, config.paths.stateDir, 'run-state.json');
}

export async function loadTaskStore(
  projectRoot: string,
  config: CorydoraConfig,
): Promise<TaskStore> {
  const filePath = tasksPath(projectRoot, config);
  if (!existsSync(filePath)) {
    return { tasks: [] };
  }

  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as TaskStore;
  return Array.isArray(parsed.tasks) ? parsed : { tasks: [] };
}

export async function saveTaskStore(
  projectRoot: string,
  config: CorydoraConfig,
  store: TaskStore,
): Promise<void> {
  await writeFile(tasksPath(projectRoot, config), `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

export async function loadRunState(
  projectRoot: string,
  config: CorydoraConfig,
): Promise<RunState | null> {
  const filePath = runStatePath(projectRoot, config);
  if (!existsSync(filePath)) {
    return null;
  }

  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as RunState;
}

export async function saveRunState(
  projectRoot: string,
  config: CorydoraConfig,
  state: RunState,
): Promise<void> {
  await writeFile(runStatePath(projectRoot, config), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function mergeScanFindings(
  store: TaskStore,
  findings: ScanFinding[],
): {
  store: TaskStore;
  added: TaskRecord[];
} {
  const nextTasks = [...store.tasks];
  const added: TaskRecord[] = [];

  for (const finding of findings) {
    const dedupeKey = createDedupeKey(finding);
    const existing = nextTasks.find((task) => task.dedupeKey === dedupeKey);
    if (existing) {
      continue;
    }

    const timestamp = new Date().toISOString();
    const created: TaskRecord = {
      id: createTaskId(dedupeKey),
      category: finding.category,
      title: finding.title,
      file: finding.file,
      rationale: finding.rationale,
      validation: finding.validation,
      severity: finding.severity,
      effort: finding.effort,
      risk: finding.risk,
      status: 'pending',
      sourceAgent: finding.sourceAgent,
      dedupeKey,
      techLenses: finding.techLenses,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    nextTasks.push(created);
    added.push(created);
  }

  return {
    store: { tasks: nextTasks },
    added,
  };
}

export function claimNextTask(
  store: TaskStore,
  runId: string,
  allowBroadRisk: boolean,
): TaskRecord | null {
  const candidate = store.tasks.find((task) => {
    if (task.status !== 'pending') {
      return false;
    }

    if (!allowBroadRisk && task.risk === 'broad') {
      return false;
    }

    return task.effort === 'small' || task.effort === 'medium';
  });

  if (!candidate) {
    return null;
  }

  candidate.status = 'claimed';
  candidate.claimRunId = runId;
  candidate.updatedAt = new Date().toISOString();
  return candidate;
}

export function updateTaskStatus(
  store: TaskStore,
  taskId: string,
  status: TaskStatus,
  lastError?: string,
): TaskStore {
  return {
    tasks: store.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            status,
            updatedAt: new Date().toISOString(),
            ...(status === 'claimed' && task.claimRunId ? { claimRunId: task.claimRunId } : {}),
            ...(lastError ? { lastError } : {}),
          }
        : task,
    ),
  };
}

export function countTasksByStatus(store: TaskStore, status: TaskStatus): number {
  return store.tasks.filter((task) => task.status === status).length;
}
