import {
  confirm,
  intro,
  isCancel,
  multiselect,
  outro,
  select,
  spinner,
  text,
} from '@clack/prompts';
import { BUILTIN_AGENTS } from '../agents/builtin-agents.js';
import { loadConfig, saveConfig, ensureCorydoraStructure } from '../config/files.js';
import { getDefaultConfig } from '../config/schema.js';
import { BUILTIN_TASK_CATEGORIES, CONFIG_FILE_NAME } from '../constants.js';
import { appendGitignoreEntries, findMissingGitignoreEntries } from '../filesystem/gitignore.js';
import { detectProjectFingerprint } from '../filesystem/project.js';
import { probeAvailableRuntimes } from '../providers/index.js';
import { configExists } from './helpers.js';
import type { CorydoraConfig, RuntimeProviderId, TaskCategory } from '../types/domain.js';
import type { Ui } from '../ui/output.js';

function selectBuiltinAgents(projectTechLenses: string[]): string[] {
  const matching = BUILTIN_AGENTS.filter((agent) =>
    agent.techLenses.some((lens) => projectTechLenses.includes(lens)),
  );
  return (matching.length > 0 ? matching : BUILTIN_AGENTS).map((agent) => agent.id);
}

function categoriesForBuiltinAgents(selectedBuiltinAgents: string[]): TaskCategory[] {
  const categories = new Set<TaskCategory>();

  for (const agent of BUILTIN_AGENTS) {
    if (!selectedBuiltinAgents.includes(agent.id)) {
      continue;
    }

    for (const category of agent.categories) {
      categories.add(category);
    }
  }

  const ordered = BUILTIN_TASK_CATEGORIES.filter((category) => categories.has(category));
  return ordered.length > 0 ? [...ordered] : ['bugs'];
}

function mergeInitConfig(options: {
  existingConfig: CorydoraConfig | null;
  provider: RuntimeProviderId;
  model: string;
  isolationMode: CorydoraConfig['git']['isolationMode'];
  trackMarkdownQueues: boolean;
  backgroundByDefault: boolean;
  selectedBuiltinAgents: string[];
  enabledCategories: TaskCategory[];
}): CorydoraConfig {
  const baseConfig =
    options.existingConfig ??
    getDefaultConfig({
      provider: options.provider,
      model: options.model,
      isolationMode: options.isolationMode,
      selectedBuiltinAgents: options.selectedBuiltinAgents,
      trackMarkdownQueues: options.trackMarkdownQueues,
      backgroundByDefault: options.backgroundByDefault,
    });

  return {
    ...baseConfig,
    git: {
      ...baseConfig.git,
      isolationMode: options.isolationMode,
      trackMarkdownQueues: options.trackMarkdownQueues,
    },
    runtime: {
      ...baseConfig.runtime,
      provider: options.provider,
      model: options.model,
    },
    agents: {
      ...baseConfig.agents,
      selectedBuiltinAgents: options.selectedBuiltinAgents,
      enabledCategories: options.enabledCategories,
    },
    execution: {
      ...baseConfig.execution,
      backgroundByDefault: options.backgroundByDefault,
    },
  };
}

function formatGitignoreGuidance(entries: string[]): string {
  return [
    'Corydora did not modify `.gitignore`.',
    'Add these entries yourself if you want generated files ignored:',
    ...entries.map((entry) => `- ${entry}`),
  ].join('\n');
}

export interface InitCommandOptions {
  projectRoot: string;
  json: boolean;
  yes?: boolean;
}

export async function runInitCommand(options: InitCommandOptions, ui: Ui): Promise<void> {
  const hasExistingConfig = configExists(options.projectRoot);
  const existingConfig = hasExistingConfig ? await loadConfig(options.projectRoot) : null;
  const fingerprint = detectProjectFingerprint(options.projectRoot);
  const runtimeProbes = (await probeAvailableRuntimes(options.projectRoot)).filter(
    (probe) => probe.provider !== 'fake',
  );
  const recommendedRuntime =
    runtimeProbes.find((probe) => probe.recommended)?.provider ??
    runtimeProbes.find((probe) => probe.installed)?.provider ??
    'claude-cli';
  const detectedBuiltinAgents = selectBuiltinAgents(fingerprint.techLenses);
  const interactive = !options.yes && !options.json && process.stdout.isTTY;

  if (interactive) {
    intro('Corydora init');
  }

  if (interactive) {
    const loading = spinner();
    loading.start('Detecting runtimes and project shape');
    loading.stop(
      `Detected ${runtimeProbes.length} runtimes and ${fingerprint.frameworks.length} framework(s).`,
    );
  }

  let provider: RuntimeProviderId =
    existingConfig?.runtime.provider ?? (recommendedRuntime as RuntimeProviderId);
  let model =
    existingConfig?.runtime.model ??
    runtimeProbes.find((probe) => probe.provider === provider)?.models[0] ??
    getDefaultConfig({
      provider,
      selectedBuiltinAgents: ['bug-investigator'],
    }).runtime.model;
  let isolationMode: 'worktree' | 'branch' | 'current-branch' =
    existingConfig?.git.isolationMode ?? 'worktree';
  let trackMarkdownQueues = existingConfig?.git.trackMarkdownQueues ?? false;
  let backgroundByDefault = existingConfig?.execution.backgroundByDefault ?? false;
  const selectedBuiltinAgents =
    existingConfig?.agents.selectedBuiltinAgents ?? detectedBuiltinAgents;
  let enabledCategories =
    existingConfig?.agents.enabledCategories ?? categoriesForBuiltinAgents(selectedBuiltinAgents);

  if (interactive) {
    const providerSelection = await select({
      message: 'Choose the default runtime',
      options: runtimeProbes.map((probe) => ({
        value: probe.provider,
        label: `${probe.label} (${probe.auth.status})`,
        hint: probe.auth.message,
      })),
      initialValue: provider,
    });
    if (isCancel(providerSelection)) {
      throw new Error('Init cancelled.');
    }
    provider = providerSelection as RuntimeProviderId;

    const modelInput = await text({
      message: 'Default model',
      initialValue: model,
      placeholder: model,
    });
    if (isCancel(modelInput)) {
      throw new Error('Init cancelled.');
    }
    model = String(modelInput);

    const isolationSelection = await select({
      message: 'Default git isolation mode',
      options: [
        { value: 'worktree', label: 'Dedicated worktree' },
        { value: 'branch', label: 'New branch in the current checkout' },
        { value: 'current-branch', label: 'Current branch (explicit opt-in)' },
      ],
      initialValue: isolationMode,
    });
    if (isCancel(isolationSelection)) {
      throw new Error('Init cancelled.');
    }
    isolationMode = isolationSelection as typeof isolationMode;

    const categorySelection = await multiselect<TaskCategory>({
      message: 'Choose which task categories Corydora may scan for',
      options: BUILTIN_TASK_CATEGORIES.map((category) => ({
        value: category,
        label: category.charAt(0).toUpperCase() + category.slice(1),
      })),
      initialValues: enabledCategories,
      required: true,
    });
    if (isCancel(categorySelection)) {
      throw new Error('Init cancelled.');
    }
    enabledCategories = [...categorySelection];

    const trackQueuesAnswer = await confirm({
      message: 'Track markdown queue files in git?',
      initialValue: trackMarkdownQueues,
    });
    if (isCancel(trackQueuesAnswer)) {
      throw new Error('Init cancelled.');
    }
    trackMarkdownQueues = Boolean(trackQueuesAnswer);

    const backgroundAnswer = await confirm({
      message: 'Launch long runs in the background by default?',
      initialValue: backgroundByDefault,
    });
    if (isCancel(backgroundAnswer)) {
      throw new Error('Init cancelled.');
    }
    backgroundByDefault = Boolean(backgroundAnswer);
  }

  const config = mergeInitConfig({
    existingConfig,
    provider,
    model,
    isolationMode,
    trackMarkdownQueues,
    backgroundByDefault,
    selectedBuiltinAgents,
    enabledCategories,
  });

  await saveConfig(options.projectRoot, config);
  await ensureCorydoraStructure(options.projectRoot, config);

  const missingGitignoreEntries = await findMissingGitignoreEntries(
    options.projectRoot,
    config.git.trackMarkdownQueues,
  );

  let gitignoreUpdated = false;
  if (interactive && missingGitignoreEntries.length > 0) {
    const updateGitignoreAnswer = await confirm({
      message: 'Append recommended Corydora entries to `.gitignore`?',
      initialValue: false,
    });
    if (isCancel(updateGitignoreAnswer)) {
      throw new Error('Init cancelled.');
    }

    if (updateGitignoreAnswer) {
      gitignoreUpdated = await appendGitignoreEntries(options.projectRoot, missingGitignoreEntries);
    }
  }

  const payload = {
    projectRoot: options.projectRoot,
    provider,
    model,
    isolationMode,
    enabledCategories,
    fingerprint,
    gitignore: {
      modified: gitignoreUpdated,
      missingEntries: gitignoreUpdated ? [] : missingGitignoreEntries,
    },
  };

  if (options.json) {
    ui.printJson(payload);
    return;
  }

  ui.success(`Created ${CONFIG_FILE_NAME} and .corydora/ in ${options.projectRoot}`);
  ui.info(`Default runtime: ${provider} (${model})`);
  ui.info(`Isolation mode: ${isolationMode}`);
  ui.info(`Categories: ${enabledCategories.join(', ')}`);
  if (gitignoreUpdated) {
    ui.info('Appended a Corydora block to `.gitignore`.');
  } else if (missingGitignoreEntries.length > 0) {
    ui.warn(formatGitignoreGuidance(missingGitignoreEntries));
  }
  outro('Corydora init complete.');
}
