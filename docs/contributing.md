---
title: Contributing
---

# Contributing

Corydora is an open-source project and contributions are welcome. This guide covers the development environment, project layout, testing approach, and release process.

## Development Setup

Requirements:

- **Node.js** `24.14.0` or newer
- **pnpm** `10.32.1` or newer

Clone the repository and install dependencies:

```bash
git clone https://github.com/glorioustephan/corydora.git
cd corydora
pnpm install
```

## Development Commands

| Command             | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| `pnpm dev`          | Run the CLI from source using tsx (no build step required)     |
| `pnpm typecheck`    | TypeScript type checking without emitting output               |
| `pnpm test`         | Run the test suite with Vitest                                 |
| `pnpm build`        | Compile TypeScript to `dist/`                                  |
| `pnpm check`        | Run typecheck, test, and build in sequence (full verification) |
| `pnpm pack:preview` | Create a local npm tarball for manual install testing          |
| `pnpm docs:dev`     | Start the VitePress docs site in development mode              |

Run `pnpm check` before opening a pull request to confirm the full verification pipeline passes locally.

## Project Structure

```
src/
  commands/       CLI command implementations (init, run, doctor, status, etc.)
  providers/      Runtime adapters (claude-cli, openai-api, bedrock, etc.)
  agents/         Builtin agent catalog and frontmatter parsing
  runtime/        Session orchestration, scheduler, prompt building, tmux
  queue/          Task state management and markdown rendering
  git/            Git operations (commit, branch, worktree isolation)
  config/         Zod schema, defaults, file I/O
  filesystem/     File discovery, project detection, gitignore
  types/          TypeScript domain interfaces
  ui/             Console output and interactive menus
  index.ts        CLI entry point (commander)
  constants.ts    Providers, categories, lenses, defaults
```

Each directory corresponds to a bounded domain. Cross-domain imports go through the public interface of each module rather than reaching into internal files.

## Testing

**Framework**: Vitest with the Node.js environment.

Tests are organized into two layers:

- **Unit tests** (`src/**/*.test.ts`) — focused on individual modules: config parsing, queue state transitions, scheduler selection logic, and the fake runtime adapter.
- **Integration tests** (`test/**/*.test.ts`) — exercise full command paths: `init`, `doctor`, `run --dry-run`, and a complete fake-provider run from scan through fix.

Test fixtures live in `test/fixtures/` and include sample project layouts (`next-app`, `node-lib`, `mixed-workspace`) used by integration tests to simulate real project structures.

```bash
# Run all tests
pnpm test

# Include provider smoke tests (requires real provider auth and binaries)
CORYDORA_ENABLE_PROVIDER_SMOKE=1 pnpm test
```

Provider smoke tests are opt-in because they depend on local vendor authentication and CLI binaries that are not available in CI. Run them locally when making changes to a provider adapter.

## CI Pipeline

CI runs on every push to `main` and on every pull request.

Steps in order:

1. Checkout
2. `pnpm install`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm build`
6. `pnpm pack:preview`

The npm tarball produced by `pack:preview` is uploaded as a workflow artifact with a 7-day retention period. You can download it from the Actions run to test the exact package that would be published.

## Release Process

Releases are published to npm automatically via GitHub Actions using trusted publishing (OIDC). No `NPM_TOKEN` secret is required.

1. Merge all changes to `main`.
2. Confirm `pnpm check` passes locally.
3. Push a semver tag:

```bash
git tag v0.2.0
git push origin v0.2.0
```

The publish workflow triggers on the tag push, builds the package, and publishes it to npm. The tag must follow semver format (`vMAJOR.MINOR.PATCH`).

## Code Conventions

- **Module system**: ESM (`"type": "module"` in `package.json`)
- **TypeScript**: Strict mode with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `verbatimModuleSyntax` enabled
- **CLI framework**: Commander
- **Validation**: Zod for all config and agent output schemas
- **Interactive prompts**: Clack
- **Logging**: Consola
- **Color output**: Automatically suppressed when the `NO_COLOR` environment variable is set

When adding a new command, follow the pattern in `src/commands/` — export a `register(program: Command)` function and import it from `src/index.ts`. When adding a new provider adapter, implement the `ProviderAdapter` interface defined in `src/types/` and register it in `src/constants.ts`.
