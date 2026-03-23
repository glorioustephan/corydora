import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const projectRoot = resolve(dirname(new URL(import.meta.url).pathname), '..');

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
  execFileSync('git', ['config', 'user.name', 'Corydora Test'], { cwd: directory, stdio: 'ignore' });
  execFileSync('git', ['add', '.'], { cwd: directory, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: directory, stdio: 'ignore' });
}

export function runCli(args: string[], cwd: string): string {
  return execFileSync(
    process.execPath,
    ['--import', resolve(projectRoot, 'node_modules', 'tsx', 'dist', 'loader.mjs'), corydoraCliPath(), ...args],
    {
      cwd,
      encoding: 'utf8',
    }
  );
}

export async function patchConfig(
  directory: string,
  transform: (config: Record<string, unknown>) => Record<string, unknown>
): Promise<void> {
  const configPath = resolve(directory, '.corydora.json');
  const raw = await readFile(configPath, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  await writeFile(configPath, `${JSON.stringify(transform(parsed), null, 2)}\n`, 'utf8');
}

export async function cleanupDirectory(directory: string): Promise<void> {
  await rm(directory, { recursive: true, force: true });
}
