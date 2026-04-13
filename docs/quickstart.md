---
title: Quickstart
description: Run Corydora for the first time, choose a mode, and review the results the next morning.
---

# Quickstart

This guide walks through the first useful Corydora run in a repository you already work on. The goal is simple: choose a mode, let Corydora do targeted maintenance, and come back to review the output.

## Step 1: Start in a git repository

Move into the repository you want Corydora to work on:

```bash
cd your-project
```

If the directory is not already a git repository, initialize git first:

```bash
git init
```

## Step 2: Initialize Corydora

Create the project config:

```bash
corydora init
```

The setup flow helps you choose:

- a default provider and model
- a git isolation mode
- whether markdown queue files should be tracked in git
- whether runs should default to tmux background mode

When setup finishes, Corydora creates:

- `.corydora.json`
- `.corydora/`

For an unattended setup:

```bash
corydora init --yes
```

## Step 3: Confirm the environment

Run:

```bash
corydora doctor
```

After `init`, `doctor` becomes more useful because it also shows the configured mode, the fix route Corydora will use, the effective isolation mode it expects for that run, and the validation command it plans to execute after each fix.

## Step 4: Preview the next run

Use a dry run before you spend tokens:

```bash
corydora run --dry-run
```

The preview tells you:

- which provider and model will be used
- which mode will run
- which agents are selected
- which files are next in the analysis queue
- which task is next if one is already queued

Dry runs do not call a provider, do not create branches, and do not edit files.

## Step 5: Pick a mode

`auto` is the default and is the right choice if you want Corydora to make balanced maintenance decisions on its own.

If you want to steer the run, choose a mode:

| Mode            | Best for                                                |
| --------------- | ------------------------------------------------------- |
| `auto`          | General overnight cleanup with balanced priorities      |
| `churn`         | Recently changed, frequently touched, larger files      |
| `clean`         | Low-risk cleanup and consistency work                   |
| `refactor`      | Simplifying large or awkward files                      |
| `performance`   | Render-heavy, repeated-work, and I/O hotspots           |
| `linting`       | Lint-first maintenance with AI filling gaps             |
| `documentation` | README, schemas, CLI help, and other public-facing docs |

Examples:

```bash
corydora run --mode auto
corydora run --mode churn
corydora run --mode refactor --agent refactoring-engineer
```

`--agent` lets you override the default agent pool for one run. You can combine builtin and imported agent IDs.

## Step 6: Run in the foreground

Start with a foreground run so you can watch the flow:

```bash
corydora run
```

Corydora will analyze files, queue focused tasks, apply fixes, validate them when a matching script is available, and keep writing progress to `.corydora/state/` so the run can be resumed if needed.

At the end of the run, the CLI prints:

- the run status
- the configured isolation mode
- the effective isolation mode actually used
- the selected agents
- the branch or worktree location when one was created

## Step 7: Run in the background

For overnight work, use tmux-backed background mode:

```bash
corydora run --background
```

If `execution.backgroundByDefault` is enabled in config, `corydora run` will already prefer background mode unless you add `--foreground`.

## Step 8: Monitor or resume the run

Check progress:

```bash
corydora status
```

The status output shows the current phase, queue counts, file counts, the effective isolation mode, worker activity, and the next retry times when deferred work is waiting for another attempt.

Attach to the live tmux session:

```bash
corydora attach
```

If a run stops before it finishes, resume it:

```bash
corydora run --resume
```

Corydora reclaims expired work leases and continues with the remaining queued or deferred work instead of starting from scratch.

## Step 9: Stop gracefully if needed

To request a clean stop:

```bash
corydora stop
```

This asks Corydora to finish its current checkpoint, save state, and stop the tmux session if one is running.

## Step 10: Review the results

When the run completes, review the isolated branch or worktree the CLI reports. Corydora commits fixes incrementally so you can inspect the diff or cherry-pick commits the same way you review human changes.

Useful files under `.corydora/state/`:

| File             | What it is for                                 |
| ---------------- | ---------------------------------------------- |
| `run-state.json` | Current or most recent run summary             |
| `tasks.json`     | Queued, deferred, blocked, and completed tasks |
| `files.json`     | File-level analysis queue and scoring metadata |
| `events.ndjson`  | Append-only event log for the run              |

If you use `documentation` mode and want Corydora to work inside `docs/`, remove `docs` from `scan.excludeDirectories` in `.corydora.json`. Documentation mode can only prioritize files that are part of the scan set.

## A good first overnight run

If you just want a sensible default:

```bash
corydora doctor
corydora run --dry-run
corydora run --mode auto --background
```

Then use [Configuration](/configuration) to make that default fit your project.
