import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function normalizeRepoUrl(rawRepo) {
  let normalized = rawRepo.trim();
  if (normalized.startsWith('git+')) {
    normalized = normalized.slice(4);
  }
  if (normalized.startsWith('git@github.com:')) {
    normalized = `https://github.com/${normalized.slice('git@github.com:'.length)}`;
  }
  return normalized.replace(/\.git$/i, '');
}

function resolveRepoUrl() {
  const configuredRepo = process.env.RELEASE_PLEASE_REPO_URL?.trim();
  if (configuredRepo) {
    return normalizeRepoUrl(configuredRepo);
  }

  const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const configuredFromPackage = packageJson.repository?.url?.trim();
  if (!configuredFromPackage) {
    throw new Error(
      'Unable to determine repo URL for release-please. Set RELEASE_PLEASE_REPO_URL.',
    );
  }

  return normalizeRepoUrl(configuredFromPackage);
}

const repoUrl = resolveRepoUrl();
const token =
  process.env.RELEASE_PLEASE_TOKEN?.trim() ||
  process.env.GITHUB_TOKEN?.trim() ||
  process.env.GH_TOKEN?.trim();

if (!token) {
  console.error(
    'Missing GitHub token. Set RELEASE_PLEASE_TOKEN (or GITHUB_TOKEN / GH_TOKEN) before',
    'running pnpm release:plan.',
  );
  process.exit(1);
}

const releasePlease = spawnSync(
  'pnpm',
  [
    'dlx',
    'release-please',
    'release-pr',
    '--repo-url',
    repoUrl,
    '--token',
    token,
    '--config-file',
    'release-please-config.json',
    '--manifest-file',
    '.release-please-manifest.json',
  ],
  { stdio: 'inherit' },
);

process.exit(releasePlease.status ?? 1);
