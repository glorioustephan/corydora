---
title: Quickstart
---

# Quickstart

This tutorial walks you through initializing Corydora in a project and running it for the first time. The whole process takes about five minutes.

## Step 1 — Navigate to your project

Corydora must be run inside a git repository. Change into your project directory:

```bash
cd your-project
```

If the directory is not a git repository, `corydora init` will exit with an error. Initialize git first if needed:

```bash
git init
```

## Step 2 — Initialize

Run the interactive setup:

```bash
corydora init
```

The wizard detects your environment and walks you through a short set of questions:

1. **Provider selection** — Corydora probes for installed runtimes and authenticated providers. The list shows each provider's auth status so you can pick one that is ready to use.
2. **Model selection** — Defaults to the recommended model for the selected provider (e.g., `sonnet` for `claude-cli`, `gemini-2.5-pro` for `gemini-cli`). You can accept the default or type a different model name.
3. **Git isolation mode** — Choose how Corydora isolates its changes:
   - `Dedicated worktree` (recommended) — creates a separate git worktree so your main checkout is completely untouched
   - `New branch in the current checkout` — creates a new branch in place
   - `Current branch (explicit opt-in)` — edits directly on your current branch
4. **Track markdown queue files in git** — whether to commit `.corydora/*.md` task files alongside your code (defaults to no)
5. **Launch long runs in the background by default** — whether `corydora run` should automatically use tmux (defaults to no)

When complete, `init` creates two things in your project:

- **`.corydora.json`** — your project configuration file
- **`.corydora/`** — working directory containing state, logs, and markdown task queues (`bugs.md`, `performance.md`, `tests.md`, `todo.md`, `features.md`)

For non-interactive environments or to accept all defaults:

```bash
corydora init --yes
```

## Step 3 — Check readiness

Run `doctor` to confirm everything is wired up correctly:

```bash
corydora doctor
```

Verify that your chosen provider shows `installed=true auth=ok` before proceeding. If auth is missing, see [Provider Setup](/providers/).

## Step 4 — Preview what would happen

Run a dry run to see what Corydora would do without actually executing anything:

```bash
corydora run --dry-run
```

The output shows:

- Which provider and model will be used
- The next batch of files that would be scanned
- The next pending task that would be fixed (if any tasks are already queued)

This is a safe step — no files are modified, no AI calls are made, and no branches are created.

## Step 5 — Run in the foreground

Start a live run where you see output as it happens:

```bash
corydora run
```

Corydora begins the scan/fix loop immediately. You will see progress as files are scanned and tasks are queued and applied. The run continues until all files have been scanned and all pending tasks have been processed, or until `execution.maxRuntimeMinutes` is reached (default: 480 minutes).

When the run finishes, the output includes the branch or worktree path where fixes were committed.

## Step 6 — Run in the background

For overnight runs, launch in a tmux session:

```bash
corydora run --background
```

This requires tmux to be installed. Corydora starts a new tmux session named `corydora-<project>-<id>` and detaches immediately, returning your terminal. The session name is printed to stdout.

## Step 7 — Monitor progress

Check progress without attaching to the session:

```bash
corydora status
```

This prints the current run's phase (`scan` or `fix`), how many tasks have been completed, which provider is active, and the target branch or worktree path.

To connect directly to the live output:

```bash
corydora attach
```

This attaches your terminal to the running tmux session. Press `Ctrl+b d` to detach without stopping the run.

## Step 8 — Stop gracefully

To stop Corydora after it finishes the current task:

```bash
corydora stop
```

This sets a graceful stop flag. Corydora will complete whichever task it is currently working on, commit any changes, save state, and exit cleanly. The tmux session is also terminated.

## Step 9 — Review the results

Once the run completes, check the isolated branch or worktree for committed fixes. Each fix is a separate git commit with a message in the form:

```
corydora: bugs: <task title>
```

The markdown task queues in `.corydora/` give a human-readable overview of everything found:

| File                       | Contents                      |
| -------------------------- | ----------------------------- |
| `.corydora/bugs.md`        | Bug and security findings     |
| `.corydora/performance.md` | Performance improvement tasks |
| `.corydora/tests.md`       | Missing or weak test coverage |
| `.corydora/todo.md`        | Deferred work and tech debt   |
| `.corydora/features.md`    | Small feature opportunities   |

These files are projections of the machine state in `.corydora/state/tasks.json`. Editing them directly has no effect — they are regenerated on each run.

## Step 10 — Resume a stopped run

If a run was interrupted or stopped, pick up exactly where it left off:

```bash
corydora run --resume
```

Corydora restores the previous run's scheduler cursors, task statuses, and file progress from `.corydora/state/run-state.json`. Files that were already scanned are skipped, and tasks that were already completed are not retried.

The `--resume` flag works with `--background` for overnight resumption:

```bash
corydora run --resume --background
```
