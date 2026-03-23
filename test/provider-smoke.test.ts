import { describe, expect, it } from 'vitest';
import { probeAvailableRuntimes } from '../src/providers/index.js';

const enabled = process.env.CORYDORA_ENABLE_PROVIDER_SMOKE === '1';

describe('provider smoke', () => {
  it.skipIf(!enabled)('can probe locally installed runtimes', async () => {
    const probes = await probeAvailableRuntimes(process.cwd());
    expect(probes.some((probe) => probe.installed)).toBe(true);
  });
});
