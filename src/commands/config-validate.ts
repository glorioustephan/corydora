import { loadRequiredConfig } from './helpers.js';
import type { Ui } from '../ui/output.js';

export async function runConfigValidateCommand(
  projectRoot: string,
  json: boolean,
  ui: Ui,
): Promise<void> {
  const config = await loadRequiredConfig(projectRoot);
  if (json) {
    ui.printJson({ ok: true, config });
    return;
  }

  ui.success('Configuration is valid.');
}
