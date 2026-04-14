import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { commitTaskChanges, runGit } from './repository.js';

const directories: string[] = [];

async function createRepo(): Promise<string> {
  const directory = await mkdtemp(resolve(tmpdir(), 'corydora-repository-'));
  directories.push(directory);
  execFileSync('git', ['init', '-b', 'main'], { cwd: directory, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'corydora@example.com'], {
    cwd: directory,
    stdio: 'ignore',
  });
  execFileSync('git', ['config', 'user.name', 'Corydora Test'], {
    cwd: directory,
    stdio: 'ignore',
  });
  await writeFile(
    resolve(directory, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '1.0.0' }, null, 2),
    'utf8',
  );
  await writeFile(resolve(directory, 'index.ts'), 'export const value = 1;\n', 'utf8');
  execFileSync('git', ['add', '.'], { cwd: directory, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: directory, stdio: 'ignore' });
  return directory;
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('commitTaskChanges', () => {
  it('commits touched files without requiring Prettier to be installed', async () => {
    const directory = await createRepo();
    await writeFile(resolve(directory, 'index.ts'), 'export const value = 2;\n', 'utf8');

    const committed = commitTaskChanges(directory, 'corydora: update', ['index.ts']);

    expect(committed).toBe(true);
    expect(runGit(['log', '-1', '--pretty=%s'], directory)).toBe('corydora: update');
    expect(runGit(['show', 'HEAD:index.ts'], directory)).toContain('value = 2');
  });
});
