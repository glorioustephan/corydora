import { importAgentsFromDirectory } from '../agents/catalog.js';
import { loadRequiredConfig } from './helpers.js';
import type { Ui } from '../ui/output.js';

export async function runAgentsImportCommand(
  projectRoot: string,
  sourceDirectory: string,
  json: boolean,
  ui: Ui,
): Promise<void> {
  const config = await loadRequiredConfig(projectRoot);
  const imported = await importAgentsFromDirectory(projectRoot, config, sourceDirectory);

  if (json) {
    ui.printJson(imported);
    return;
  }

  ui.success(`Imported ${imported.length} agent(s) from ${sourceDirectory}.`);
}
