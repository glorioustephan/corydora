import { z } from 'zod';
import {
  CORYDORA_MODES,
  DEFAULT_BRANCH_PREFIX,
  DEFAULT_EXCLUDE_DIRECTORIES,
  DEFAULT_INCLUDE_EXTENSIONS,
  DEFAULT_MODELS,
  RUNTIME_PROVIDER_IDS,
  CORYDORA_DIR_NAME,
} from '../constants.js';
import type {
  GitIsolationMode,
  RuntimeProviderId,
  CorydoraConfig,
  TechLens,
  CorydoraMode,
  ModeProfileConfig,
} from '../types/domain.js';

const categorySchema = z.enum(['bugs', 'performance', 'tests', 'todo', 'features']);
const providerSchema = z.enum(RUNTIME_PROVIDER_IDS);
const isolationModeSchema = z.enum(['worktree', 'branch', 'current-branch']);
const modeSchema = z.enum(CORYDORA_MODES);

const runtimeStageSchema = z
  .object({
    provider: providerSchema.optional(),
    model: z.string().min(1).optional(),
    fallbackProvider: providerSchema.optional(),
    maxOutputTokens: z.number().int().positive().optional(),
    requestTimeoutMs: z.number().int().positive().optional(),
    maxRetries: z.number().int().min(0).optional(),
  })
  .default({});

const modeProfileSchema = z
  .object({
    agentIds: z.array(z.string().min(1)).optional(),
    categoryBias: z.array(categorySchema).optional(),
  })
  .default({});

function defaultModeProfiles(
  selectedBuiltinAgents: string[],
): Record<CorydoraMode, ModeProfileConfig> {
  return {
    auto: {},
    churn: {},
    clean: {
      agentIds: ['todo-triager', 'refactoring-engineer', 'bug-investigator'],
      categoryBias: ['todo', 'bugs', 'tests'],
    },
    refactor: {
      agentIds: ['refactoring-engineer', 'todo-triager', 'performance-engineer'],
      categoryBias: ['todo', 'performance', 'tests'],
    },
    performance: {
      agentIds: ['performance-engineer', 'database-reviewer', 'bug-investigator'],
      categoryBias: ['performance', 'bugs'],
    },
    linting: {
      agentIds: ['bug-investigator', 'test-hardener', 'refactoring-engineer'],
      categoryBias: ['bugs', 'tests', 'todo'],
    },
    documentation: {
      agentIds:
        selectedBuiltinAgents.length > 0
          ? selectedBuiltinAgents.slice(0, Math.min(3, selectedBuiltinAgents.length))
          : ['todo-triager', 'feature-scout'],
      categoryBias: ['todo', 'features', 'tests'],
    },
  };
}

function modeProfilesSchema(selectedBuiltinAgents: string[]) {
  const defaults = defaultModeProfiles(selectedBuiltinAgents);
  return z
    .object({
      auto: modeProfileSchema.optional(),
      churn: modeProfileSchema.optional(),
      clean: modeProfileSchema.optional(),
      refactor: modeProfileSchema.optional(),
      performance: modeProfileSchema.optional(),
      linting: modeProfileSchema.optional(),
      documentation: modeProfileSchema.optional(),
    })
    .default(defaults)
    .transform((profiles) => ({
      auto: profiles.auto ?? defaults.auto,
      churn: profiles.churn ?? defaults.churn,
      clean: profiles.clean ?? defaults.clean,
      refactor: profiles.refactor ?? defaults.refactor,
      performance: profiles.performance ?? defaults.performance,
      linting: profiles.linting ?? defaults.linting,
      documentation: profiles.documentation ?? defaults.documentation,
    }));
}

function buildSchema(selectedBuiltinAgents: string[]) {
  return z.object({
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
      maxOutputTokens: z.number().int().positive(),
      requestTimeoutMs: z.number().int().positive(),
      maxRetries: z.number().int().min(0),
      stages: z
        .object({
          analyze: runtimeStageSchema,
          fix: runtimeStageSchema,
          summary: runtimeStageSchema,
        })
        .default({
          analyze: {},
          fix: {},
          summary: {},
        }),
    }),
    modes: z
      .object({
        default: modeSchema.default('auto'),
        profiles: modeProfilesSchema(selectedBuiltinAgents),
      })
      .default({
        default: 'auto',
        profiles: defaultModeProfiles(selectedBuiltinAgents),
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
      preventIdleSleep: z.boolean(),
      maxFixesPerRun: z.number().int().positive(),
      maxRuntimeMinutes: z.number().int().positive(),
      backlogTarget: z.number().int().positive(),
      validateAfterFix: z.boolean(),
      maxAnalyzeWorkers: z.number().int().positive().default(2),
      maxFixWorkers: z.number().int().positive().default(1),
      maxAttempts: z.number().int().positive().default(3),
      leaseTtlMinutes: z.number().int().positive().default(15),
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
}

export function parseCorydoraConfig(raw: unknown): CorydoraConfig {
  const rawObject = (raw ?? {}) as {
    agents?: {
      selectedBuiltinAgents?: string[];
    };
  };
  const selectedBuiltinAgents = rawObject.agents?.selectedBuiltinAgents ?? ['bug-investigator'];
  return buildSchema(selectedBuiltinAgents).parse(raw) as CorydoraConfig;
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
  const selectedBuiltinAgents =
    options.selectedBuiltinAgents.length > 0 ? options.selectedBuiltinAgents : ['bug-investigator'];

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
      maxOutputTokens: 8192,
      requestTimeoutMs: 900_000,
      maxRetries: 3,
      stages: {
        analyze: {},
        fix: {},
        summary: {},
      },
    },
    modes: {
      default: 'auto',
      profiles: defaultModeProfiles(selectedBuiltinAgents),
    },
    agents: {
      enabledCategories: ['bugs', 'performance', 'tests', 'todo', 'features'],
      selectedBuiltinAgents,
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
      preventIdleSleep: true,
      maxFixesPerRun: 20,
      maxRuntimeMinutes: 480,
      backlogTarget: 8,
      validateAfterFix: true,
      maxAnalyzeWorkers: 2,
      maxFixWorkers: 1,
      maxAttempts: 3,
      leaseTtlMinutes: 15,
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
