#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { runAgentsImportCommand } from './commands/agents-import.js';
import { runAgentsListCommand } from './commands/agents-list.js';
import { runAttachCommand } from './commands/attach.js';
import { runConfigValidateCommand } from './commands/config-validate.js';
import { runDoctorCommand } from './commands/doctor.js';
import { configExists, resolveProjectRoot } from './commands/helpers.js';
import { runInitCommand } from './commands/init.js';
import { runRunCommand } from './commands/run.js';
import { runStatusCommand } from './commands/status.js';
import { runStopCommand } from './commands/stop.js';
import { selectMainAction } from './ui/menu.js';
import { createUi } from './ui/output.js';

interface PackageMetadata {
  version?: string;
}

interface HelpSection {
  title: string;
  lines: readonly string[];
}

const program = new Command();
const cliVersion = readCliVersion();

function readCliVersion(): string {
  const raw = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  const parsed = JSON.parse(raw) as PackageMetadata;

  return typeof parsed.version === 'string' ? parsed.version : '0.0.0';
}

function formatHelpSections(sections: readonly HelpSection[]): string {
  return sections
    .map(
      (section) => `\n${section.title}:\n${section.lines.map((line) => `  ${line}`).join('\n')}\n`,
    )
    .join('');
}

function addHelpSections(command: Command, sections: readonly HelpSection[]): void {
  command.addHelpText('after', formatHelpSections(sections));
}

function normalizeArgv(argv: readonly string[]): string[] {
  const normalized = [...argv];

  for (let index = 2; index < normalized.length; index += 1) {
    if (normalized[index] === '--') {
      break;
    }

    if (normalized[index] === '--v') {
      normalized[index] = '--version';
    }
  }

  return normalized;
}

program
  .name('corydora')
  .description('Provider-neutral overnight AI code scrubbing CLI')
  .usage('[options] [command]')
  .helpOption('-h, --help', 'Display help for command or subcommand')
  .version(cliVersion, '-V, --version', 'Display CLI version')
  .showSuggestionAfterError()
  .showHelpAfterError('(run with --help for usage details)')
  .option('--json', 'Print machine-readable output', false);

addHelpSections(program, [
  {
    title: 'Arguments',
    lines: [
      'No positional arguments are required at the top level.',
      'Run a subcommand when you want explicit, non-interactive behavior.',
    ],
  },
  {
    title: 'Behavior',
    lines: [
      'Missing `.corydora.json`: runs `corydora init`.',
      'Config present in a TTY: opens the interactive action menu.',
      'Config present without a TTY: runs `corydora status`.',
    ],
  },
  {
    title: 'Examples',
    lines: [
      '$ corydora',
      '$ corydora --version',
      '$ corydora run --dry-run',
      '$ corydora run --background',
      '$ corydora agents import ./agents',
      '$ corydora config validate',
    ],
  },
]);

program.action(async (_options, command) => {
  const options = command.optsWithGlobals() as { json: boolean };
  const ui = createUi(options.json);
  const projectRoot = resolveProjectRoot(process.cwd());

  if (!configExists(projectRoot)) {
    await runInitCommand({ projectRoot, json: options.json }, ui);
    return;
  }

  if (!process.stdout.isTTY) {
    await runStatusCommand(projectRoot, options.json, ui);
    return;
  }

  const action = await selectMainAction();
  if (!action) {
    return;
  }

  if (action === 'run') {
    await runRunCommand({ projectRoot, json: options.json }, ui);
    return;
  }

  if (action === 'status') {
    await runStatusCommand(projectRoot, options.json, ui);
    return;
  }

  if (action === 'doctor') {
    await runDoctorCommand(projectRoot, options.json, ui);
    return;
  }

  await runInitCommand({ projectRoot, json: options.json }, ui);
});

const initCommand = program
  .command('init')
  .description('Scaffold Corydora config and project working files')
  .option('--yes', 'Accept defaults without prompting', false)
  .action(async (commandOptions) => {
    const ui = createUi(Boolean(program.opts().json));
    await runInitCommand(
      {
        projectRoot: resolveProjectRoot(process.cwd()),
        json: Boolean(program.opts().json),
        yes: Boolean(commandOptions.yes),
      },
      ui,
    );
  });

addHelpSections(initCommand, [
  {
    title: 'Examples',
    lines: ['$ corydora init', '$ corydora init --yes', '$ corydora init --yes --json'],
  },
]);

const runCommand = program
  .command('run')
  .description('Start a scrub run for the current project')
  .option('--dry-run', 'Run without executing provider actions', false)
  .option('--background', 'Launch in tmux when available', false)
  .option('--foreground', 'Force foreground mode', false)
  .option('--resume', 'Resume the last recorded run state', false)
  .option('--session-name <name>', 'Override the generated tmux session name (internal use)')
  .action(async (commandOptions) => {
    const ui = createUi(Boolean(program.opts().json));
    await runRunCommand(
      {
        projectRoot: resolveProjectRoot(process.cwd()),
        json: Boolean(program.opts().json),
        dryRun: Boolean(commandOptions.dryRun),
        background: Boolean(commandOptions.background),
        foreground: Boolean(commandOptions.foreground),
        resume: Boolean(commandOptions.resume),
        sessionName:
          typeof commandOptions.sessionName === 'string' ? commandOptions.sessionName : undefined,
      },
      ui,
    );
  });

addHelpSections(runCommand, [
  {
    title: 'Examples',
    lines: [
      '$ corydora run',
      '$ corydora run --dry-run',
      '$ corydora run --background',
      '$ corydora run --resume',
    ],
  },
]);

const statusCommand = program
  .command('status')
  .description('Show the current or most recent run state')
  .action(async () => {
    const ui = createUi(Boolean(program.opts().json));
    await runStatusCommand(resolveProjectRoot(process.cwd()), Boolean(program.opts().json), ui);
  });

addHelpSections(statusCommand, [
  {
    title: 'Examples',
    lines: ['$ corydora status', '$ corydora status --json'],
  },
]);

const attachCommand = program
  .command('attach')
  .description('Attach to a tmux-backed background run')
  .action(async () => {
    await runAttachCommand(resolveProjectRoot(process.cwd()));
  });

addHelpSections(attachCommand, [
  {
    title: 'Examples',
    lines: ['$ corydora attach'],
  },
]);

const stopCommand = program
  .command('stop')
  .description('Request a graceful stop for an active run')
  .action(async () => {
    const ui = createUi(Boolean(program.opts().json));
    await runStopCommand(resolveProjectRoot(process.cwd()), Boolean(program.opts().json), ui);
  });

addHelpSections(stopCommand, [
  {
    title: 'Examples',
    lines: ['$ corydora stop', '$ corydora stop --json'],
  },
]);

const doctorCommand = program
  .command('doctor')
  .description('Check runtime availability and local prerequisites')
  .action(async () => {
    const ui = createUi(Boolean(program.opts().json));
    await runDoctorCommand(resolveProjectRoot(process.cwd()), Boolean(program.opts().json), ui);
  });

addHelpSections(doctorCommand, [
  {
    title: 'Examples',
    lines: ['$ corydora doctor', '$ corydora doctor --json'],
  },
]);

const agentsCommand = program
  .command('agents')
  .description('List builtin agents or import agent definitions from disk');

const agentsListCommand = agentsCommand
  .command('list')
  .description('List builtin and imported agents')
  .action(async () => {
    const ui = createUi(Boolean(program.opts().json));
    await runAgentsListCommand(resolveProjectRoot(process.cwd()), Boolean(program.opts().json), ui);
  });

addHelpSections(agentsListCommand, [
  {
    title: 'Examples',
    lines: ['$ corydora agents list', '$ corydora agents list --json'],
  },
]);

const agentsImportCommand = agentsCommand
  .command('import')
  .description('Import agent markdown files from a directory')
  .argument('<dir>', 'Directory containing markdown agent definitions')
  .action(async (sourceDirectory) => {
    const ui = createUi(Boolean(program.opts().json));
    await runAgentsImportCommand(
      resolveProjectRoot(process.cwd()),
      String(sourceDirectory),
      Boolean(program.opts().json),
      ui,
    );
  });

addHelpSections(agentsImportCommand, [
  {
    title: 'Examples',
    lines: ['$ corydora agents import ./agents', '$ corydora agents import ./agents --json'],
  },
]);

const configCommand = program
  .command('config')
  .description('Validate Corydora configuration files');

const configValidateCommand = configCommand
  .command('validate')
  .description('Validate `.corydora.json` against the schema')
  .action(async () => {
    const ui = createUi(Boolean(program.opts().json));
    await runConfigValidateCommand(
      resolveProjectRoot(process.cwd()),
      Boolean(program.opts().json),
      ui,
    );
  });

addHelpSections(configValidateCommand, [
  {
    title: 'Examples',
    lines: ['$ corydora config validate', '$ corydora config validate --json'],
  },
]);

program.parseAsync(normalizeArgv(process.argv)).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
