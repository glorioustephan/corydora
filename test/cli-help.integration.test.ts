import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runCliCommand } from './helpers.js';

interface PackageMetadata {
  version?: string;
}

function readPackageVersion(): string {
  const raw = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  const parsed = JSON.parse(raw) as PackageMetadata;

  return typeof parsed.version === 'string' ? parsed.version : '0.0.0';
}

describe('CLI help and version output', () => {
  const cwd = process.cwd();
  const packageVersion = readPackageVersion();

  it('prints the package version with --version', () => {
    const result = runCliCommand(['--version'], cwd);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(packageVersion);
    expect(result.stderr).toBe('');
  });

  it('accepts --v as a compatibility alias for --version', () => {
    const result = runCliCommand(['--v'], cwd);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(packageVersion);
    expect(result.stderr).toBe('');
  });

  it('shows richer top-level help content', () => {
    const result = runCliCommand(['--help'], cwd);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: corydora [options] [command]');
    expect(result.stdout).toContain('-V, --version');
    expect(result.stdout).toContain('--json');
    expect(result.stdout).toContain('Commands:');
    expect(result.stdout).toContain('run [options]');
    expect(result.stdout).toContain('Arguments:');
    expect(result.stdout).toContain('Behavior:');
    expect(result.stdout).toContain('Examples:');
    expect(result.stdout).toContain('$ corydora run --background');
    expect(result.stdout).toContain('$ corydora agents import ./agents');
    expect(result.stderr).toBe('');
  });

  it('shows argument details and examples for nested subcommands', () => {
    const result = runCliCommand(['agents', 'import', '--help'], cwd);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: corydora agents import [options] <dir>');
    expect(result.stdout).toContain('Arguments:');
    expect(result.stdout).toContain('Directory containing markdown agent definitions');
    expect(result.stdout).toContain('Examples:');
    expect(result.stdout).toContain('$ corydora agents import ./agents');
    expect(result.stderr).toBe('');
  });
});
