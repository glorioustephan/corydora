import type { BUILTIN_TASK_CATEGORIES, RUNTIME_PROVIDER_IDS, TECH_LENSES } from '../constants.js';

export type TaskCategory = (typeof BUILTIN_TASK_CATEGORIES)[number];
export type TechLens = (typeof TECH_LENSES)[number];
export type RuntimeProviderId = (typeof RUNTIME_PROVIDER_IDS)[number];

export type TaskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type TaskEffort = 'small' | 'medium' | 'large';
export type TaskRisk = 'low' | 'medium' | 'broad';
export type TaskStatus = 'pending' | 'claimed' | 'done' | 'failed' | 'blocked';
export type GitIsolationMode = 'worktree' | 'branch' | 'current-branch';
export type RunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'stopped';
export type RunPhase = 'idle' | 'scan' | 'fix';

export interface CorydoraPaths {
  corydoraDir: string;
  stateDir: string;
  logsDir: string;
  runsDir: string;
  agentsDir: string;
  envFile: string;
}

export interface CorydoraConfig {
  version: 1;
  git: {
    isolationMode: GitIsolationMode;
    branchPrefix: string;
    trackMarkdownQueues: boolean;
    worktreeRoot?: string;
  };
  runtime: {
    provider: RuntimeProviderId;
    model: string;
    fallbackProvider?: RuntimeProviderId;
  };
  agents: {
    enabledCategories: TaskCategory[];
    selectedBuiltinAgents: string[];
    importedAgentDirectory?: string;
  };
  scan: {
    batchSize: number;
    maxConcurrentScans: number;
    allowBroadRisk: boolean;
    includeExtensions: string[];
    excludeDirectories: string[];
  };
  execution: {
    backgroundByDefault: boolean;
    maxFixesPerRun: number;
    maxRuntimeMinutes: number;
    backlogTarget: number;
    validateAfterFix: boolean;
  };
  todo: {
    trackMarkdownFiles: boolean;
    renderCompletedTasks: boolean;
  };
  paths: CorydoraPaths;
}

export interface AgentDefinition {
  id: string;
  label: string;
  description: string;
  categories: TaskCategory[];
  techLenses: TechLens[];
  prompt: string;
  source: 'builtin' | 'imported';
  originalPath?: string;
}

export interface ImportedAgentRecord extends AgentDefinition {
  importedAt: string;
}

export interface ProjectFingerprint {
  packageManager: 'pnpm' | 'npm' | 'yarn' | 'bun' | 'unknown';
  frameworks: string[];
  techLenses: TechLens[];
  packageCount: number;
  topLevelDirectories: string[];
}

export interface ScanFinding {
  category: TaskCategory;
  title: string;
  file: string;
  rationale: string;
  validation: string;
  severity: TaskSeverity;
  effort: TaskEffort;
  risk: TaskRisk;
  sourceAgent: string;
  techLenses: TechLens[];
}

export interface ScanResult {
  fileSummary: string;
  tasks: ScanFinding[];
  needsHumanReview: boolean;
  rawText?: string;
}

export interface FixResult {
  summary: string;
  validationSummary: string;
  changedFiles: string[];
  needsHumanReview: boolean;
  fileEdits?: Array<{
    path: string;
    content: string;
  }>;
  rawText?: string;
}

export interface TaskRecord {
  id: string;
  category: TaskCategory;
  title: string;
  file: string;
  rationale: string;
  validation: string;
  severity: TaskSeverity;
  effort: TaskEffort;
  risk: TaskRisk;
  status: TaskStatus;
  sourceAgent: string;
  dedupeKey: string;
  techLenses: TechLens[];
  createdAt: string;
  updatedAt: string;
  claimRunId?: string;
  lastError?: string;
}

export interface TaskStore {
  tasks: TaskRecord[];
}

export interface SchedulerState {
  groupOrder: string[];
  groupCursors: Record<string, number>;
  completedFiles: string[];
  failedFiles: string[];
}

export interface BackgroundSession {
  sessionName: string;
  launchCommand: string;
  launchedAt: string;
}

export interface RunState {
  runId: string;
  status: RunStatus;
  phase: RunPhase;
  repositoryRoot: string;
  workRoot: string;
  provider: RuntimeProviderId;
  model: string;
  isolationMode: GitIsolationMode;
  branchName?: string;
  baseBranch?: string;
  worktreePath?: string;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
  stopRequested: boolean;
  selectedFiles: string[];
  claimedTaskIds: string[];
  completedTaskIds: string[];
  consecutiveFailures: number;
  completedFixCount: number;
  scheduler: SchedulerState;
  background?: BackgroundSession;
}

export interface ProviderAuthStatus {
  status: 'ready' | 'missing' | 'unknown';
  message: string;
}

export interface RuntimeProbe {
  provider: RuntimeProviderId;
  label: string;
  installed: boolean;
  auth: ProviderAuthStatus;
  models: string[];
  recommended: boolean;
}

export interface DoctorCheck {
  id: string;
  ok: boolean;
  message: string;
}

export interface RuntimeExecutionContext {
  rootDir: string;
  workingDirectory: string;
  model: string;
  prompt: string;
  schema?: string;
  dryRun: boolean;
}

export interface RuntimeAdapter {
  readonly id: RuntimeProviderId;
  readonly label: string;
  readonly executionMode: 'native-agent' | 'single-file-json' | 'fake';
  probe(projectRoot: string): Promise<RuntimeProbe>;
  doctor(projectRoot: string): Promise<DoctorCheck[]>;
  suggestModels(): string[];
  executeScan(context: RuntimeExecutionContext): Promise<ScanResult>;
  executeFix(context: RuntimeExecutionContext): Promise<FixResult>;
}
