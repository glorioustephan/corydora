---
title: How It Works
---

# How It Works

This page describes Corydora's internal architecture — from project detection through file discovery, scanning, task management, fixing, and background execution.

## Project Detection

When Corydora starts, it builds a **project fingerprint** by inspecting the current directory. This fingerprint shapes which agents are activated and how prompts are constructed.

Corydora detects:

- **Package manager** — identified by lockfile presence (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lockb` / `bun.lock`)
- **Frameworks** — Next.js (via `next.config.js`, `app/`, or `pages/`), Electron (via `electron-builder.yml` or `electron.vite.config.*`), and Node.js (via `package.json`)
- **Tech lenses** — a normalized set of capability tags derived from frameworks and directory structure. `typescript` and `refactoring` are always included; others such as `react`, `nextjs`, `electron`, `database`, `node-cli` are added based on what is detected
- **Package count** — monorepo packages under `packages/`, `apps/`, or `clients/` are counted

The resulting tech lenses are used to filter the builtin agent catalog. Only agents whose `techLenses` overlap with the project's detected lenses are activated by default during `init`.

## File Discovery

Corydora walks the project tree recursively, collecting files that match the configured include extensions (default: `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`, `.json`).

Directories listed in `scan.excludeDirectories` are skipped entirely. The defaults exclude generated output and dependency trees:

```
.git, .next, .corydora, .turbo, build, coverage, dist, docs,
documentation, generated, logs, node_modules, out, public,
storybook-static, tmp
```

Type declaration files (`.d.ts`) are excluded regardless of extension configuration.

Discovered files are sorted by priority before scheduling:

1. `src/` files (non-test) — highest priority
2. Other source files (non-test)
3. Test files (paths containing `/__tests__/`, `.spec.`, `.test.`, etc.) — lowest priority

Within each priority tier, files are sorted alphabetically for deterministic ordering across runs.

## The Scan Phase

After discovery, files are grouped by directory segment and processed in batches.

Each scan iteration selects the next batch (default: 6 files) and processes them with up to `scan.maxConcurrentScans` (default: 3) concurrent AI calls. Each concurrent call receives one file at a time along with a structured scan prompt containing:

- The file path and full file content
- The project fingerprint (package manager, frameworks, tech lenses)
- The combined prompts of all enabled agents whose categories are active

The AI provider analyzes the file and returns structured findings. Each finding includes:

| Field       | Values                                             |
| ----------- | -------------------------------------------------- |
| `category`  | `bugs`, `performance`, `tests`, `todo`, `features` |
| `severity`  | `low`, `medium`, `high`, `critical`                |
| `effort`    | `small`, `medium`, `large`                         |
| `risk`      | `low`, `medium`, `broad`                           |
| `title`     | Short description of the issue                     |
| `rationale` | Explanation of why this is a problem               |
| `file`      | Relative path to the file                          |

Findings with `risk: broad` are excluded from automatic fixing unless `scan.allowBroadRisk` is set to `true` in the config.

## Task Queue

Scan findings are normalized into **TaskRecords** and merged into the task store at `.corydora/state/tasks.json`.

Deduplication is SHA256-based: a 16-character hex key is derived from the combination of `category`, `file`, `title`, and `rationale`. If the same logical issue is found again in a subsequent scan, the existing task record is updated rather than duplicated.

Task IDs take the form `task_<dedupeKey>`.

After each scan batch, the task store is re-rendered into five human-readable markdown files in the `.corydora/` directory:

```
.corydora/bugs.md
.corydora/performance.md
.corydora/tests.md
.corydora/todo.md
.corydora/features.md
```

These files are read-only projections of the machine state. They are regenerated automatically and any manual edits will be overwritten.

## The Fix Phase

Once the task backlog reaches the `execution.backlogTarget` threshold (default: 8 pending tasks), or once all files have been scanned and tasks remain, Corydora switches to the fix phase.

For each fix cycle:

1. The oldest `pending` task is claimed and its status is set to `claimed`
2. A fix prompt is constructed containing the task description, rationale, and current file content
3. The fix is dispatched to the configured provider
4. If changes were produced, they are committed to the isolated branch with a message in the form `corydora: <category>: <title>`
5. The task is marked `done` (or `blocked` if no changes were produced)

The fix dispatch strategy depends on the provider type:

- **CLI providers** (`claude-cli`, `codex-cli`, `gemini-cli`) — use native agent mode, where the provider binary runs with tool access and can directly read, write, and modify files in the working directory
- **API providers** (`anthropic-api`, `openai-api`, `google-api`, `bedrock`, `ollama`) — use single-file JSON mode, where the provider returns replacement file content that Corydora writes back to disk

The run continues alternating between scan batches and single-task fixes until all files are scanned and all pending tasks are resolved, or until `execution.maxFixesPerRun` (default: 20) or `execution.maxRuntimeMinutes` (default: 480) is reached.

## Git Isolation

All fixes are applied in an isolated git context to protect your working tree. Three modes are available, configured via `git.isolationMode`:

**Worktree (default)**

```json
{ "git": { "isolationMode": "worktree" } }
```

A separate git worktree is created outside the project directory — on macOS under `~/Library/Caches/corydora/worktrees/<repo>-<runId>`, on Linux under `~/.cache/corydora/worktrees/<repo>-<runId>`. Your main checkout is completely untouched throughout the run. This is the safest mode and the default.

**Branch**

```json
{ "git": { "isolationMode": "branch" } }
```

A new branch is created in the current checkout and all fixes are committed there. The branch switches back automatically when the run completes. Requires a clean working tree at run start.

**Current-branch**

```json
{ "git": { "isolationMode": "current-branch" } }
```

Fixes are applied directly to your current branch. This requires an explicit configuration opt-in and is not offered as the default during `init`. Use with caution.

Branch names follow the pattern `<branchPrefix>/<date>-<runId>` — for example `corydora/2025-03-22-a1b2c3d4`. The prefix defaults to `corydora` and is configurable via `git.branchPrefix`.

## Background Execution

When `--background` is passed (or `execution.backgroundByDefault` is `true`), Corydora launches itself inside a new tmux session instead of running in the foreground.

On macOS, if `execution.preventIdleSleep` is `true` and the built-in `caffeinate` command is available, Corydora wraps the background run in `caffeinate -i`. This prevents idle sleep so the tmux session keeps running while the display is allowed to sleep.

The session is named `corydora-<project>-<timestamp>`. The foreground process exits immediately after the session is created, returning your terminal.

Background session management:

```bash
# Check progress without attaching
corydora status

# Attach to the live tmux session
corydora attach

# Request graceful shutdown after the current task
corydora stop
```

`corydora stop` writes a stop flag to `.corydora/state/run-state.json`. On the next iteration of the main loop, Corydora detects this flag, finishes the task it is currently processing, commits any pending changes, and exits. The tmux session is then terminated.

tmux is required for background mode. If tmux is not available, `corydora run --background` will exit with an error. Use `corydora run` (foreground) instead.

## Resumability

Full run state is persisted to disk after every scan batch and every fix cycle. The state file at `.corydora/state/run-state.json` captures:

- Run ID, provider, model, and isolation context
- Scheduler cursors — which files have been processed and which remain
- Task status — claimed, completed, failed, and blocked task IDs
- Phase (`scan` or `fix`), timestamps, and consecutive failure count

When `corydora run --resume` is invoked, Corydora reads this file and reconstructs the scheduler from its last known position. Files that were already successfully scanned are skipped. Tasks that were already completed are not retried. The run continues from the point of interruption as if it had never stopped.

This makes Corydora safe to interrupt at any time — with `Ctrl+C`, `corydora stop`, a system sleep, or a lost SSH session. The next `--resume` picks up exactly where it left off.
