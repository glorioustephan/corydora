import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { BUILTIN_AGENTS } from './builtin-agents.js';
import { parseMarkdownFrontmatter } from './frontmatter.js';
import type { AgentDefinition, ImportedAgentRecord, CorydoraConfig } from '../types/domain.js';

function importedAgentsPath(projectRoot: string, config: CorydoraConfig): string {
  return resolve(projectRoot, config.paths.agentsDir, 'imported-agents.json');
}

export async function loadImportedAgents(
  projectRoot: string,
  config: CorydoraConfig
): Promise<ImportedAgentRecord[]> {
  const filePath = importedAgentsPath(projectRoot, config);
  if (!existsSync(filePath)) {
    return [];
  }

  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as { agents?: ImportedAgentRecord[] };
  return Array.isArray(parsed.agents) ? parsed.agents : [];
}

export async function listAgents(
  projectRoot: string,
  config: CorydoraConfig
): Promise<AgentDefinition[]> {
  const imported = await loadImportedAgents(projectRoot, config);
  return [...BUILTIN_AGENTS, ...imported];
}

export async function importAgentsFromDirectory(
  projectRoot: string,
  config: CorydoraConfig,
  sourceDirectory: string
): Promise<ImportedAgentRecord[]> {
  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  const imported: ImportedAgentRecord[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || extname(entry.name) !== '.md') {
      continue;
    }

    const absolutePath = resolve(sourceDirectory, entry.name);
    const raw = await readFile(absolutePath, 'utf8');
    const parsed = parseMarkdownFrontmatter(raw);
    const fallbackId = basename(entry.name, '.md');

    imported.push({
      id: parsed.attributes.name ?? fallbackId,
      label: parsed.attributes.name ?? fallbackId,
      description: parsed.attributes.description ?? 'Imported external agent metadata.',
      categories: ['todo'],
      techLenses: ['refactoring'],
      prompt: parsed.body.trim().slice(0, 4000),
      source: 'imported',
      originalPath: absolutePath,
      importedAt: new Date().toISOString(),
    });
  }

  const filePath = importedAgentsPath(projectRoot, config);
  await writeFile(filePath, `${JSON.stringify({ agents: imported }, null, 2)}\n`, 'utf8');
  return imported;
}
