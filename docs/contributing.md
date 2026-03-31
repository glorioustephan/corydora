---
title: Contributing
---

# Contributing

Corydora is an open-source project and contributions are welcome. This guide covers the development environment, project layout, testing approach, and release process.

## Development Setup

Requirements:

- **Node.js** `24.14.0` or newer for local development and CI
- **pnpm** `10.32.1` or newer

Clone the repository and install dependencies:

```bash
git clone https://github.com/glorioustephan/corydora.git
cd corydora
nvm use 24.14.0
pnpm install
```

The published CLI supports Node.js `20.19.0` or newer, but local development, CI, and release automation are standardized on Node.js `24.14.0`.

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

## Day-To-Day Git Flow

Use short-lived branches and open pull requests for normal changes. Do not commit directly to `main`.

Start a new change:

```bash
git checkout main
git pull origin main
git checkout -b feature/my-change
```

Make changes, then run the full local verification pass:

```bash
pnpm check
```

Stage and commit with a Conventional Commit message:

```bash
git add .
pnpm commit
```

You can also commit manually:

```bash
git commit -m "fix: handle empty workspace in run command"
git commit -m "feat: add provider retry backoff"
git commit -m "feat!: change runtime config schema"
```

Push the branch and open a pull request:

```bash
git push -u origin feature/my-change
gh pr create
```

After review and green CI, merge the pull request into `main`.

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

CI runs on every push to `main` and on every pull request. The main verification workflow is `ci.yml`.

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

Changes under `docs/` also trigger `docs.yml`, which builds the VitePress site and deploys it to GitHub Pages after merge to `main`.

## Release Process

Releases are published to npm automatically via GitHub Actions using release-please and npm trusted publishing (OIDC). No long-lived `NPM_TOKEN` secret is required.

### Semver Rules

release-please derives the next version from Conventional Commits merged into `main`:

- `fix:` => patch release
- `feat:` => minor release
- `feat!:` / `fix!:` / `BREAKING CHANGE:` => major release

### Automated Release Commands

- `pnpm release:plan` runs release-please to create/update the release PR, including `CHANGELOG.md` and version bump.
- `pnpm release:publish` runs the full `prepublishOnly` pipeline (`lint`, `format`, `typecheck`, `test`, `build`) before attempting publish.

### Release Flow

1. Make your change on a branch.
2. Open and merge a pull request into `main`.
3. GitHub Actions runs `publish.yml` on the `main` push.
4. release-please opens or updates a release PR that bumps `package.json` and `CHANGELOG.md`.
5. Review and merge the release PR when you want to publish.
6. The same publish workflow detects the created release, re-runs verification, and publishes the tagged version to npm.

### Maintainer CLI Flow

This is the normal end-to-end command-line workflow:

```bash
cd /Users/jamesleebaker/Codespace/corydora
nvm use 24.14.0

git checkout main
git pull origin main
git checkout -b feature/my-change

# make changes

pnpm check
git add .
pnpm commit
git push -u origin feature/my-change
gh pr create
```

After the feature or fix PR is merged, wait for release-please to open or update the release PR. Then review and merge that PR to ship the release:

```bash
gh pr list
gh pr view <release-pr-number>
gh pr merge <release-pr-number>
```

Do not bump versions by hand, edit `CHANGELOG.md` manually for releases, create git tags yourself, or run `npm publish` for routine releases. release-please and `publish.yml` own that flow.

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
