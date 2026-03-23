import { confirm, intro, isCancel, outro, select, spinner, text } from '@clack/prompts';
import { BUILTIN_AGENTS } from '../agents/builtin-agents.js';
import { saveConfig, ensureCorydoraStructure } from '../config/files.js';
import { getDefaultConfig } from '../config/schema.js';
import { CONFIG_FILE_NAME } from '../constants.js';
import { ensureGitignoreEntries } from '../filesystem/gitignore.js';
import { detectProjectFingerprint } from '../filesystem/project.js';
import { probeAvailableRuntimes } from '../providers/index.js';
import type { RuntimeProviderId } from '../types/domain.js';
import type { Ui } from '../ui/output.js';

function selectBuiltinAgents(projectTechLenses: string[]): string[] {
  const matching = BUILTIN_AGENTS.filter((agent) =>
    agent.techLenses.some((lens) => projectTechLenses.includes(lens)),
  );
  return (matching.length > 0 ? matching : BUILTIN_AGENTS).map((agent) => agent.id);
}

export interface InitCommandOptions {
  projectRoot: string;
  json: boolean;
  yes?: boolean;
}

export async function runInitCommand(options: InitCommandOptions, ui: Ui): Promise<void> {
  const fingerprint = detectProjectFingerprint(options.projectRoot);
  const runtimeProbes = (await probeAvailableRuntimes(options.projectRoot)).filter(
    (probe) => probe.provider !== 'fake',
  );
  const recommendedRuntime =
    runtimeProbes.find((probe) => probe.recommended)?.provider ??
    runtimeProbes.find((probe) => probe.installed)?.provider ??
    'claude-cli';

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

  let provider: RuntimeProviderId = recommendedRuntime as RuntimeProviderId;
  let model =
    runtimeProbes.find((probe) => probe.provider === provider)?.models[0] ??
    getDefaultConfig({
      provider,
      selectedBuiltinAgents: ['bug-investigator'],
    }).runtime.model;
  let isolationMode: 'worktree' | 'branch' | 'current-branch' = 'worktree';
  let trackMarkdownQueues = false;
  let backgroundByDefault = false;

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

    const trackQueuesAnswer = await confirm({
      message: 'Track markdown queue files in git?',
      initialValue: false,
    });
    if (isCancel(trackQueuesAnswer)) {
      throw new Error('Init cancelled.');
    }
    trackMarkdownQueues = Boolean(trackQueuesAnswer);

    const backgroundAnswer = await confirm({
      message: 'Launch long runs in the background by default?',
      initialValue: false,
    });
    if (isCancel(backgroundAnswer)) {
      throw new Error('Init cancelled.');
    }
    backgroundByDefault = Boolean(backgroundAnswer);
  }

  const config = getDefaultConfig({
    provider,
    model,
    isolationMode,
    selectedBuiltinAgents: selectBuiltinAgents(fingerprint.techLenses),
    trackMarkdownQueues,
    backgroundByDefault,
  });

  await saveConfig(options.projectRoot, config);
  await ensureCorydoraStructure(options.projectRoot, config);
  await ensureGitignoreEntries(options.projectRoot, config.git.trackMarkdownQueues);

  const payload = {
    projectRoot: options.projectRoot,
    provider,
    model,
    isolationMode,
    fingerprint,
  };

  if (options.json) {
    ui.printJson(payload);
    return;
  }

  ui.success(`Created ${CONFIG_FILE_NAME} and .corydora/ in ${options.projectRoot}`);
  ui.info(`Default runtime: ${provider} (${model})`);
  ui.info(`Isolation mode: ${isolationMode}`);
  outro('Corydora init complete.');
}
