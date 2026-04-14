import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const CORYDORA_GITIGNORE_COMMENT = '# Corydora generated files';

const CORYDORA_IGNORE_ENTRIES = [
  '.corydora/logs/',
  '.corydora/runs/',
  '.corydora/state/',
  '.corydora/.env.local',
];

const MARKDOWN_IGNORE_ENTRIES = [
  '.corydora/todo.md',
  '.corydora/features.md',
  '.corydora/bugs.md',
  '.corydora/performance.md',
  '.corydora/tests.md',
];

export function recommendedGitignoreEntries(trackMarkdownQueues: boolean): string[] {
  return [...CORYDORA_IGNORE_ENTRIES, ...(!trackMarkdownQueues ? MARKDOWN_IGNORE_ENTRIES : [])];
}

async function readGitignore(projectRoot: string): Promise<string> {
  const gitignorePath = resolve(projectRoot, '.gitignore');
  return existsSync(gitignorePath) ? await readFile(gitignorePath, 'utf8') : '';
}

function normalizedGitignoreLines(content: string): Set<string> {
  return new Set(
    content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  );
}

export async function findMissingGitignoreEntries(
  projectRoot: string,
  trackMarkdownQueues: boolean,
): Promise<string[]> {
  const existing = await readGitignore(projectRoot);
  const lines = normalizedGitignoreLines(existing);

  return recommendedGitignoreEntries(trackMarkdownQueues).filter((entry) => !lines.has(entry));
}

export async function appendGitignoreEntries(
  projectRoot: string,
  entries: string[],
): Promise<boolean> {
  if (entries.length === 0) {
    return false;
  }

  const gitignorePath = resolve(projectRoot, '.gitignore');
  const existing = await readGitignore(projectRoot);
  const lines = normalizedGitignoreLines(existing);
  const missingEntries = entries.filter((entry) => !lines.has(entry));

  if (missingEntries.length === 0) {
    return false;
  }

  const block = [CORYDORA_GITIGNORE_COMMENT, ...missingEntries].join('\n');
  const separator = existing.length === 0 ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
  await writeFile(gitignorePath, `${existing}${separator}${block}\n`, 'utf8');
  return true;
}

export async function ensureGitignoreEntries(
  projectRoot: string,
  trackMarkdownQueues: boolean,
): Promise<void> {
  const gitignorePath = resolve(projectRoot, '.gitignore');
  const existing = await readGitignore(projectRoot);
  const lines = new Set(
    existing
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  );

  for (const entry of recommendedGitignoreEntries(trackMarkdownQueues)) {
    lines.add(entry);
  }

  const nextContent = `${Array.from(lines)
    .sort((left, right) => left.localeCompare(right))
    .join('\n')}\n`;
  await writeFile(gitignorePath, nextContent, 'utf8');
}
