import { describe, expect, it } from 'vitest';
import { getDefaultConfig } from '../config/schema.js';
import { preflightIsolationMode, resolveStageRoute } from './routes.js';

describe('runtime routes', () => {
  it('resolves stage-specific overrides', () => {
    const config = getDefaultConfig({
      provider: 'claude-cli',
      selectedBuiltinAgents: ['bug-investigator'],
    });
    config.runtime.stages.analyze = {
      provider: 'openai-api',
      model: 'gpt-5',
      maxOutputTokens: 4096,
    };

    const route = resolveStageRoute(config, 'analyze');

    expect(route.provider).toBe('openai-api');
    expect(route.model).toBe('gpt-5');
    expect(route.settings.maxOutputTokens).toBe(4096);
    expect(route.settings.requestTimeoutMs).toBe(config.runtime.requestTimeoutMs);
  });

  it('falls back from worktree to branch when fixes need local tooling', () => {
    const config = getDefaultConfig({
      provider: 'claude-cli',
      selectedBuiltinAgents: ['bug-investigator'],
    });

    const result = preflightIsolationMode({
      projectRoot: process.cwd(),
      config,
      fixRoute: resolveStageRoute(config, 'fix'),
      mode: 'auto',
    });

    expect(result.effectiveIsolationMode).toBe('branch');
  });
});
