import { detectProjectFingerprint } from '../filesystem/project.js';
import { probeAvailableRuntimes, getRuntimeAdapters } from '../providers/index.js';
import { supportsBackgroundKeepAwake, supportsTmux } from '../runtime/tmux.js';
import type { Ui } from '../ui/output.js';

export async function runDoctorCommand(projectRoot: string, json: boolean, ui: Ui): Promise<void> {
  const [fingerprint, probes] = await Promise.all([
    Promise.resolve(detectProjectFingerprint(projectRoot)),
    probeAvailableRuntimes(projectRoot),
  ]);

  const runtimeChecks = await Promise.all(
    getRuntimeAdapters().map(async (adapter) => ({
      provider: adapter.id,
      checks: await adapter.doctor(projectRoot),
    })),
  );

  const payload = {
    fingerprint,
    tmuxAvailable: supportsTmux(),
    backgroundKeepAwakeAvailable: supportsBackgroundKeepAwake(),
    runtimes: probes,
    checks: runtimeChecks,
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
}
