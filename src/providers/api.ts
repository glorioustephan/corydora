import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import OpenAI from 'openai';
import type {
  DoctorCheck,
  FixResult,
  RuntimeAdapter,
  RuntimeExecutionContext,
  RuntimeProbe,
  ScanResult,
} from '../types/domain.js';
import {
  buildProbe,
  listChangedFiles,
  missingAuth,
  normalizeFixResult,
  normalizeScanResult,
  successAuth,
  unknownAuth,
} from './utils.js';

abstract class ApiRuntimeAdapter implements RuntimeAdapter {
  readonly executionMode = 'single-file-json' as const;

  constructor(
    readonly id: RuntimeAdapter['id'],
    readonly label: string,
    private readonly models: string[]
  ) {}

  abstract probe(projectRoot: string): Promise<RuntimeProbe>;
  abstract executeScan(context: RuntimeExecutionContext): Promise<ScanResult>;
  abstract executeFix(context: RuntimeExecutionContext): Promise<FixResult>;

  suggestModels(): string[] {
    return this.models;
  }

  async doctor(projectRoot: string): Promise<DoctorCheck[]> {
    const probe = await this.probe(projectRoot);
    return [
      {
        id: `${probe.provider}-auth`,
        ok: probe.auth.status === 'ready',
        message: probe.auth.message,
      },
    ];
  }
}

function extractApiKey(envName: string[]): string | null {
  for (const key of envName) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function applyFileEditsToResult(
  workingDirectory: string,
  parsed: FixResult
): Promise<FixResult> {
  const fileEdits = parsed.fileEdits;
  if (!fileEdits || fileEdits.length === 0) {
    return Promise.resolve(parsed);
  }

  return Promise.all(
    fileEdits.map(edit => writeFile(resolve(workingDirectory, edit.path), edit.content, 'utf8'))
  ).then(() => ({
    ...parsed,
    changedFiles: parsed.changedFiles.length > 0 ? parsed.changedFiles : fileEdits.map(edit => edit.path),
  }));
}

class AnthropicApiAdapter extends ApiRuntimeAdapter {
  constructor() {
    super('anthropic-api', 'Anthropic API', ['claude-sonnet-4-5', 'claude-opus-4-1']);
  }

  async probe(_projectRoot: string): Promise<RuntimeProbe> {
    const apiKey = extractApiKey(['ANTHROPIC_API_KEY']);
    return buildProbe({
      provider: this.id,
      label: this.label,
      installed: true,
      auth: apiKey ? successAuth('ANTHROPIC_API_KEY is present.') : missingAuth('ANTHROPIC_API_KEY is missing.'),
      models: this.suggestModels(),
    });
  }

  async executeScan(context: RuntimeExecutionContext): Promise<ScanResult> {
    if (context.dryRun) {
      return { fileSummary: 'Dry run: scan skipped.', tasks: [], needsHumanReview: false };
    }

    const apiKey = extractApiKey(['ANTHROPIC_API_KEY']);
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for anthropic-api.');
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: context.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: context.prompt }],
    });
    const output = response.content
      .map(block => ('text' in block ? block.text : ''))
      .join('\n')
      .trim();
    return normalizeScanResult(output);
  }

  async executeFix(context: RuntimeExecutionContext): Promise<FixResult> {
    if (context.dryRun) {
      return {
        summary: 'Dry run: fix skipped.',
        validationSummary: 'No validation executed.',
        changedFiles: [],
        needsHumanReview: false,
      };
    }

    const apiKey = extractApiKey(['ANTHROPIC_API_KEY']);
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for anthropic-api.');
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: context.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: context.prompt }],
    });
    const output = response.content
      .map(block => ('text' in block ? block.text : ''))
      .join('\n')
      .trim();
    return applyFileEditsToResult(context.workingDirectory, normalizeFixResult(output));
  }
}

class OpenAiApiAdapter extends ApiRuntimeAdapter {
  constructor() {
    super('openai-api', 'OpenAI API', ['gpt-5', 'gpt-4.1']);
  }

  async probe(_projectRoot: string): Promise<RuntimeProbe> {
    const apiKey = extractApiKey(['OPENAI_API_KEY']);
    return buildProbe({
      provider: this.id,
      label: this.label,
      installed: true,
      auth: apiKey ? successAuth('OPENAI_API_KEY is present.') : missingAuth('OPENAI_API_KEY is missing.'),
      models: this.suggestModels(),
    });
  }

  async executeScan(context: RuntimeExecutionContext): Promise<ScanResult> {
    if (context.dryRun) {
      return { fileSummary: 'Dry run: scan skipped.', tasks: [], needsHumanReview: false };
    }

    const apiKey = extractApiKey(['OPENAI_API_KEY']);
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for openai-api.');
    }

    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: context.model,
      input: context.prompt,
    });
    return normalizeScanResult(response.output_text);
  }

  async executeFix(context: RuntimeExecutionContext): Promise<FixResult> {
    if (context.dryRun) {
      return {
        summary: 'Dry run: fix skipped.',
        validationSummary: 'No validation executed.',
        changedFiles: [],
        needsHumanReview: false,
      };
    }

    const apiKey = extractApiKey(['OPENAI_API_KEY']);
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for openai-api.');
    }

    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: context.model,
      input: context.prompt,
    });
    return applyFileEditsToResult(context.workingDirectory, normalizeFixResult(response.output_text));
  }
}

class GoogleApiAdapter extends ApiRuntimeAdapter {
  constructor() {
    super('google-api', 'Google Generative AI API', ['gemini-2.5-pro', 'gemini-2.5-flash']);
  }

  async probe(_projectRoot: string): Promise<RuntimeProbe> {
    const apiKey = extractApiKey(['GOOGLE_API_KEY', 'GEMINI_API_KEY']);
    return buildProbe({
      provider: this.id,
      label: this.label,
      installed: true,
      auth: apiKey
        ? successAuth('Google API credentials detected.')
        : missingAuth('GOOGLE_API_KEY or GEMINI_API_KEY is missing.'),
      models: this.suggestModels(),
    });
  }

  async executeScan(context: RuntimeExecutionContext): Promise<ScanResult> {
    if (context.dryRun) {
      return { fileSummary: 'Dry run: scan skipped.', tasks: [], needsHumanReview: false };
    }

    const apiKey = extractApiKey(['GOOGLE_API_KEY', 'GEMINI_API_KEY']);
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY is required for google-api.');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${context.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: context.prompt }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Google API request failed with ${response.status}.`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const output =
      payload.candidates?.[0]?.content?.parts
        ?.map(part => part.text ?? '')
        .join('\n')
        .trim() ?? '';

    return normalizeScanResult(output);
  }

  async executeFix(context: RuntimeExecutionContext): Promise<FixResult> {
    if (context.dryRun) {
      return {
        summary: 'Dry run: fix skipped.',
        validationSummary: 'No validation executed.',
        changedFiles: [],
        needsHumanReview: false,
      };
    }

    const apiKey = extractApiKey(['GOOGLE_API_KEY', 'GEMINI_API_KEY']);
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY is required for google-api.');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${context.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: context.prompt }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Google API request failed with ${response.status}.`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const output =
      payload.candidates?.[0]?.content?.parts
        ?.map(part => part.text ?? '')
        .join('\n')
        .trim() ?? '';

    return applyFileEditsToResult(context.workingDirectory, normalizeFixResult(output));
  }
}

class BedrockApiAdapter extends ApiRuntimeAdapter {
  constructor() {
    super('bedrock', 'AWS Bedrock', ['anthropic.claude-3-7-sonnet-20250219-v1:0']);
  }

  async probe(_projectRoot: string): Promise<RuntimeProbe> {
    const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
    const credentialsPresent =
      Boolean(process.env.AWS_PROFILE) ||
      Boolean(process.env.AWS_ACCESS_KEY_ID) ||
      Boolean(process.env.AWS_WEB_IDENTITY_TOKEN_FILE);

    return buildProbe({
      provider: this.id,
      label: this.label,
      installed: true,
      auth:
        region && credentialsPresent
          ? successAuth('AWS region and credentials were detected.')
          : unknownAuth('AWS_REGION and credentials must be configured for Bedrock.'),
      models: this.suggestModels(),
    });
  }

  async executeScan(context: RuntimeExecutionContext): Promise<ScanResult> {
    if (context.dryRun) {
      return { fileSummary: 'Dry run: scan skipped.', tasks: [], needsHumanReview: false };
    }

    const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
    if (!region) {
      throw new Error('AWS_REGION is required for bedrock.');
    }

    const client = new BedrockRuntimeClient({ region });
    const response = await client.send(
      new ConverseCommand({
        modelId: context.model,
        messages: [
          {
            role: 'user',
            content: [{ text: context.prompt }],
          },
        ],
        inferenceConfig: {
          maxTokens: 4096,
        },
      })
    );

    const output =
      response.output?.message?.content
        ?.map(item => ('text' in item ? item.text ?? '' : ''))
        .join('\n')
        .trim() ?? '';

    return normalizeScanResult(output);
  }

  async executeFix(context: RuntimeExecutionContext): Promise<FixResult> {
    if (context.dryRun) {
      return {
        summary: 'Dry run: fix skipped.',
        validationSummary: 'No validation executed.',
        changedFiles: [],
        needsHumanReview: false,
      };
    }

    const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
    if (!region) {
      throw new Error('AWS_REGION is required for bedrock.');
    }

    const client = new BedrockRuntimeClient({ region });
    const response = await client.send(
      new ConverseCommand({
        modelId: context.model,
        messages: [
          {
            role: 'user',
            content: [{ text: context.prompt }],
          },
        ],
        inferenceConfig: {
          maxTokens: 4096,
        },
      })
    );

    const output =
      response.output?.message?.content
        ?.map(item => ('text' in item ? item.text ?? '' : ''))
        .join('\n')
        .trim() ?? '';

    return applyFileEditsToResult(context.workingDirectory, normalizeFixResult(output));
  }
}

class OllamaAdapter extends ApiRuntimeAdapter {
  constructor() {
    super('ollama', 'Ollama', ['qwen2.5-coder:7b', 'deepseek-coder-v2']);
  }

  async probe(_projectRoot: string): Promise<RuntimeProbe> {
    const host = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
    return buildProbe({
      provider: this.id,
      label: this.label,
      installed: true,
      auth: successAuth(`Ollama host configured at ${host}.`),
      models: this.suggestModels(),
    });
  }

  async executeScan(context: RuntimeExecutionContext): Promise<ScanResult> {
    if (context.dryRun) {
      return { fileSummary: 'Dry run: scan skipped.', tasks: [], needsHumanReview: false };
    }

    const host = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
    const response = await fetch(`${host}/api/generate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: context.model,
        prompt: context.prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with ${response.status}.`);
    }

    const payload = (await response.json()) as { response?: string };
    return normalizeScanResult(payload.response ?? '');
  }

  async executeFix(context: RuntimeExecutionContext): Promise<FixResult> {
    if (context.dryRun) {
      return {
        summary: 'Dry run: fix skipped.',
        validationSummary: 'No validation executed.',
        changedFiles: [],
        needsHumanReview: false,
      };
    }

    const host = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
    const response = await fetch(`${host}/api/generate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: context.model,
        prompt: context.prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with ${response.status}.`);
    }

    const payload = (await response.json()) as { response?: string };
    return applyFileEditsToResult(context.workingDirectory, normalizeFixResult(payload.response ?? ''));
  }
}

export const API_RUNTIME_ADAPTERS: RuntimeAdapter[] = [
  new AnthropicApiAdapter(),
  new OpenAiApiAdapter(),
  new GoogleApiAdapter(),
  new BedrockApiAdapter(),
  new OllamaAdapter(),
];
