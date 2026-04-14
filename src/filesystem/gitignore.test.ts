import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { appendGitignoreEntries, findMissingGitignoreEntries } from './gitignore.js';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('gitignore helpers', () => {
  it('finds the missing Corydora entries without rewriting the file', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'corydora-gitignore-'));
    directories.push(directory);
    await writeFile(resolve(directory, '.gitignore'), 'node_modules/\n.corydora/logs/\n', 'utf8');

    const missingEntries = await findMissingGitignoreEntries(directory, false);

    expect(missingEntries).toContain('.corydora/.env.local');
    expect(missingEntries).toContain('.corydora/todo.md');
    expect(missingEntries).not.toContain('.corydora/logs/');
  });

  it('appends a dedicated Corydora block instead of restructuring the file', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'corydora-gitignore-'));
    directories.push(directory);
    await writeFile(resolve(directory, '.gitignore'), 'node_modules/\ndist/\n', 'utf8');

    const changed = await appendGitignoreEntries(directory, [
      '.corydora/.env.local',
      '.corydora/state/',
    ]);

    expect(changed).toBe(true);
    expect(await readFile(resolve(directory, '.gitignore'), 'utf8')).toBe(
      [
        'node_modules/',
        'dist/',
        '',
        '# Corydora generated files',
        '.corydora/.env.local',
        '.corydora/state/',
        '',
      ].join('\n'),
    );
  });
});
