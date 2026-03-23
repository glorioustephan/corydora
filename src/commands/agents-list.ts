import { BUILTIN_AGENTS } from '../agents/builtin-agents.js';
import { listAgents } from '../agents/catalog.js';
import { loadRequiredConfig } from './helpers.js';
import type { Ui } from '../ui/output.js';

export async function runAgentsListCommand(
  projectRoot: string,
  json: boolean,
  ui: Ui
): Promise<void> {
  try {
    const config = await loadRequiredConfig(projectRoot);
    const agents = await listAgents(projectRoot, config);
    if (json) {
      ui.printJson(agents);
      return;
    }

    for (const agent of agents) {
      ui.info(`${agent.id} [${agent.source}] -> ${agent.description}`);
    }
  } catch {
    if (json) {
      ui.printJson(BUILTIN_AGENTS);
      return;
    }

    for (const agent of BUILTIN_AGENTS) {
      ui.info(`${agent.id} [builtin] -> ${agent.description}`);
    }
  }
}
