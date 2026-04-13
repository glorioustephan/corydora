import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { detectProjectFingerprint } from '../filesystem/project.js';
import { probeAvailableRuntimes, getRuntimeAdapters } from '../providers/index.js';
import { supportsBackgroundKeepAwake, supportsTmux } from '../runtime/tmux.js';
import { chooseValidationScript } from '../runtime/validation.js';
import { preflightIsolationMode, resolveStageRoute } from '../runtime/routes.js';
import { configExists, loadRequiredConfig } from './helpers.js';
import type { Ui } from '../ui/output.js';

export async function runDoctorCommand(projectRoot: string, json: boolean, ui: Ui): Promise<void> {
  const hasConfig = configExists(projectRoot);
  const [fingerprint, probes, config] = await Promise.all([
    Promise.resolve(detectProjectFingerprint(projectRoot)),
    probeAvailableRuntimes(projectRoot),
    hasConfig ? loadRequiredConfig(projectRoot) : Promise.resolve(null),
  ]);

  const runtimeChecks = await Promise.all(
    getRuntimeAdapters().map(async (adapter) => ({
      provider: adapter.id,
      checks: await adapter.doctor(projectRoot),
    })),
  );

  const fixRoute = config ? resolveStageRoute(config, 'fix') : null;
  const validation = config
    ? chooseValidationScript(projectRoot, config.modes.default, config.execution.validateAfterFix)
    : null;
  const isolationCheck =
    config && fixRoute
      ? preflightIsolationMode({
          projectRoot,
          config,
          fixRoute,
          mode: config.modes.default,
        })
      : null;

  const payload = {
    fingerprint,
    tmuxAvailable: supportsTmux(),
    backgroundKeepAwakeAvailable: supportsBackgroundKeepAwake(),
    runtimes: probes,
    checks: runtimeChecks,
    config: config
      ? {
          mode: config.modes.default,
          fixProvider: fixRoute?.provider,
          effectiveIsolationMode: isolationCheck?.effectiveIsolationMode,
          validationCommand: validation ? [validation.command, ...validation.args].join(' ') : null,
          lintPrerequisite:
            config.modes.default === 'linting'
              ? existsSync(resolve(projectRoot, 'package.json'))
              : null,
        }
      : null,
  };

  if (json) {
    ui.printJson(payload);
    return;
  }

  ui.info(`Package manager: ${fingerprint.packageManager}`);
  ui.info(`Frameworks: ${fingerprint.frameworks.join(', ') || 'none detected'}`);
  ui.info(`tmux available: ${supportsTmux() ? 'yes' : 'no'}`);
  ui.info(`background keep-awake available: ${supportsBackgroundKeepAwake() ? 'yes' : 'no'}`);

  for (const probe of probes) {
    ui.info(
      `${probe.provider}: installed=${probe.installed} auth=${probe.auth.status} (${probe.auth.message})`,
    );
  }

  if (config && fixRoute && isolationCheck) {
    ui.info(`Configured mode: ${config.modes.default}`);
    ui.info(`Fix route: ${fixRoute.provider} (${fixRoute.model})`);
    ui.info(
      `Isolation compatibility: ${config.git.isolationMode} -> ${isolationCheck.effectiveIsolationMode}`,
    );
    ui.info(
      `Validation command: ${validation ? [validation.command, ...validation.args].join(' ') : 'none available'}`,
    );
  }
}
