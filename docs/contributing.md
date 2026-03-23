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

| Command             | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| `pnpm dev`          | Run the CLI from source using tsx (no build step required)   |
| `pnpm lint`         | Run ESLint across source, tests, docs tooling, and workflows |
| `pnpm format`       | Format the repository with Prettier                          |
| `pnpm format:check` | Verify formatting without writing changes                    |
| `pnpm typecheck`    | TypeScript type checking without emitting output             |
| `pnpm test`         | Run the test suite with Vitest                               |
| `pnpm build`        | Compile TypeScript to `dist/`                                |
| `pnpm check`        | Run lint, format, typecheck, test, and build in sequence     |
| `pnpm pack:preview` | Create a local npm tarball for manual install testing        |
| `pnpm commit`       | Open Commitizen for a Conventional Commit message            |
| `pnpm docs:dev`     | Start the VitePress docs site in development mode            |

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
3. `pnpm lint`
4. `pnpm format:check`
5. `pnpm typecheck`
6. `pnpm test`
7. `pnpm build`
8. `pnpm pack:preview`

The npm tarball produced by `pack:preview` is uploaded as a workflow artifact with a 7-day retention period. You can download it from the Actions run to test the exact package that would be published.

## Release Process

Releases are published to npm automatically via GitHub Actions using release-please and npm trusted publishing (OIDC). No long-lived `NPM_TOKEN` secret is required.

1. Stage your work and run `pnpm commit`.
2. Use Conventional Commit types consistently:
   - `fix:` => patch release
   - `feat:` => minor release
   - `feat!:` / `fix!:` / `BREAKING CHANGE:` => major release
3. Merge releasable changes into `main`.
4. release-please opens or updates a release PR that bumps `package.json` and `CHANGELOG.md`.
5. Merge the release PR when you want to publish.
6. The `publish.yml` workflow publishes the tagged release to npm.

If you want CI workflows to run on the bot-created release PR itself, configure a `RELEASE_PLEASE_TOKEN` secret with a GitHub token that can open pull requests.

## Code Conventions

- **Module system**: ESM (`"type": "module"` in `package.json`)
- **TypeScript**: Strict mode with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `verbatimModuleSyntax` enabled
- **CLI framework**: Commander
- **Validation**: Zod for all config and agent output schemas
- **Interactive prompts**: Clack
- **Logging**: Consola
- **Color output**: Automatically suppressed when the `NO_COLOR` environment variable is set

When adding a new command, follow the pattern in `src/commands/` — export a `register(program: Command)` function and import it from `src/index.ts`. When adding a new provider adapter, implement the `ProviderAdapter` interface defined in `src/types/` and register it in `src/constants.ts`.
