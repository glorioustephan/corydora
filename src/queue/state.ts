import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  CorydoraConfig,
  FileRecord,
  FileStatus,
  FileStore,
  HandoffPacket,
  RunEvent,
  RunState,
  ScanFinding,
  TaskRecord,
  TaskStatus,
  TaskStore,
  ValidationResult,
} from '../types/domain.js';

function createDedupeKey(finding: ScanFinding): string {
  return createHash('sha256')
    .update(
      [
        finding.category,
        finding.file,
        (finding.targetFiles ?? [finding.file]).join(','),
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

export function createFileId(filePath: string): string {
  return `file_${createHash('sha1').update(filePath).digest('hex').slice(0, 12)}`;
}

export function createSnapshotHash(contents: string): string {
  return createHash('sha256').update(contents).digest('hex').slice(0, 16);
}

function tasksPath(projectRoot: string, config: CorydoraConfig): string {
  return resolve(projectRoot, config.paths.stateDir, 'tasks.json');
}

function filesPath(projectRoot: string, config: CorydoraConfig): string {
  return resolve(projectRoot, config.paths.stateDir, 'files.json');
}

function runStatePath(projectRoot: string, config: CorydoraConfig): string {
  return resolve(projectRoot, config.paths.stateDir, 'run-state.json');
}

function eventsPath(projectRoot: string, config: CorydoraConfig): string {
  return resolve(projectRoot, config.paths.stateDir, 'events.ndjson');
}

function nowIso(): string {
  return new Date().toISOString();
}

function readBackoffDelayMs(attemptCount: number): number {
  return Math.min(60_000 * 2 ** Math.max(0, attemptCount - 1), 30 * 60_000);
}

function isEligible(nextEligibleAt: string | undefined, now: Date): boolean {
  if (!nextEligibleAt) {
    return true;
  }

  return new Date(nextEligibleAt) <= now;
}

function updateFileStatus(
  file: FileRecord,
  status: FileStatus,
  updates: Partial<FileRecord> = {},
): FileRecord {
  return {
    ...file,
    status,
    updatedAt: nowIso(),
    ...updates,
  };
}

function updateTaskStatus(
  task: TaskRecord,
  status: TaskStatus,
  updates: Partial<TaskRecord> = {},
): TaskRecord {
  return {
    ...task,
    status,
    updatedAt: nowIso(),
    ...updates,
  };
}

async function readJsonIfPresent<T>(filePath: string, fallback: T): Promise<T> {
  if (!existsSync(filePath)) {
    return fallback;
  }

  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

export async function loadTaskStore(
  projectRoot: string,
  config: CorydoraConfig,
): Promise<TaskStore> {
  const parsed = await readJsonIfPresent<TaskStore>(tasksPath(projectRoot, config), { tasks: [] });
  return Array.isArray(parsed.tasks) ? parsed : { tasks: [] };
}

export async function saveTaskStore(
  projectRoot: string,
  config: CorydoraConfig,
  store: TaskStore,
): Promise<void> {
  await writeFile(tasksPath(projectRoot, config), `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

export async function loadFileStore(
  projectRoot: string,
  config: CorydoraConfig,
): Promise<FileStore> {
  const parsed = await readJsonIfPresent<FileStore>(filesPath(projectRoot, config), { files: [] });
  return Array.isArray(parsed.files) ? parsed : { files: [] };
}

export async function saveFileStore(
  projectRoot: string,
  config: CorydoraConfig,
  store: FileStore,
): Promise<void> {
  await writeFile(filesPath(projectRoot, config), `${JSON.stringify(store, null, 2)}\n`, 'utf8');
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

function runArtifactPath(projectRoot: string, config: CorydoraConfig, runId: string): string {
  return resolve(projectRoot, config.paths.runsDir, `${runId}.json`);
}

export async function saveRunArtifact(
  projectRoot: string,
  config: CorydoraConfig,
  state: RunState,
): Promise<void> {
  await writeFile(
    runArtifactPath(projectRoot, config, state.runId),
    `${JSON.stringify(state, null, 2)}\n`,
    'utf8',
  );
}

export async function appendRunEvent(
  projectRoot: string,
  config: CorydoraConfig,
  event: RunEvent,
): Promise<void> {
  await appendFile(eventsPath(projectRoot, config), `${JSON.stringify(event)}\n`, 'utf8');
}

export function reconcileFileStore(existing: FileStore, nextFiles: FileStore): FileStore {
  const byPath = new Map(existing.files.map((file) => [file.path, file] as const));
  const merged = nextFiles.files.map((file) => {
    const current = byPath.get(file.path);
    if (!current) {
      return file;
    }

    const shouldRequeue =
      current.snapshotHash !== file.snapshotHash &&
      ['analyzed', 'deferred', 'manual'].includes(current.status);

    return {
      ...file,
      status: shouldRequeue ? 'queued' : current.status,
      createdAt: current.createdAt,
      updatedAt: file.updatedAt,
      attemptCount: shouldRequeue ? 0 : current.attemptCount,
      nextEligibleAt: shouldRequeue ? undefined : current.nextEligibleAt,
      lastError: shouldRequeue ? undefined : current.lastError,
      leaseOwner: shouldRequeue ? undefined : current.leaseOwner,
      leaseExpiresAt: shouldRequeue ? undefined : current.leaseExpiresAt,
      analysisStrategy: current.analysisStrategy === 'tooling' ? 'tooling' : file.analysisStrategy,
    };
  });

  return { files: merged };
}

export function reclaimExpiredFileLeases(store: FileStore, now: Date = new Date()): FileStore {
  return {
    files: store.files.map((file) => {
      if (file.status === 'leased' && file.leaseExpiresAt && new Date(file.leaseExpiresAt) <= now) {
        return updateFileStatus(file, 'queued', {
          leaseOwner: undefined,
          leaseExpiresAt: undefined,
          nextEligibleAt: undefined,
        });
      }

      return file;
    }),
  };
}

export function reclaimExpiredTaskLeases(store: TaskStore, now: Date = new Date()): TaskStore {
  return {
    tasks: store.tasks.map((task) => {
      if (
        (task.status === 'leased' || task.status === 'applying' || task.status === 'validating') &&
        task.leaseExpiresAt &&
        new Date(task.leaseExpiresAt) <= now
      ) {
        return updateTaskStatus(task, 'queued', {
          leaseOwner: undefined,
          leaseExpiresAt: undefined,
          nextEligibleAt: undefined,
        });
      }

      return task;
    }),
  };
}

export function leaseFilesForAnalysis(options: {
  store: FileStore;
  runId: string;
  maxCount: number;
  leaseTtlMs: number;
  now?: Date;
}): {
  store: FileStore;
  leased: FileRecord[];
} {
  const now = options.now ?? new Date();
  const eligible = options.store.files
    .filter(
      (file) =>
        (file.status === 'queued' || file.status === 'deferred') &&
        isEligible(file.nextEligibleAt, now),
    )
    .sort((left, right) => right.score.total - left.score.total)
    .slice(0, options.maxCount);
  const leasedIds = new Set(eligible.map((file) => file.id));
  const leaseExpiresAt = new Date(now.getTime() + options.leaseTtlMs).toISOString();

  return {
    leased: eligible.map((file) => ({
      ...file,
      status: 'leased',
      leaseOwner: options.runId,
      leaseExpiresAt,
      updatedAt: now.toISOString(),
    })),
    store: {
      files: options.store.files.map((file) =>
        leasedIds.has(file.id)
          ? updateFileStatus(file, 'leased', {
              leaseOwner: options.runId,
              leaseExpiresAt,
            })
          : file,
      ),
    },
  };
}

export function noteFileAnalyzed(
  store: FileStore,
  fileId: string,
  updates: Partial<FileRecord> = {},
): FileStore {
  return {
    files: store.files.map((file) =>
      file.id === fileId
        ? updateFileStatus(file, 'analyzed', {
            leaseOwner: undefined,
            leaseExpiresAt: undefined,
            nextEligibleAt: undefined,
            lastError: undefined,
            ...updates,
          })
        : file,
    ),
  };
}

export function noteFileRetry(options: {
  store: FileStore;
  fileId: string;
  error: string;
  maxAttempts: number;
  manual?: boolean;
  now?: Date;
}): FileStore {
  const now = options.now ?? new Date();
  return {
    files: options.store.files.map((file) => {
      if (file.id !== options.fileId) {
        return file;
      }

      const attemptCount = file.attemptCount + 1;
      if (options.manual) {
        return updateFileStatus(file, 'manual', {
          attemptCount,
          lastError: options.error,
          leaseOwner: undefined,
          leaseExpiresAt: undefined,
          nextEligibleAt: undefined,
        });
      }

      const nextStatus: FileStatus = attemptCount >= options.maxAttempts ? 'deferred' : 'queued';
      return updateFileStatus(file, nextStatus, {
        attemptCount,
        lastError: options.error,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        nextEligibleAt:
          nextStatus === 'queued'
            ? new Date(now.getTime() + readBackoffDelayMs(attemptCount)).toISOString()
            : new Date(now.getTime() + readBackoffDelayMs(attemptCount)).toISOString(),
      });
    }),
  };
}

export function mergeScanFindings(
  store: TaskStore,
  findings: ScanFinding[],
  snapshotHash: string,
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

    const timestamp = nowIso();
    const targetFiles =
      finding.targetFiles && finding.targetFiles.length > 0
        ? finding.targetFiles.slice(0, 3)
        : [finding.file];
    const handoff: HandoffPacket = {
      taskId: createTaskId(dedupeKey),
      targetFiles,
      title: finding.title,
      rationale: finding.rationale,
      evidence:
        finding.evidence && finding.evidence.length > 0
          ? finding.evidence.slice(0, 3)
          : [
              {
                file: finding.file,
                startLine: 1,
                endLine: 1,
                note: 'No evidence provided.',
              },
            ],
      validationHint: finding.validation,
      confidence: finding.confidence ?? 0.5,
      snapshotHash,
    };
    const created: TaskRecord = {
      id: handoff.taskId,
      category: finding.category,
      title: finding.title,
      file: finding.file,
      targetFiles: handoff.targetFiles,
      rationale: finding.rationale,
      validation: finding.validation,
      severity: finding.severity,
      effort: finding.effort,
      risk: finding.risk,
      status: 'queued',
      sourceAgent: finding.sourceAgent,
      dedupeKey,
      techLenses: finding.techLenses,
      createdAt: timestamp,
      updatedAt: timestamp,
      attemptCount: 0,
      snapshotHash,
      handoff,
    };
    nextTasks.push(created);
    added.push(created);
  }

  return {
    store: { tasks: nextTasks },
    added,
  };
}

export function leaseTasksForFix(options: {
  store: TaskStore;
  runId: string;
  maxCount: number;
  leaseTtlMs: number;
  allowBroadRisk: boolean;
  now?: Date;
}): {
  store: TaskStore;
  leased: TaskRecord[];
} {
  const now = options.now ?? new Date();
  const eligible = options.store.tasks
    .filter((task) => {
      if (!['queued', 'deferred'].includes(task.status)) {
        return false;
      }

      if (!options.allowBroadRisk && task.risk === 'broad') {
        return false;
      }

      if (!isEligible(task.nextEligibleAt, now)) {
        return false;
      }

      return task.effort === 'small' || task.effort === 'medium';
    })
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(0, options.maxCount);
  const leasedIds = new Set(eligible.map((task) => task.id));
  const leaseExpiresAt = new Date(now.getTime() + options.leaseTtlMs).toISOString();

  return {
    leased: eligible.map((task) => ({
      ...task,
      status: 'leased',
      claimRunId: options.runId,
      leaseOwner: options.runId,
      leaseExpiresAt,
      updatedAt: now.toISOString(),
    })),
    store: {
      tasks: options.store.tasks.map((task) =>
        leasedIds.has(task.id)
          ? updateTaskStatus(task, 'leased', {
              claimRunId: options.runId,
              leaseOwner: options.runId,
              leaseExpiresAt,
            })
          : task,
      ),
    },
  };
}

export function noteTaskProgress(
  store: TaskStore,
  taskId: string,
  status: Extract<TaskStatus, 'applying' | 'validating'>,
): TaskStore {
  return {
    tasks: store.tasks.map((task) =>
      task.id === taskId
        ? updateTaskStatus(task, status, {
            leaseOwner: task.leaseOwner,
            leaseExpiresAt: task.leaseExpiresAt,
          })
        : task,
    ),
  };
}

export function noteTaskCompleted(
  store: TaskStore,
  taskId: string,
  validationResult: ValidationResult,
): TaskStore {
  return {
    tasks: store.tasks.map((task) =>
      task.id === taskId
        ? updateTaskStatus(task, 'done', {
            validationResult,
            leaseOwner: undefined,
            leaseExpiresAt: undefined,
            nextEligibleAt: undefined,
            lastError: undefined,
          })
        : task,
    ),
  };
}

export function noteTaskRetry(options: {
  store: TaskStore;
  taskId: string;
  error: string;
  maxAttempts: number;
  blocked?: boolean;
  manual?: boolean;
  validationResult?: ValidationResult;
  now?: Date;
}): TaskStore {
  const now = options.now ?? new Date();
  return {
    tasks: options.store.tasks.map((task) => {
      if (task.id !== options.taskId) {
        return task;
      }

      const attemptCount = task.attemptCount + 1;
      if (options.manual) {
        return updateTaskStatus(task, 'manual', {
          attemptCount,
          lastError: options.error,
          validationResult: options.validationResult,
          leaseOwner: undefined,
          leaseExpiresAt: undefined,
        });
      }

      const nextStatus: TaskStatus =
        options.blocked === true
          ? 'blocked'
          : attemptCount >= options.maxAttempts
            ? 'deferred'
            : 'queued';
      return updateTaskStatus(task, nextStatus, {
        attemptCount,
        lastError: options.error,
        validationResult: options.validationResult,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        nextEligibleAt:
          nextStatus === 'queued'
            ? new Date(now.getTime() + readBackoffDelayMs(attemptCount)).toISOString()
            : new Date(now.getTime() + readBackoffDelayMs(attemptCount)).toISOString(),
      });
    }),
  };
}

export function countTasksByStatus(store: TaskStore, status: TaskStatus): number {
  return store.tasks.filter((task) => task.status === status).length;
}

export function countFilesByStatus(store: FileStore, status: FileStatus): number {
  return store.files.filter((file) => file.status === status).length;
}
