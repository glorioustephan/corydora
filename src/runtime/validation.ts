import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { CorydoraMode, ValidationResult } from '../types/domain.js';

interface PackageJsonShape {
  scripts?: Record<string, string>;
}

function loadScripts(workRoot: string): Record<string, string> {
  const packageJsonPath = resolve(workRoot, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return {};
  }

  try {
    const raw = readFileSync(packageJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as PackageJsonShape;
    return parsed.scripts ?? {};
  } catch {
    return {};
  }
}

function packageManagerCommand(workRoot: string): string {
  if (existsSync(resolve(workRoot, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }

  if (existsSync(resolve(workRoot, 'yarn.lock'))) {
    return 'yarn';
  }

  if (existsSync(resolve(workRoot, 'bun.lock')) || existsSync(resolve(workRoot, 'bun.lockb'))) {
    return 'bun';
  }

  return 'npm';
}

function buildRunArgs(command: string, script: string): string[] {
  if (command === 'yarn') {
    return [script];
  }

  if (command === 'bun') {
    return ['run', script];
  }

  return ['run', script];
}

export function chooseValidationScript(
  workRoot: string,
  mode: CorydoraMode,
  validateAfterFix: boolean,
): { command: string; args: string[]; label: string } | null {
  if (!validateAfterFix) {
    return null;
  }

  const scripts = loadScripts(workRoot);
  const command = packageManagerCommand(workRoot);

  if (mode === 'linting') {
    if (!scripts.lint) {
      return null;
    }

    return {
      command,
      args: buildRunArgs(command, 'lint'),
      label: 'lint',
    };
  }

  if (mode === 'documentation') {
    const docsScript = ['docs:check', 'docs:build', 'docs:lint'].find((script) => scripts[script]);
    if (!docsScript) {
      return null;
    }

    return {
      command,
      args: buildRunArgs(command, docsScript),
      label: docsScript,
    };
  }

  if (scripts.typecheck) {
    return {
      command,
      args: buildRunArgs(command, 'typecheck'),
      label: 'typecheck',
    };
  }

  if (scripts.test) {
    return {
      command,
      args: buildRunArgs(command, 'test'),
      label: 'test',
    };
  }

  return null;
}

export function runValidation(
  workRoot: string,
  mode: CorydoraMode,
  validateAfterFix: boolean,
): ValidationResult {
  const script = chooseValidationScript(workRoot, mode, validateAfterFix);
  if (!script) {
    return {
      status: 'skipped',
      summary: 'No matching validation script was available.',
    };
  }

  const result = spawnSync(script.command, script.args, {
    cwd: workRoot,
    encoding: 'utf8',
  });

  if (result.error) {
    return {
      status: 'failed',
      command: [script.command, ...script.args].join(' '),
      summary: result.error.message,
    };
  }

  if (result.status !== 0) {
    const detail = [result.stdout?.trim(), result.stderr?.trim()].filter(Boolean).join('\n');
    return {
      status: 'failed',
      command: [script.command, ...script.args].join(' '),
      summary: detail.length > 0 ? detail : `${script.label} failed.`,
    };
  }

  return {
    status: 'passed',
    command: [script.command, ...script.args].join(' '),
    summary: `${script.label} passed.`,
  };
}
