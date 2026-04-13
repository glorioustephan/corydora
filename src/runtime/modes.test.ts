import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILTIN_AGENTS } from '../agents/builtin-agents.js';
import { getDefaultConfig } from '../config/schema.js';
import { buildFileQueue, prepareAnalysisMaterial, resolveSelectedAgents } from './modes.js';

const directories: string[] = [];

async function createRepo(): Promise<string> {
  const directory = await mkdtemp(resolve(tmpdir(), 'corydora-modes-'));
  directories.push(directory);
  await mkdir(resolve(directory, 'src'), { recursive: true });
  await writeFile(
    resolve(directory, 'package.json'),
    JSON.stringify(
      {
        name: 'fixture',
        version: '1.0.0',
        scripts: {
          typecheck: 'echo typecheck',
        },
      },
      null,
      2,
    ),
    'utf8',
  );
  execFileSync('git', ['init', '-b', 'main'], { cwd: directory, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'corydora@example.com'], {
    cwd: directory,
    stdio: 'ignore',
  });
  execFileSync('git', ['config', 'user.name', 'Corydora Test'], {
    cwd: directory,
    stdio: 'ignore',
  });
  return directory;
}

function commitAll(directory: string, message: string): void {
  execFileSync('git', ['add', '.'], { cwd: directory, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', message], { cwd: directory, stdio: 'ignore' });
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('mode scoring and selection', () => {
  it('prioritizes high-churn files in churn mode', async () => {
    const directory = await createRepo();
    await writeFile(resolve(directory, 'src', 'hot.ts'), 'export const hot = 1;\n', 'utf8');
    await writeFile(resolve(directory, 'src', 'cold.ts'), 'export const cold = 1;\n', 'utf8');
    commitAll(directory, 'initial');

    await writeFile(resolve(directory, 'src', 'hot.ts'), 'export const hot = 2;\n', 'utf8');
    commitAll(directory, 'hot-1');
    await writeFile(resolve(directory, 'src', 'hot.ts'), 'export const hot = 3;\n', 'utf8');
    commitAll(directory, 'hot-2');
    await writeFile(resolve(directory, 'src', 'cold.ts'), 'export const cold = 2;\n', 'utf8');
    commitAll(directory, 'cold-1');

    const config = getDefaultConfig({
      provider: 'fake',
      selectedBuiltinAgents: ['bug-investigator'],
    });
    const queue = buildFileQueue({
      projectRoot: directory,
      workRoot: directory,
      config,
      mode: 'churn',
      taskStore: { tasks: [] },
    });
    const ordered = [...queue.files].sort((left, right) => right.score.total - left.score.total);

    expect(ordered[0]?.path).toBe('src/hot.ts');
  });

  it('switches to windowed analysis when the file exceeds the analyze budget', async () => {
    const directory = await createRepo();
    const largeContent = Array.from(
      { length: 600 },
      (_value, index) => `export const value${index} = ${index};`,
    ).join('\n');
    await writeFile(resolve(directory, 'src', 'large.ts'), `${largeContent}\n`, 'utf8');
    commitAll(directory, 'large');

    const config = getDefaultConfig({
      provider: 'fake',
      selectedBuiltinAgents: ['bug-investigator'],
    });
    config.runtime.stages.analyze.maxOutputTokens = 64;

    const queue = buildFileQueue({
      projectRoot: directory,
      workRoot: directory,
      config,
      mode: 'auto',
      taskStore: { tasks: [] },
    });
    const record = queue.files.find((file) => file.path === 'src/large.ts');

    expect(record?.analysisStrategy).toBe('windowed');
    const material = prepareAnalysisMaterial(directory, record!);
    expect(material.strategy).toBe('windowed');
    expect(material.windows.length).toBeGreaterThan(0);
  });

  it('uses mode profiles to select the agent pool', () => {
    const config = getDefaultConfig({
      provider: 'fake',
      selectedBuiltinAgents: ['bug-investigator', 'feature-scout', 'refactoring-engineer'],
    });
    const selected = resolveSelectedAgents({
      allAgents: BUILTIN_AGENTS,
      config,
      mode: 'refactor',
      projectFingerprint: {
        packageManager: 'pnpm',
        frameworks: ['node'],
        techLenses: ['typescript', 'refactoring', 'node-cli'],
        packageCount: 1,
        topLevelDirectories: ['src'],
      },
    });

    expect(selected.some((agent) => agent.id === 'refactoring-engineer')).toBe(true);
    expect(selected.some((agent) => agent.id === 'feature-scout')).toBe(false);
  });
});
