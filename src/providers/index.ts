import { API_RUNTIME_ADAPTERS } from './api.js';
import { CLI_RUNTIME_ADAPTERS } from './cli.js';
import { FakeRuntimeAdapter } from './fake.js';
import type { RuntimeAdapter, RuntimeProbe, RuntimeProviderId } from '../types/domain.js';

const adapters: RuntimeAdapter[] = [...CLI_RUNTIME_ADAPTERS, ...API_RUNTIME_ADAPTERS, new FakeRuntimeAdapter()];

export function getRuntimeAdapters(): RuntimeAdapter[] {
  return adapters;
}

export function getRuntimeAdapter(provider: RuntimeProviderId): RuntimeAdapter {
  const adapter = adapters.find(candidate => candidate.id === provider);
  if (!adapter) {
    throw new Error(`Unsupported runtime provider: ${provider}`);
  }

  return adapter;
}

export async function probeAvailableRuntimes(projectRoot: string): Promise<RuntimeProbe[]> {
  const probes = await Promise.all(adapters.map(adapter => adapter.probe(projectRoot)));
  const firstReadyIndex = probes.findIndex(
    probe => probe.installed && (probe.auth.status === 'ready' || probe.provider === 'fake')
  );

  return probes.map((probe, index) => ({
    ...probe,
    recommended: index === firstReadyIndex,
  }));
}
