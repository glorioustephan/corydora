import { z } from 'zod';
import {
  DEFAULT_BRANCH_PREFIX,
  DEFAULT_EXCLUDE_DIRECTORIES,
  DEFAULT_INCLUDE_EXTENSIONS,
  DEFAULT_MODELS,
  RUNTIME_PROVIDER_IDS,
  CORYDORA_DIR_NAME,
  TECH_LENSES,
} from '../constants.js';
import type { GitIsolationMode, RuntimeProviderId, CorydoraConfig, TechLens } from '../types/domain.js';

const categorySchema = z.enum(['bugs', 'performance', 'tests', 'todo', 'features']);
const techLensSchema = z.enum(TECH_LENSES);
const providerSchema = z.enum(RUNTIME_PROVIDER_IDS);
const isolationModeSchema = z.enum(['worktree', 'branch', 'current-branch']);

export const corydoraConfigSchema = z.object({
  version: z.literal(1),
  git: z.object({
    isolationMode: isolationModeSchema,
    branchPrefix: z.string().min(1),
    trackMarkdownQueues: z.boolean(),
    worktreeRoot: z.string().min(1).optional(),
  }),
  runtime: z.object({
    provider: providerSchema,
    model: z.string().min(1),
    fallbackProvider: providerSchema.optional(),
  }),
  agents: z.object({
    enabledCategories: z.array(categorySchema).min(1),
    selectedBuiltinAgents: z.array(z.string().min(1)).min(1),
    importedAgentDirectory: z.string().min(1).optional(),
  }),
  scan: z.object({
    batchSize: z.number().int().positive(),
    maxConcurrentScans: z.number().int().positive(),
    allowBroadRisk: z.boolean(),
    includeExtensions: z.array(z.string().min(1)).min(1),
    excludeDirectories: z.array(z.string().min(1)),
  }),
  execution: z.object({
    backgroundByDefault: z.boolean(),
    maxFixesPerRun: z.number().int().positive(),
    maxRuntimeMinutes: z.number().int().positive(),
    backlogTarget: z.number().int().positive(),
    validateAfterFix: z.boolean(),
  }),
  todo: z.object({
    trackMarkdownFiles: z.boolean(),
    renderCompletedTasks: z.boolean(),
  }),
  paths: z.object({
    corydoraDir: z.string().min(1),
    stateDir: z.string().min(1),
    logsDir: z.string().min(1),
    runsDir: z.string().min(1),
    agentsDir: z.string().min(1),
    envFile: z.string().min(1),
  }),
});

export function parseCorydoraConfig(raw: unknown): CorydoraConfig {
  return corydoraConfigSchema.parse(raw) as CorydoraConfig;
}

export function getDefaultModel(provider: RuntimeProviderId): string {
  return DEFAULT_MODELS[provider] ?? 'sonnet';
}

export function getDefaultConfig(options: {
  provider: RuntimeProviderId;
  projectRoot?: string;
  isolationMode?: GitIsolationMode;
  model?: string;
  selectedBuiltinAgents: string[];
  trackMarkdownQueues?: boolean;
  backgroundByDefault?: boolean;
}): CorydoraConfig {
  const corydoraDir = CORYDORA_DIR_NAME;
  return {
    version: 1,
    git: {
      isolationMode: options.isolationMode ?? 'worktree',
      branchPrefix: DEFAULT_BRANCH_PREFIX,
      trackMarkdownQueues: options.trackMarkdownQueues ?? false,
    },
    runtime: {
      provider: options.provider,
      model: options.model ?? getDefaultModel(options.provider),
    },
    agents: {
      enabledCategories: ['bugs', 'performance', 'tests', 'todo', 'features'],
      selectedBuiltinAgents: options.selectedBuiltinAgents,
    },
    scan: {
      batchSize: 6,
      maxConcurrentScans: 3,
      allowBroadRisk: false,
      includeExtensions: [...DEFAULT_INCLUDE_EXTENSIONS],
      excludeDirectories: [...DEFAULT_EXCLUDE_DIRECTORIES],
    },
    execution: {
      backgroundByDefault: options.backgroundByDefault ?? false,
      maxFixesPerRun: 20,
      maxRuntimeMinutes: 480,
      backlogTarget: 8,
      validateAfterFix: true,
    },
    todo: {
      trackMarkdownFiles: false,
      renderCompletedTasks: true,
    },
    paths: {
      corydoraDir,
      stateDir: `${corydoraDir}/state`,
      logsDir: `${corydoraDir}/logs`,
      runsDir: `${corydoraDir}/runs`,
      agentsDir: `${corydoraDir}/agents`,
      envFile: `${corydoraDir}/.env.local`,
    },
  };
}

export function selectTechLensesForConfig(projectTechLenses: TechLens[]): TechLens[] {
  return projectTechLenses.length > 0 ? projectTechLenses : ['typescript', 'refactoring'];
}
