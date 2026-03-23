import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  DoctorCheck,
  FixResult,
  ProviderAuthStatus,
  RuntimeAdapter,
  RuntimeExecutionContext,
  RuntimeProbe,
  ScanResult,
} from '../types/domain.js';
import {
  buildProbe,
  commandExists,
  listChangedFiles,
  missingAuth,
  normalizeFixResult,
  normalizeScanResult,
  readHomeFile,
  runProcess,
  successAuth,
  unknownAuth,
} from './utils.js';

interface CliInvocation {
  command: string;
  args: string[];
  stdin?: string;
  outputFile?: string;
  cleanupPaths?: string[];
}

interface CliAdapterDefinition {
  id: 'claude-cli' | 'codex-cli' | 'gemini-cli';
  label: string;
  command: string;
  models: string[];
  detectAuth(): Promise<ProviderAuthStatus>;
  buildScanInvocation(context: RuntimeExecutionContext): Promise<CliInvocation>;
  buildFixInvocation(context: RuntimeExecutionContext): Promise<CliInvocation>;
}

async function createTempFile(prefix: string, content: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'corydora-'));
  const filePath = join(directory, prefix);
  await writeFile(filePath, content, 'utf8');
  return filePath;
}

async function readInvocationOutput(invocation: CliInvocation, stdout: string): Promise<string> {
  if (!invocation.outputFile) {
    return stdout;
  }

  if (!existsSync(invocation.outputFile)) {
    return stdout;
  }

  return readFile(invocation.outputFile, 'utf8');
}

async function cleanupInvocation(invocation: CliInvocation): Promise<void> {
  for (const cleanupPath of invocation.cleanupPaths ?? []) {
    await rm(cleanupPath, { recursive: true, force: true });
  }
}

class CliRuntimeAdapter implements RuntimeAdapter {
  readonly executionMode = 'native-agent' as const;

  constructor(private readonly definition: CliAdapterDefinition) {}

  get id(): RuntimeAdapter['id'] {
    return this.definition.id;
  }

  get label(): string {
    return this.definition.label;
  }

  suggestModels(): string[] {
    return this.definition.models;
  }

  async probe(_projectRoot: string): Promise<RuntimeProbe> {
    const installed = commandExists(this.definition.command);
    const auth = installed ? await this.definition.detectAuth() : missingAuth('Binary not found.');
    return buildProbe({
      provider: this.definition.id,
      label: this.definition.label,
      installed,
      auth,
      models: this.definition.models,
    });
  }

  async doctor(projectRoot: string): Promise<DoctorCheck[]> {
    const probe = await this.probe(projectRoot);
    return [
      {
        id: `${probe.provider}-binary`,
        ok: probe.installed,
        message: probe.installed
          ? `${probe.label} binary detected.`
          : `${probe.label} binary not found.`,
      },
      {
        id: `${probe.provider}-auth`,
        ok: probe.auth.status === 'ready',
        message: probe.auth.message,
      },
    ];
  }

  async executeScan(context: RuntimeExecutionContext): Promise<ScanResult> {
    if (context.dryRun) {
      return {
        fileSummary: 'Dry run: scan was not executed.',
        tasks: [],
        needsHumanReview: false,
        rawText: '',
      };
    }

    const invocation = await this.definition.buildScanInvocation(context);
    try {
      const result = await runProcess({
        command: invocation.command,
        args: invocation.args,
        cwd: context.workingDirectory,
        ...(invocation.stdin ? { stdin: invocation.stdin } : {}),
      });
      const output = await readInvocationOutput(invocation, result.stdout);
      if (result.exitCode !== 0) {
        throw new Error(result.stderr || output || `${this.label} scan execution failed.`);
      }

      return normalizeScanResult(output);
    } finally {
      await cleanupInvocation(invocation);
    }
  }

  async executeFix(context: RuntimeExecutionContext): Promise<FixResult> {
    if (context.dryRun) {
      return {
        summary: 'Dry run: fix was not executed.',
        validationSummary: 'No validation executed.',
        changedFiles: [],
        needsHumanReview: false,
        rawText: '',
      };
    }

    const beforeChangedFiles = listChangedFiles(context.workingDirectory);
    const invocation = await this.definition.buildFixInvocation(context);
    try {
      const result = await runProcess({
        command: invocation.command,
        args: invocation.args,
        cwd: context.workingDirectory,
        ...(invocation.stdin ? { stdin: invocation.stdin } : {}),
      });
      const output = await readInvocationOutput(invocation, result.stdout);
      if (result.exitCode !== 0) {
        throw new Error(result.stderr || output || `${this.label} fix execution failed.`);
      }

      const parsed = normalizeFixResult(output);
      const afterChangedFiles = listChangedFiles(context.workingDirectory);
      const changedFiles = parsed.changedFiles.length > 0 ? parsed.changedFiles : afterChangedFiles;
      return {
        ...parsed,
        changedFiles: changedFiles.filter((file) => !beforeChangedFiles.includes(file)),
      };
    } finally {
      await cleanupInvocation(invocation);
    }
  }
}

const claudeAdapter = new CliRuntimeAdapter({
  id: 'claude-cli',
  label: 'Claude Code',
  command: 'claude',
  models: ['sonnet', 'opus'],
  async detectAuth(): Promise<ProviderAuthStatus> {
    const result = await runProcess({
      command: 'claude',
      args: ['auth', 'status'],
      cwd: process.cwd(),
    }).catch(() => null);

    if (!result) {
      return unknownAuth('Unable to determine Claude auth status.');
    }

    return result.exitCode === 0
      ? successAuth('Claude auth is configured.')
      : missingAuth('Claude binary is present but not authenticated.');
  },
  async buildScanInvocation(context) {
    return {
      command: 'claude',
      args: [
        '-p',
        '--model',
        context.model,
        '--output-format',
        'text',
        '--permission-mode',
        'plan',
        '--allowedTools',
        'Read',
        '--allowedTools',
        'Glob',
        '--allowedTools',
        'Grep',
      ],
      stdin: context.prompt,
    };
  },
  async buildFixInvocation(context) {
    return {
      command: 'claude',
      args: [
        '-p',
        '--model',
        context.model,
        '--output-format',
        'text',
        '--permission-mode',
        'acceptEdits',
        '--allowedTools',
        'Read',
        '--allowedTools',
        'Write',
        '--allowedTools',
        'Edit',
        '--allowedTools',
        'Glob',
        '--allowedTools',
        'Grep',
        '--allowedTools',
        'Bash(git status*)',
        '--allowedTools',
        'Bash(git diff*)',
      ],
      stdin: context.prompt,
    };
  },
});

const codexAdapter = new CliRuntimeAdapter({
  id: 'codex-cli',
  label: 'OpenAI Codex CLI',
  command: 'codex',
  models: ['gpt-5-codex', 'gpt-5'],
  async detectAuth(): Promise<ProviderAuthStatus> {
    if (process.env.OPENAI_API_KEY) {
      return successAuth('OPENAI_API_KEY is present.');
    }

    if (readHomeFile('.codex')) {
      return unknownAuth('Codex config directory exists; auth may be configured.');
    }

    return missingAuth('No OPENAI_API_KEY or local Codex config detected.');
  },
  async buildScanInvocation(context) {
    const schemaPath = await createTempFile(
      'scan-schema.json',
      JSON.stringify(
        {
          type: 'object',
          properties: {
            fileSummary: { type: 'string' },
            tasks: { type: 'array' },
            needsHumanReview: { type: 'boolean' },
          },
          required: ['fileSummary', 'tasks'],
        },
        null,
        2,
      ),
    );
    const outputPath = await createTempFile('scan-output.json', '');
    return {
      command: 'codex',
      args: [
        'exec',
        '--cd',
        context.workingDirectory,
        '--model',
        context.model,
        '--sandbox',
        'read-only',
        '--output-schema',
        schemaPath,
        '--output-last-message',
        outputPath,
        '-',
      ],
      stdin: context.prompt,
      outputFile: outputPath,
      cleanupPaths: [join(schemaPath, '..'), join(outputPath, '..')],
    };
  },
  async buildFixInvocation(context) {
    const outputPath = await createTempFile('fix-output.json', '');
    return {
      command: 'codex',
      args: [
        'exec',
        '--cd',
        context.workingDirectory,
        '--model',
        context.model,
        '--sandbox',
        'workspace-write',
        '--full-auto',
        '--output-last-message',
        outputPath,
        '-',
      ],
      stdin: context.prompt,
      outputFile: outputPath,
      cleanupPaths: [join(outputPath, '..')],
    };
  },
});

const geminiAdapter = new CliRuntimeAdapter({
  id: 'gemini-cli',
  label: 'Google Gemini CLI',
  command: 'gemini',
  models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  async detectAuth(): Promise<ProviderAuthStatus> {
    if (
      process.env.GOOGLE_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS
    ) {
      return successAuth('Google credentials detected in the environment.');
    }

    return readHomeFile('.config/gcloud')
      ? unknownAuth('gcloud config exists; Gemini CLI may be authenticated through ADC.')
      : missingAuth('No Gemini or Google credentials detected.');
  },
  async buildScanInvocation(context) {
    return {
      command: 'gemini',
      args: [
        '--model',
        context.model,
        '--sandbox',
        'true',
        '--approval-mode',
        'default',
        '--output-format',
        'text',
        '--prompt',
        context.prompt,
      ],
    };
  },
  async buildFixInvocation(context) {
    return {
      command: 'gemini',
      args: [
        '--model',
        context.model,
        '--sandbox',
        'true',
        '--approval-mode',
        'auto_edit',
        '--output-format',
        'text',
        '--prompt',
        context.prompt,
      ],
    };
  },
});

export const CLI_RUNTIME_ADAPTERS: RuntimeAdapter[] = [claudeAdapter, codexAdapter, geminiAdapter];
