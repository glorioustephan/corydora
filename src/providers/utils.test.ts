import { describe, expect, it } from 'vitest';
import { resolvePathWithinRoot } from './utils.js';

describe('resolvePathWithinRoot', () => {
  it('keeps writes inside the working tree', () => {
    expect(resolvePathWithinRoot('/tmp/repo', 'src/index.ts')).toBe('/tmp/repo/src/index.ts');
  });

  it('rejects paths that escape the working tree', () => {
    expect(() => resolvePathWithinRoot('/tmp/repo', '../secrets.txt')).toThrow(
      'Refusing to write outside the working tree',
    );
  });
});
