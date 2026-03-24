import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { z } from 'zod';
import type {
  FixResult,
  ProviderAuthStatus,
  RuntimeProviderId,
  RuntimeProbe,
  ScanResult,
} from '../types/domain.js';

const scanFindingSchema = z.object({
  category: z.enum(['bugs', 'performance', 'tests', 'todo', 'features']),
  title: z.string().min(1),
  file: z.string().min(1),
  rationale: z.string().min(1),
  validation: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  effort: z.enum(['small', 'medium', 'large']),
  risk: z.enum(['low', 'medium', 'broad']),
  sourceAgent: z.string().min(1),
  techLenses: z
    .array(
      z.enum([
        'typescript',
        'react',
        'nextjs',
        'node-cli',
        'electron',
        'security',
        'database',
        'refactoring',
      ]),
    )
    .default(['refactoring']),
});

const scanPayloadSchema = z.object({
  fileSummary: z.string().min(1),
  tasks: z.array(scanFindingSchema).default([]),
  needsHumanReview: z.boolean().default(false),
});

const fixPayloadSchema = z.object({
  summary: z.string().min(1),
  validationSummary: z.string().default('Validation delegated to the runtime.'),
  changedFiles: z.array(z.string().min(1)).default([]),
  needsHumanReview: z.boolean().default(false),
  fileEdits: z
    .array(
      z.object({
        path: z.string().min(1),
        content: z.string(),
      }),
    )
    .optional(),
});

export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface RetryableError extends Error {
  retryable: true;
}

export function commandExists(command: string): boolean {
  try {
    execFileSync('which', [command], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function readHomeFile(relativePath: string): boolean {
  return existsSync(join(homedir(), relativePath));
}

export function extractJsonPayload(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
}

export function normalizeScanResult(raw: string): ScanResult {
  const payload = extractJsonPayload(raw);
  if (!payload) {
    throw new Error('Provider response did not include valid scan JSON.');
  }

  const parsed = scanPayloadSchema.parse(JSON.parse(payload));
  return {
    ...parsed,
    rawText: raw,
  };
}

export function normalizeFixResult(raw: string): FixResult {
  const payload = extractJsonPayload(raw);
  if (!payload) {
    throw new Error('Provider response did not include valid fix JSON.');
  }

  const parsed = fixPayloadSchema.parse(JSON.parse(payload));
  if (parsed.fileEdits) {
    return {
      summary: parsed.summary,
      validationSummary: parsed.validationSummary,
      changedFiles: parsed.changedFiles,
      needsHumanReview: parsed.needsHumanReview,
      fileEdits: parsed.fileEdits,
      rawText: raw,
    };
  }

  return {
    summary: parsed.summary,
    validationSummary: parsed.validationSummary,
    changedFiles: parsed.changedFiles,
    needsHumanReview: parsed.needsHumanReview,
    rawText: raw,
  };
}

export async function runProcess(input: {
  command: string;
  args: string[];
  cwd: string;
  stdin?: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
}): Promise<ProcessResult> {
  return new Promise((resolveProcess, reject) => {
    const proc = spawn(input.command, input.args, {
      cwd: input.cwd,
      env: {
        ...process.env,
        ...input.env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timeoutHandle =
      input.timeoutMs !== undefined
        ? setTimeout(() => {
            timedOut = true;
            proc.kill('SIGTERM');
            setTimeout(() => proc.kill('SIGKILL'), 2_000).unref();
          }, input.timeoutMs)
        : null;

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', (error) => reject(error));
    proc.on('close', (code) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      if (timedOut) {
        reject(new Error(`${input.command} timed out after ${input.timeoutMs}ms.`));
        return;
      }

      resolveProcess({
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });

    if (input.stdin) {
      proc.stdin.write(input.stdin);
    }
    proc.stdin.end();
  });
}

export function listChangedFiles(cwd: string): string[] {
  try {
    const raw = execFileSync('git', ['status', '--porcelain'], {
      cwd,
      encoding: 'utf8',
    });

    return raw
      .split('\n')
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map((line) => line.slice(3).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function createRetryableError(message: string): Error {
  const error = new Error(message) as RetryableError;
  error.retryable = true;
  return error;
}

export function isRetryableError(error: unknown): boolean {
  return (
    error instanceof Error && 'retryable' in error && (error as RetryableError).retryable === true
  );
}

export async function retryAsync<T>(options: {
  maxRetries: number;
  operation: (attempt: number) => Promise<T>;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await options.operation(attempt);
    } catch (error) {
      const shouldRetry =
        attempt < options.maxRetries &&
        (options.shouldRetry ? options.shouldRetry(error, attempt) : true);
      if (!shouldRetry) {
        throw error;
      }

      const backoffMs = Math.min(1_000 * 2 ** attempt, 8_000);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, backoffMs));
      attempt += 1;
    }
  }
}

export function successAuth(message: string): ProviderAuthStatus {
  return { status: 'ready', message };
}

export function missingAuth(message: string): ProviderAuthStatus {
  return { status: 'missing', message };
}

export function unknownAuth(message: string): ProviderAuthStatus {
  return { status: 'unknown', message };
}

export function buildProbe(options: {
  provider: RuntimeProviderId;
  label: string;
  installed: boolean;
  auth: ProviderAuthStatus;
  models: string[];
  recommended?: boolean;
}): RuntimeProbe {
  return {
    provider: options.provider,
    label: options.label,
    installed: options.installed,
    auth: options.auth,
    models: options.models,
    recommended: options.recommended ?? false,
  };
}

export function resolvePathFromProject(projectRoot: string, relativePath: string): string {
  return resolve(projectRoot, relativePath);
}

export function resolvePathWithinRoot(rootDir: string, candidatePath: string): string {
  const resolvedPath = resolve(rootDir, candidatePath);
  const relativePath = relative(rootDir, resolvedPath);
  if (
    candidatePath.trim().length === 0 ||
    relativePath === '..' ||
    relativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
  ) {
    throw new Error(`Refusing to write outside the working tree: ${candidatePath}`);
  }

  return resolvedPath;
}
