import { describe, expect, it } from 'vitest';
import { getDefaultConfig, parseCorydoraConfig } from './schema.js';

describe('config schema', () => {
  it('creates a strict default config', () => {
    const config = getDefaultConfig({
      provider: 'claude-cli',
      selectedBuiltinAgents: ['bug-investigator'],
    });

    expect(config.runtime.provider).toBe('claude-cli');
    expect(config.runtime.maxOutputTokens).toBe(8192);
    expect(config.runtime.requestTimeoutMs).toBe(900000);
    expect(config.runtime.maxRetries).toBe(3);
    expect(config.git.isolationMode).toBe('worktree');
    expect(config.execution.preventIdleSleep).toBe(true);
    expect(config.paths.envFile).toBe('.corydora/.env.local');
  });

  it('rejects malformed config', () => {
    expect(() => parseCorydoraConfig({ version: 1 })).toThrow();
  });
});
