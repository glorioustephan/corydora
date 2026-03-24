import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadProjectEnv } from './env.js';
import { getDefaultConfig } from './schema.js';

const directories: string[] = [];

afterEach(async () => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('loadProjectEnv', () => {
  it('loads project-local env vars without overriding the current shell', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'corydora-env-'));
    directories.push(directory);
    const config = getDefaultConfig({
      provider: 'anthropic-api',
      selectedBuiltinAgents: ['bug-investigator'],
    });
    const envDirectory = resolve(directory, '.corydora');
    await mkdir(envDirectory, { recursive: true });
    await writeFile(
      resolve(envDirectory, '.env.local'),
      [
        '# comment',
        'ANTHROPIC_API_KEY="from-file"',
        "OPENAI_API_KEY='second-value' # trailing comment",
      ].join('\n'),
      'utf8',
    );
    process.env.OPENAI_API_KEY = 'from-shell';

    const loaded = await loadProjectEnv(directory, config);

    expect(loaded.ANTHROPIC_API_KEY).toBe('from-file');
    expect(process.env.ANTHROPIC_API_KEY).toBe('from-file');
    expect(loaded.OPENAI_API_KEY).toBeUndefined();
    expect(process.env.OPENAI_API_KEY).toBe('from-shell');
  });
});
