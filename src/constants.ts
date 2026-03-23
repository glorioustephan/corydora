export const CONFIG_FILE_NAME = '.corydora.json';
export const CORYDORA_DIR_NAME = '.corydora';

export const BUILTIN_TASK_CATEGORIES = [
  'bugs',
  'performance',
  'tests',
  'todo',
  'features',
] as const;

export const TECH_LENSES = [
  'typescript',
  'react',
  'nextjs',
  'node-cli',
  'electron',
  'security',
  'database',
  'refactoring',
] as const;

export const RUNTIME_PROVIDER_IDS = [
  'claude-cli',
  'codex-cli',
  'gemini-cli',
  'anthropic-api',
  'openai-api',
  'google-api',
  'bedrock',
  'ollama',
  'fake',
] as const;

export const TASK_CATEGORY_FILES = {
  bugs: 'bugs.md',
  performance: 'performance.md',
  tests: 'tests.md',
  todo: 'todo.md',
  features: 'features.md',
} as const;

export const DEFAULT_INCLUDE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mts',
  '.cts',
  '.mjs',
  '.cjs',
  '.json',
] as const;

export const DEFAULT_EXCLUDE_DIRECTORIES = [
  '.git',
  '.next',
  '.corydora',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'docs',
  'documentation',
  'generated',
  'logs',
  'node_modules',
  'out',
  'public',
  'storybook-static',
  'tmp',
] as const;

export const DEFAULT_MODELS: Record<string, string> = {
  'claude-cli': 'sonnet',
  'codex-cli': 'gpt-5-codex',
  'gemini-cli': 'gemini-2.5-pro',
  'anthropic-api': 'claude-sonnet-4-5',
  'openai-api': 'gpt-5',
  'google-api': 'gemini-2.5-pro',
  bedrock: 'anthropic.claude-3-7-sonnet-20250219-v1:0',
  ollama: 'qwen2.5-coder:7b',
  fake: 'fake-corydora-model',
};

export const DEFAULT_BRANCH_PREFIX = 'corydora';
