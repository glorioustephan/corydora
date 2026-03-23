# Corydora

[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#project-status)
[![CI](https://github.com/glorioustephan/corydora/actions/workflows/ci.yml/badge.svg)](https://github.com/glorioustephan/corydora/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/corydora.svg)](https://www.npmjs.com/package/corydora)
[![npm downloads](https://img.shields.io/npm/dm/corydora.svg)](https://www.npmjs.com/package/corydora)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Docs](https://img.shields.io/badge/docs-vitepress-7c3aed.svg)](https://glorioustephan.github.io/corydora/)

<p align="center">
  <img src="./logo.png" alt="Corydora" width="320px" />
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
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm pack:preview
```

The main verification surface right now is:

- `pnpm lint`
- `pnpm format:check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm pack:preview`

`pnpm check` runs the core verification steps and is also used by `prepublishOnly`. `pnpm
pack:preview` produces the exact npm tarball shape that CI uploads as a workflow artifact.

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
3. In npm package settings, add a trusted publisher for GitHub Actions with workflow filename
   `publish.yml`.
4. Optionally add a `RELEASE_PLEASE_TOKEN` GitHub secret if you want bot-created release PRs to
   trigger other workflows normally.
5. Optionally protect the `npm` GitHub environment before enabling publish.
6. Publish by merging the release PR that release-please opens against `main`.

Trusted publishing also requires GitHub-hosted runners, Node `22.14.0` or newer, and npm CLI
`11.5.1` or newer. The publish workflow pins Node `24.14.0` and upgrades npm explicitly before it
calls `npm publish`.

## Notes

- Secrets never belong in `.corydora.json`.
- `.corydora/.env.local` is ignored by default.
- Markdown queue files are projections of machine state in `.corydora/state/`.
- The root `CHANGELOG.md` is the canonical release history and is maintained by release-please.
- The npm publish workflow assumes GitHub-hosted runners, which is also what npm trusted publishing
  currently requires.
