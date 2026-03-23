import { describe, expect, it } from 'vitest';
import { getDefaultConfig, parseCorydoraConfig } from './schema.js';

describe('config schema', () => {
  it('creates a strict default config', () => {
    const config = getDefaultConfig({
      provider: 'claude-cli',
      selectedBuiltinAgents: ['bug-investigator'],
    });

    expect(config.runtime.provider).toBe('claude-cli');
    expect(config.git.isolationMode).toBe('worktree');
    expect(config.paths.envFile).toBe('.corydora/.env.local');
  });

  it('rejects malformed config', () => {
    expect(() => parseCorydoraConfig({ version: 1 })).toThrow();
  });
});
