import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { ProjectFingerprint, TechLens } from '../types/domain.js';

function walkUp(startDir: string, predicate: (dir: string) => boolean): string | null {
  let current = resolve(startDir);
  for (let index = 0; index < 25; index++) {
    if (predicate(current)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      break;
    }

    current = parent;
  }

  return null;
}

export function findGitRoot(startDir: string): string {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: startDir,
      encoding: 'utf8',
    }).trim();
  } catch {
    return (
      walkUp(startDir, (directory) => existsSync(resolve(directory, '.git'))) ?? resolve(startDir)
    );
  }
}

function detectPackageManager(projectRoot: string): ProjectFingerprint['packageManager'] {
  if (existsSync(resolve(projectRoot, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }

  if (existsSync(resolve(projectRoot, 'package-lock.json'))) {
    return 'npm';
  }

  if (existsSync(resolve(projectRoot, 'yarn.lock'))) {
    return 'yarn';
  }

  if (
    existsSync(resolve(projectRoot, 'bun.lockb')) ||
    existsSync(resolve(projectRoot, 'bun.lock'))
  ) {
    return 'bun';
  }

  return 'unknown';
}

export function detectProjectFingerprint(projectRoot: string): ProjectFingerprint {
  const frameworks = new Set<string>();
  const techLenses = new Set<TechLens>(['typescript']);
  const topLevelDirectories = readdirSync(projectRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (existsSync(resolve(projectRoot, 'package.json'))) {
    frameworks.add('node');
    techLenses.add('node-cli');
  }

  if (
    existsSync(resolve(projectRoot, 'next.config.js')) ||
    existsSync(resolve(projectRoot, 'next.config.mjs')) ||
    existsSync(resolve(projectRoot, 'app')) ||
    existsSync(resolve(projectRoot, 'pages'))
  ) {
    frameworks.add('nextjs');
    techLenses.add('nextjs');
    techLenses.add('react');
  }

  if (existsSync(resolve(projectRoot, 'src')) || existsSync(resolve(projectRoot, 'components'))) {
    frameworks.add('typescript');
  }

  if (
    existsSync(resolve(projectRoot, 'electron-builder.yml')) ||
    existsSync(resolve(projectRoot, 'electron.vite.config.ts')) ||
    existsSync(resolve(projectRoot, 'electron.vite.config.js'))
  ) {
    frameworks.add('electron');
    techLenses.add('electron');
  }

  if (existsSync(resolve(projectRoot, 'prisma')) || existsSync(resolve(projectRoot, 'drizzle'))) {
    techLenses.add('database');
  }

  if (existsSync(resolve(projectRoot, 'app')) || existsSync(resolve(projectRoot, 'components'))) {
    techLenses.add('react');
  }

  if (existsSync(resolve(projectRoot, 'tsconfig.json'))) {
    techLenses.add('typescript');
  }

  techLenses.add('refactoring');

  const packageRoots = ['packages', 'apps', 'clients']
    .map((segment) => resolve(projectRoot, segment))
    .filter((directory) => existsSync(directory));

  const packageCount =
    packageRoots.length === 0
      ? existsSync(resolve(projectRoot, 'package.json'))
        ? 1
        : 0
      : packageRoots.reduce((count, directory) => {
          return (
            count +
            readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory())
              .length
          );
        }, 0);

  return {
    packageManager: detectPackageManager(projectRoot),
    frameworks: Array.from(frameworks).sort((left, right) => left.localeCompare(right)),
    techLenses: Array.from(techLenses).sort((left, right) => left.localeCompare(right)),
    packageCount,
    topLevelDirectories,
  };
}
