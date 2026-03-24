import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONFIG_FILE_NAME } from '../constants.js';
import { loadConfig } from '../config/files.js';
import { loadProjectEnv } from '../config/env.js';
import { findGitRoot } from '../filesystem/project.js';
import type { CorydoraConfig } from '../types/domain.js';

export function resolveProjectRoot(startDir: string): string {
  return findGitRoot(startDir);
}

export function configExists(projectRoot: string): boolean {
  return existsSync(resolve(projectRoot, CONFIG_FILE_NAME));
}

export async function loadRequiredConfig(
  projectRoot: string,
  configPath?: string,
): Promise<CorydoraConfig> {
  if (!configExists(projectRoot) && !configPath) {
    throw new Error(
      `No ${CONFIG_FILE_NAME} file found in ${projectRoot}. Run "corydora init" first.`,
    );
  }

  const config = await loadConfig(projectRoot, configPath);
  await loadProjectEnv(projectRoot, config);
  return config;
}
