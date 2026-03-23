import { readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

export interface DiscoveryOptions {
  includeExtensions: string[];
  excludeDirectories: string[];
}

function isTestLikePath(filePath: string): boolean {
  return (
    filePath.includes('/__tests__/') ||
    filePath.includes('/tests/') ||
    filePath.includes('/test/') ||
    filePath.includes('/fixtures/') ||
    filePath.includes('/__fixtures__/') ||
    filePath.includes('/mocks/') ||
    filePath.includes('.spec.') ||
    filePath.includes('.test.')
  );
}

function filePriority(filePath: string): number {
  if (filePath.includes('/src/') && !isTestLikePath(filePath)) {
    return 0;
  }

  if (!isTestLikePath(filePath)) {
    return 1;
  }

  return 2;
}

function shouldIncludeFile(filePath: string, options: DiscoveryOptions): boolean {
  const extension = extname(filePath);
  if (!options.includeExtensions.includes(extension)) {
    return false;
  }

  if (filePath.endsWith('.d.ts')) {
    return false;
  }

  return true;
}

function walk(directory: string, projectRoot: string, options: DiscoveryOptions, files: string[]): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (options.excludeDirectories.includes(entry.name)) {
        continue;
      }

      walk(join(directory, entry.name), projectRoot, options, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const absolutePath = join(directory, entry.name);
    const relativePath = relative(projectRoot, absolutePath).replace(/\\/g, '/');
    if (shouldIncludeFile(relativePath, options)) {
      files.push(relativePath);
    }
  }
}

export function discoverCandidateFiles(projectRoot: string, options: DiscoveryOptions): string[] {
  const files: string[] = [];
  walk(resolve(projectRoot), projectRoot, options, files);
  return files.sort((left, right) => {
    const leftPriority = filePriority(left);
    const rightPriority = filePriority(right);

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.localeCompare(right);
  });
}

export function groupFilesForScheduling(files: string[]): Record<string, string[]> {
  return files.reduce<Record<string, string[]>>((acc, file) => {
    const segments = file.split('/');
    const group =
      ['apps', 'packages', 'clients', 'analyzers'].includes(segments[0] ?? '') && segments[1]
        ? `${segments[0]}/${segments[1]}`
        : (segments[0] ?? '.');

    acc[group] ??= [];
    acc[group].push(file);
    return acc;
  }, {});
}
