import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { getRuntimeAdapter } from '../providers/index.js';
import type {
  CorydoraConfig,
  CorydoraMode,
  GitIsolationMode,
  RuntimeAdapter,
  RuntimeExecutionContext,
  RuntimeProviderId,
  RuntimeRequestSettings,
  RuntimeStageName,
} from '../types/domain.js';

export interface ResolvedStageRoute {
  stage: RuntimeStageName;
  provider: RuntimeProviderId;
  model: string;
  settings: RuntimeRequestSettings;
  fallbackProvider?: RuntimeProviderId | undefined;
}

export function resolveStageRoute(
  config: CorydoraConfig,
  stage: RuntimeStageName,
): ResolvedStageRoute {
  const override = config.runtime.stages[stage];
  return {
    stage,
    provider: override.provider ?? config.runtime.provider,
    model: override.model ?? config.runtime.model,
    settings: {
      maxOutputTokens: override.maxOutputTokens ?? config.runtime.maxOutputTokens,
      requestTimeoutMs: override.requestTimeoutMs ?? config.runtime.requestTimeoutMs,
      maxRetries: override.maxRetries ?? config.runtime.maxRetries,
    },
    fallbackProvider: override.fallbackProvider ?? config.runtime.fallbackProvider,
  };
}

export function getStageAdapter(route: ResolvedStageRoute): RuntimeAdapter {
  return getRuntimeAdapter(route.provider);
}

export function isNativeAgentRoute(route: ResolvedStageRoute): boolean {
  return getStageAdapter(route).executionMode === 'native-agent';
}

export function preflightIsolationMode(options: {
  projectRoot: string;
  config: CorydoraConfig;
  fixRoute: ResolvedStageRoute;
  mode: CorydoraMode;
}): {
  effectiveIsolationMode: GitIsolationMode;
  reason?: string;
} {
  if (options.config.git.isolationMode !== 'worktree') {
    return { effectiveIsolationMode: options.config.git.isolationMode };
  }

  const needsWorkspaceDependencies =
    isNativeAgentRoute(options.fixRoute) ||
    options.config.execution.validateAfterFix ||
    options.mode === 'linting';
  const hasManifest = existsSync(resolve(options.projectRoot, 'package.json'));
  if (!needsWorkspaceDependencies || !hasManifest) {
    return { effectiveIsolationMode: 'worktree' };
  }

  return {
    effectiveIsolationMode: 'branch',
    reason:
      'Fell back to branch isolation because native-agent edits or host validation require dependency access that a clean worktree cannot reliably provide.',
  };
}

async function runWithProviderFallback<T>(
  primaryProvider: RuntimeProviderId,
  fallbackProvider: RuntimeProviderId | undefined,
  executor: (provider: RuntimeProviderId) => Promise<T>,
): Promise<T> {
  try {
    return await executor(primaryProvider);
  } catch (error) {
    if (!fallbackProvider || fallbackProvider === primaryProvider) {
      throw error;
    }

    return executor(fallbackProvider);
  }
}

export async function executeStageScan(
  route: ResolvedStageRoute,
  context: Omit<RuntimeExecutionContext, 'model' | 'settings'>,
): Promise<{
  result: Awaited<ReturnType<RuntimeAdapter['executeScan']>>;
  provider: RuntimeProviderId;
}> {
  const providersTried: RuntimeProviderId[] = [];
  const result = await runWithProviderFallback(
    route.provider,
    route.fallbackProvider,
    async (provider) => {
      providersTried.push(provider);
      const adapter = getRuntimeAdapter(provider);
      return adapter.executeScan({
        ...context,
        model:
          provider === route.provider
            ? route.model
            : (getRuntimeAdapter(provider).suggestModels()[0] ?? route.model),
        settings: route.settings,
      });
    },
  );

  return {
    result,
    provider: providersTried.at(-1) ?? route.provider,
  };
}

export async function executeStageFix(
  route: ResolvedStageRoute,
  context: Omit<RuntimeExecutionContext, 'model' | 'settings'>,
): Promise<{
  result: Awaited<ReturnType<RuntimeAdapter['executeFix']>>;
  provider: RuntimeProviderId;
}> {
  const providersTried: RuntimeProviderId[] = [];
  const result = await runWithProviderFallback(
    route.provider,
    route.fallbackProvider,
    async (provider) => {
      providersTried.push(provider);
      const adapter = getRuntimeAdapter(provider);
      return adapter.executeFix({
        ...context,
        model:
          provider === route.provider
            ? route.model
            : (getRuntimeAdapter(provider).suggestModels()[0] ?? route.model),
        settings: route.settings,
      });
    },
  );

  return {
    result,
    provider: providersTried.at(-1) ?? route.provider,
  };
}
