import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { ScanFinding } from '../types/domain.js';

interface EslintMessage {
  ruleId: string | null;
  message: string;
  severity: number;
  line?: number;
  endLine?: number;
}

interface EslintResult {
  filePath: string;
  messages: EslintMessage[];
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

function eslintCommand(workRoot: string, filePath: string): { command: string; args: string[] } {
  const packageManager = packageManagerCommand(workRoot);
  if (packageManager === 'yarn') {
    return {
      command: 'yarn',
      args: ['eslint', '--format', 'json', filePath],
    };
  }

  if (packageManager === 'bun') {
    return {
      command: 'bun',
      args: ['x', 'eslint', '--format', 'json', filePath],
    };
  }

  return {
    command: packageManager,
    args: ['exec', 'eslint', '--format', 'json', filePath],
  };
}

export function collectLintFindings(workRoot: string, filePath: string): ScanFinding[] | null {
  const invocation = eslintCommand(workRoot, filePath);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: workRoot,
    encoding: 'utf8',
  });

  if (result.error || !result.stdout.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(result.stdout) as EslintResult[];
    const fileResult = parsed.find((entry) => entry.filePath.endsWith(filePath)) ?? parsed[0];
    if (!fileResult || !Array.isArray(fileResult.messages)) {
      return null;
    }

    return fileResult.messages.slice(0, 8).map((message, index) => ({
      category: message.severity >= 2 ? 'bugs' : 'todo',
      title: `ESLint${message.ruleId ? ` (${message.ruleId})` : ''}: ${message.message}`
        .replace(/\s+/g, ' ')
        .slice(0, 120),
      file: filePath,
      targetFiles: [filePath],
      rationale: message.message,
      validation: 'Run the lint script again.',
      severity: message.severity >= 2 ? 'medium' : 'low',
      effort: 'small',
      risk: 'low',
      sourceAgent: `lint-tool-${index + 1}`,
      evidence: [
        {
          file: filePath,
          startLine: Math.max(1, message.line ?? 1),
          endLine: Math.max(message.line ?? 1, message.endLine ?? message.line ?? 1),
          note: message.ruleId ?? 'eslint',
        },
      ],
      confidence: 0.98,
      techLenses: ['typescript'],
    }));
  } catch {
    return null;
  }
}
