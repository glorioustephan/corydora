import type {
  BUILTIN_TASK_CATEGORIES,
  CORYDORA_MODES,
  RUNTIME_PROVIDER_IDS,
  TECH_LENSES,
} from '../constants.js';

export type TaskCategory = (typeof BUILTIN_TASK_CATEGORIES)[number];
export type TechLens = (typeof TECH_LENSES)[number];
export type RuntimeProviderId = (typeof RUNTIME_PROVIDER_IDS)[number];
export type CorydoraMode = (typeof CORYDORA_MODES)[number];

export type TaskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type TaskEffort = 'small' | 'medium' | 'large';
export type TaskRisk = 'low' | 'medium' | 'broad';
export type FileStatus = 'queued' | 'leased' | 'analyzed' | 'deferred' | 'manual';
export type TaskStatus =
  | 'queued'
  | 'leased'
  | 'applying'
  | 'validating'
  | 'done'
  | 'deferred'
  | 'blocked'
  | 'manual';
export type GitIsolationMode = 'worktree' | 'branch' | 'current-branch';
export type RunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'stopped';
export type RunPhase = 'idle' | 'analyze' | 'fix' | 'summary';
export type ValidationStatus = 'passed' | 'failed' | 'skipped';
export type WorkerKind = 'analyze' | 'fix';
export type WorkerStatus = 'idle' | 'running' | 'waiting';
export type RuntimeStageName = 'analyze' | 'fix' | 'summary';

export interface CorydoraPaths {
  corydoraDir: string;
  stateDir: string;
  logsDir: string;
  runsDir: string;
  agentsDir: string;
  envFile: string;
}

export interface RuntimeRequestSettings {
  maxOutputTokens: number;
  requestTimeoutMs: number;
  maxRetries: number;
}

export interface RuntimeStageConfig extends Partial<RuntimeRequestSettings> {
  provider?: RuntimeProviderId | undefined;
  model?: string | undefined;
  fallbackProvider?: RuntimeProviderId | undefined;
}

export interface RuntimeStagesConfig {
  analyze: RuntimeStageConfig;
  fix: RuntimeStageConfig;
  summary: RuntimeStageConfig;
}

export interface ModeProfileConfig {
  agentIds?: string[];
  categoryBias?: TaskCategory[];
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
    fallbackProvider?: RuntimeProviderId | undefined;
    stages: RuntimeStagesConfig;
  } & RuntimeRequestSettings;
  modes: {
    default: CorydoraMode;
    profiles: Record<CorydoraMode, ModeProfileConfig>;
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
    preventIdleSleep: boolean;
    maxFixesPerRun: number;
    maxRuntimeMinutes: number;
    backlogTarget: number;
    validateAfterFix: boolean;
    maxAnalyzeWorkers: number;
    maxFixWorkers: number;
    maxAttempts: number;
    leaseTtlMinutes: number;
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
  originalPath?: string | undefined;
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

export interface EvidenceSpan {
  file: string;
  startLine: number;
  endLine: number;
  note: string;
}

export interface HandoffPacket {
  taskId: string;
  targetFiles: string[];
  title: string;
  rationale: string;
  evidence: EvidenceSpan[];
  validationHint: string;
  confidence: number;
  snapshotHash: string;
}

export interface ScanFinding {
  category: TaskCategory;
  title: string;
  file: string;
  targetFiles: string[];
  rationale: string;
  validation: string;
  severity: TaskSeverity;
  effort: TaskEffort;
  risk: TaskRisk;
  sourceAgent: string;
  techLenses: TechLens[];
  evidence: EvidenceSpan[];
  confidence: number;
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

export interface ValidationResult {
  status: ValidationStatus;
  command?: string | undefined;
  summary: string;
}

export interface TaskRecord {
  id: string;
  category: TaskCategory;
  title: string;
  file: string;
  targetFiles: string[];
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
  claimRunId?: string | undefined;
  lastError?: string | undefined;
  attemptCount: number;
  nextEligibleAt?: string | undefined;
  leaseOwner?: string | undefined;
  leaseExpiresAt?: string | undefined;
  snapshotHash: string;
  handoff: HandoffPacket;
  validationResult?: ValidationResult | undefined;
}

export interface TaskStore {
  tasks: TaskRecord[];
}

export interface FileScoreBreakdown {
  priority: number;
  gitTouches: number;
  recency: number;
  size: number;
  currentDiff: number;
  deferredTaskWeight: number;
  total: number;
}

export interface FileWindow {
  startLine: number;
  endLine: number;
  reason: string;
}

export interface FileRecord {
  id: string;
  path: string;
  group: string;
  mode: CorydoraMode;
  status: FileStatus;
  createdAt: string;
  updatedAt: string;
  attemptCount: number;
  nextEligibleAt?: string | undefined;
  lastError?: string | undefined;
  leaseOwner?: string | undefined;
  leaseExpiresAt?: string | undefined;
  snapshotHash: string;
  lineCount: number;
  estimatedTokens: number;
  changedInWorktree: boolean;
  gitTouchCount: number;
  lastTouchedAt?: string | undefined;
  score: FileScoreBreakdown;
  analysisStrategy: 'full' | 'windowed' | 'tooling';
  windows: FileWindow[];
}

export interface FileStore {
  files: FileRecord[];
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
  keepAwake?: boolean | undefined;
}

export interface WorkerState {
  id: string;
  kind: WorkerKind;
  status: WorkerStatus;
  targetId?: string | undefined;
  startedAt?: string | undefined;
  details?: string | undefined;
}

export interface RunEvent {
  runId: string;
  at: string;
  type: string;
  stage: RunPhase | RuntimeStageName;
  message: string;
  itemId?: string | undefined;
  itemPath?: string | undefined;
  metadata?: Record<string, string | number | boolean | null> | undefined;
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
  effectiveIsolationMode: GitIsolationMode;
  mode: CorydoraMode;
  selectedAgentIds: string[];
  branchName?: string | undefined;
  baseBranch?: string | undefined;
  worktreePath?: string | undefined;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string | undefined;
  stopRequested: boolean;
  claimedTaskIds: string[];
  completedTaskIds: string[];
  consecutiveFailures: number;
  completedFixCount: number;
  filesPath: string;
  workers: WorkerState[];
  summary?: string | undefined;
  background?: BackgroundSession | undefined;
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
  schema?: string | undefined;
  dryRun: boolean;
  settings: RuntimeRequestSettings;
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
