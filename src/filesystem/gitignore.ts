import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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

export async function ensureGitignoreEntries(
  projectRoot: string,
  trackMarkdownQueues: boolean,
): Promise<void> {
  const gitignorePath = resolve(projectRoot, '.gitignore');
  const existing = existsSync(gitignorePath) ? await readFile(gitignorePath, 'utf8') : '';
  const lines = new Set(
    existing
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  );

  for (const entry of CORYDORA_IGNORE_ENTRIES) {
    lines.add(entry);
  }

  if (!trackMarkdownQueues) {
    for (const entry of MARKDOWN_IGNORE_ENTRIES) {
      lines.add(entry);
    }
  }

  const nextContent = `${Array.from(lines)
    .sort((left, right) => left.localeCompare(right))
    .join('\n')}\n`;
  await writeFile(gitignorePath, nextContent, 'utf8');
}
