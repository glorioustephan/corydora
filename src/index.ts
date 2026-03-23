#!/usr/bin/env node

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

const program = new Command();

program
  .name('corydora')
  .description('Provider-neutral overnight AI code scrubbing CLI')
  .option('--json', 'Print machine-readable output', false);

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

program
  .command('init')
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

program
  .command('run')
  .option('--dry-run', 'Run without executing provider actions', false)
  .option('--background', 'Launch in tmux when available', false)
  .option('--foreground', 'Force foreground mode', false)
  .option('--resume', 'Resume the last recorded run state', false)
  .option('--session-name <name>', 'Internal tmux session metadata')
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

program.command('status').action(async () => {
  const ui = createUi(Boolean(program.opts().json));
  await runStatusCommand(resolveProjectRoot(process.cwd()), Boolean(program.opts().json), ui);
});

program.command('attach').action(async () => {
  await runAttachCommand(resolveProjectRoot(process.cwd()));
});

program.command('stop').action(async () => {
  const ui = createUi(Boolean(program.opts().json));
  await runStopCommand(resolveProjectRoot(process.cwd()), Boolean(program.opts().json), ui);
});

program.command('doctor').action(async () => {
  const ui = createUi(Boolean(program.opts().json));
  await runDoctorCommand(resolveProjectRoot(process.cwd()), Boolean(program.opts().json), ui);
});

const agentsCommand = program.command('agents');

agentsCommand.command('list').action(async () => {
  const ui = createUi(Boolean(program.opts().json));
  await runAgentsListCommand(resolveProjectRoot(process.cwd()), Boolean(program.opts().json), ui);
});

agentsCommand.command('import <dir>').action(async (sourceDirectory) => {
  const ui = createUi(Boolean(program.opts().json));
  await runAgentsImportCommand(
    resolveProjectRoot(process.cwd()),
    String(sourceDirectory),
    Boolean(program.opts().json),
    ui,
  );
});

const configCommand = program.command('config');
configCommand.command('validate').action(async () => {
  const ui = createUi(Boolean(program.opts().json));
  await runConfigValidateCommand(
    resolveProjectRoot(process.cwd()),
    Boolean(program.opts().json),
    ui,
  );
});

program.parseAsync(process.argv).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
