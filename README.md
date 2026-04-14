# Corydora

[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#project-status)
[![CI](https://github.com/glorioustephan/corydora/actions/workflows/ci.yml/badge.svg)](https://github.com/glorioustephan/corydora/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/corydora.svg)](https://www.npmjs.com/package/corydora)
[![npm downloads](https://img.shields.io/npm/dm/corydora.svg)](https://www.npmjs.com/package/corydora)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Docs](https://img.shields.io/badge/docs-vitepress-7c3aed.svg)](https://glorioustephan.github.io/corydora/)
[![Socket Badge](https://badge.socket.dev/npm/package/corydora/0.4.0)](https://badge.socket.dev/npm/package/corydora/0.4.0)
<p align="center">
  <img src="./logo.webp" alt="Corydora" width="320px" />
</p>

Corydora is a globally installable CLI for overnight AI-assisted codebase cleanup. It detects the
AI runtimes available in a project, creates a `.corydora.json` config plus a `.corydora/` working
area, scans files in isolated passes, renders category-specific task queues, and applies small
safe fixes one task at a time on a dedicated branch or worktree.

## Project Status

Corydora is currently in **alpha**. The CLI, scheduler, queue/state model, provider adapter layer,
and release workflows are implemented, but this is still an early open-source package and the
runtime matrix is not equally mature across providers.

### Current readiness

- Core CLI commands are implemented and covered by automated tests.
- CI is configured for `lint`, `format:check`, `typecheck`, `test`, and `build` on every push and
  pull request to `main`.
- The package supports Node `20.19.0` or newer.
- CI, publish, and local version-manager hints are standardized on Node `24.14.0`.
- npm publishing is configured through GitHub Actions using **npm trusted publishing** and GitHub
  OIDC.
- CI currently runs on `ubuntu-latest` only; a multi-OS matrix is not in place yet.
- CLI-backed runtimes (`claude-cli`, `codex-cli`, `gemini-cli`) support native agent/tool editing.
- API-backed runtimes currently use a constrained JSON rewrite mode that is best suited to
  single-file tasks.
- Background tmux runs on macOS use `caffeinate -i` when available so overnight sessions can keep running with the display asleep.
- Runtime request size, timeout, and retry budgets are configurable in `.corydora.json`.
- Provider smoke tests exist but are opt-in because they depend on local vendor auth and binaries.
- Coverage reporting and coverage thresholds are not wired into CI yet.

### Testability today

- Unit coverage: config parsing, queue state, scheduler selection, fake runtime.
- Integration coverage: `init`, `doctor`, `run --dry-run`, and a full fake-provider run.
- Manual smoke path: build the CLI and run it against a temporary git fixture.
- Real-provider validation: gated behind `CORYDORA_ENABLE_PROVIDER_SMOKE=1`.

## Install

```bash
pnpm add -g corydora
```

## Quickstart

```bash
corydora
corydora init
corydora doctor
corydora run --dry-run
corydora run --background
```

## Development

```bash
fnm use
# or: nvm use
pnpm install
pnpm check
pnpm pack:preview
```

Use `pnpm` for local development and test execution. `npm` is used for publishing to the registry
and is intentionally outside the normal inner-loop flow.

The core development verification commands are:

- `pnpm lint` - linting checks
- `pnpm format:check` - Prettier checks
- `pnpm typecheck` - TypeScript type checking
- `pnpm test` - Unit + integration tests
- `pnpm build` - `tsc` compile output to `dist/`
- `pnpm pack:preview` - creates `artifacts/corydora-<version>.tgz` matching what CI uploads

`pnpm check` is a shortcut for lint + format + typecheck + test + build. It is used both locally
and by `pnpm prepublishOnly` in CI/release jobs.

### Recommended flows

#### 1) Daily dev loop

1. Make changes on your branch.
2. Commit with conventional commit format (`pnpm commit`).
3. Validate before sharing:

```bash
pnpm check
```

4. Open a PR to `main`.

#### 2) Release prep (changelog + version)

After feature/fix PRs merge into `main`, generate or refresh the release pull request:

Set one of these tokens before running release planning:

```bash
export RELEASE_PLEASE_TOKEN=ghp_xxx
# or:
# export GITHUB_TOKEN=ghp_xxx
# export GH_TOKEN=ghp_xxx
```

Optionally pin the repo explicitly:

```bash
export RELEASE_PLEASE_REPO_URL=https://github.com/glorioustephan/corydora
```

```bash
pnpm release:plan
```

This uses release-please to:

- collect merged Conventional Commits
- bump `package.json` version
- update `CHANGELOG.md`

`release:plan` also formats `CHANGELOG.md` after generation.

If formatting or checks fail later, rerun:

```bash
pnpm release:check
```

Merge the release PR when ready.

#### 3) Publish

When the release PR is merged:

- `publish.yml` runs `pnpm prepublishOnly` (same as `pnpm check`)
- then publishes to npm.

For local/manual verification of packaging:

```bash
pnpm release:publish
```

(`pnpm release:publish` runs `pnpm prepublishOnly && npm publish`; only use this when you
understand it bypasses the GitHub release PR workflow.)

### Commit workflow

- `pnpm commit` launches Commitizen with the conventional changelog prompt.
- Conventional Commit types drive semantic versioning through release-please:
  `fix` => patch, `feat` => minor, and `!` / `BREAKING CHANGE` => major.
- Release PRs update `package.json` and `CHANGELOG.md`; you no longer need to push version tags by
  hand.
- ESLint uses a flat config in `eslint.config.mjs`.
- Prettier uses `prettier.config.mjs` and `.editorconfig`.

## Command Surface

- `corydora` launches `init` when `.corydora.json` is missing, otherwise opens a short interactive menu.
- `corydora init` creates `.corydora.json`, `.corydora/`, markdown queue files, and a local env template.
- `corydora run` starts a rolling scan/fix loop with resumable state.
- `corydora status` shows the current or most recent run state.
- `corydora attach` attaches to a tmux-backed background run.
- `corydora stop` requests a graceful stop and kills the tmux session when one exists.
- `corydora doctor` reports runtime availability and auth/config hints.
- `corydora agents list` shows builtin and imported agents.
- `corydora agents import <dir>` imports external agent metadata into `.corydora/agents/`.
- `corydora config validate` validates `.corydora.json`.

## Docs

Full documentation is available at **[glorioustephan.github.io/corydora](https://glorioustephan.github.io/corydora/)**.

- [Getting Started](https://glorioustephan.github.io/corydora/getting-started)
- [Quickstart](https://glorioustephan.github.io/corydora/quickstart)
- [CLI Reference](https://glorioustephan.github.io/corydora/cli-reference)
- [Configuration](https://glorioustephan.github.io/corydora/configuration)
- [Providers](https://glorioustephan.github.io/corydora/providers/)
- [Agent Catalog](https://glorioustephan.github.io/corydora/agents/)
- [Security Model](https://glorioustephan.github.io/corydora/security)
- [How It Works](https://glorioustephan.github.io/corydora/how-it-works)

## CI/CD

Corydora ships two GitHub Actions workflows:

- `ci.yml`: runs `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm format:check`, `pnpm
typecheck`, `pnpm test`, and `pnpm build` on pushes and pull requests to `main`, then uploads an
  npm tarball preview artifact.
- `publish.yml`: runs release-please on pushes to `main`, opens or updates a release PR from
  Conventional Commits, and publishes to npm only when merging that release PR creates a release.

### Trusted publishing requirements

Before the first public release, configure npm trusted publishing for this repository:

1. Create the GitHub repository that will host Corydora.
2. Confirm the `repository`, `homepage`, and `bugs` fields in `package.json` match the real repo.
3. If `corydora` does not exist on npm yet, publish it once manually from your user account so the
   package page and settings exist.
4. In npm package settings for `corydora`, add a trusted publisher for GitHub Actions with workflow
   filename `publish.yml`.
5. Add `RELEASE_PLEASE_TOKEN` as a GitHub secret for `glorioustephan/corydora`; release planning and
   local PR generation use this token and fall back to `GITHUB_TOKEN`/`GH_TOKEN`.
6. Optionally protect the `npm` GitHub environment before enabling publish.
7. After trusted publishing is configured, publish future releases by merging the release PR that
   release-please opens against `main`.

Trusted publishing also requires GitHub-hosted runners, Node `22.14.0` or newer, and npm CLI
`11.5.1` or newer. The publish workflow pins Node `24.14.0` and upgrades npm explicitly before it
calls `npm publish`.

## Notes

- Secrets never belong in `.corydora.json`.
- Add `.corydora/.env.local` to `.gitignore`, or let interactive `corydora init` append Corydora's recommended ignore block.
- Markdown queue files are projections of machine state in `.corydora/state/`.
- The root `CHANGELOG.md` is the canonical release history and is maintained by release-please.
- The npm publish workflow assumes GitHub-hosted runners, which is also what npm trusted publishing
  currently requires.
