import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const projectRoot = resolve(dirname(new URL(import.meta.url).pathname), '..');

function createCliEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };

  // Child CLI processes should behave like normal user invocations, not inherit
  // debugger/auto-attach hooks from the Vitest parent process.
  delete env.NODE_OPTIONS;
  delete env.NODE_INSPECT_RESUME_ON_START;
  delete env.VSCODE_INSPECTOR_OPTIONS;

  return env;
}

export function corydoraCliPath(): string {
  return resolve(projectRoot, 'src/index.ts');
}

export async function createTempFixture(name: string): Promise<string> {
  const destination = await mkdtemp(resolve(tmpdir(), `corydora-${name}-`));
  const fixtureRoot = resolve(projectRoot, 'test', 'fixtures', name);
  await cp(fixtureRoot, destination, { recursive: true });
  return destination;
}

export function initializeGitRepository(directory: string): void {
  execFileSync('git', ['init', '-b', 'main'], { cwd: directory, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'corydora@example.com'], {
    cwd: directory,
    stdio: 'ignore',
  });
  execFileSync('git', ['config', 'user.name', 'Corydora Test'], {
    cwd: directory,
    stdio: 'ignore',
  });
  execFileSync('git', ['add', '.'], { cwd: directory, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: directory, stdio: 'ignore' });
}

export function runCli(args: string[], cwd: string): string {
  return execFileSync(
    process.execPath,
    [
      '--import',
      resolve(projectRoot, 'node_modules', 'tsx', 'dist', 'loader.mjs'),
      corydoraCliPath(),
      ...args,
    ],
    {
      cwd,
      encoding: 'utf8',
      env: createCliEnv(),
    },
  );
}

export interface CliRunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export function runCliCommand(args: string[], cwd: string): CliRunResult {
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      resolve(projectRoot, 'node_modules', 'tsx', 'dist', 'loader.mjs'),
      corydoraCliPath(),
      ...args,
    ],
    {
      cwd,
      encoding: 'utf8',
      env: createCliEnv(),
    },
  );

  if (result.error) {
    throw result.error;
  }

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export async function patchConfig(
  directory: string,
  transform: (config: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  const configPath = resolve(directory, '.corydora.json');
  const raw = await readFile(configPath, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  await writeFile(configPath, `${JSON.stringify(transform(parsed), null, 2)}\n`, 'utf8');
}

export async function cleanupDirectory(directory: string): Promise<void> {
  await rm(directory, { recursive: true, force: true });
}
