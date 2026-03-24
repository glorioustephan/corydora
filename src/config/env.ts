import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { CorydoraConfig } from '../types/domain.js';

function stripInlineComment(value: string): string {
  let result = '';
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (!character) {
      continue;
    }

    if ((character === '"' || character === "'") && value[index - 1] !== '\\') {
      quote = quote === character ? null : (quote ?? character);
    }

    if (character === '#' && quote === null) {
      break;
    }

    result += character;
  }

  return result.trim();
}

function normalizeEnvValue(rawValue: string): string {
  const value = stripInlineComment(rawValue);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith('#')) {
    return null;
  }

  const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match) {
    return null;
  }

  const [, key, rawValue] = match;
  if (!key) {
    return null;
  }

  return {
    key,
    value: normalizeEnvValue(rawValue ?? ''),
  };
}

export async function loadProjectEnv(
  projectRoot: string,
  config: CorydoraConfig,
): Promise<Record<string, string>> {
  const envPath = resolve(projectRoot, config.paths.envFile);
  if (!existsSync(envPath)) {
    return {};
  }

  const raw = await readFile(envPath, 'utf8');
  const loadedEntries: Record<string, string> = {};

  for (const line of raw.split(/\r?\n/u)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }

    if (process.env[parsed.key] !== undefined) {
      continue;
    }

    process.env[parsed.key] = parsed.value;
    loadedEntries[parsed.key] = parsed.value;
  }

  return loadedEntries;
}
