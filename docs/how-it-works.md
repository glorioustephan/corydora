---
title: How It Works
description: What to expect from a Corydora run, from file analysis to reviewable fixes.
---

# How It Works

This page explains what Corydora does during a run from a user point of view. If you are looking for the exact flags or config keys, use [CLI Reference](/cli-reference) and [Configuration](/configuration).

## Before a run starts

Corydora reads:

- your repository layout
- your `.corydora.json` file
- the active mode
- the selected agents for that mode
- the provider and model routing for analysis and fixes

If you configured `worktree` isolation, Corydora also checks whether the current run can use it reliably. When a fix route or validation command needs direct access to the repository's installed dependencies, Corydora can fall back to `branch` mode for that run and reports that decision in the CLI.

## During analysis

Corydora builds a file queue from the repository and ranks the files according to the selected mode.

Examples:

- `churn` favors large files that are edited often and recently
- `refactor` favors large, awkward files that are likely to benefit from cleanup
- `linting` prefers tool-backed findings first
- `documentation` favors README files, schemas, CLI/config help, and other public-facing content that is part of the scan set

For large files, Corydora can analyze a smaller set of windows instead of sending the full file content. That keeps analysis requests smaller and helps overnight runs stay cost-aware.

## During fixing

When analysis produces a concrete task, Corydora prepares a concise handoff and then applies the fix against the current file contents. The fixing step only gets the task it needs, not the entire analysis history.

Corydora focuses on smaller, more reviewable changes by default. Broader changes stay out of the automatic fix path unless you explicitly allow them in config.

Each successful fix is committed locally so you can review it later.

## Validation and retries

If `execution.validateAfterFix` is enabled, Corydora validates after each fix:

- `linting` mode runs `lint` when available
- `documentation` mode runs a docs script when available
- other modes run `typecheck` first, then `test` if there is no typecheck script

If a file analysis or fix attempt fails, Corydora does not permanently lose that work item. It tracks attempts, delays retries, and can move work into a deferred state until the next eligible retry window.

## Background runs and resume

When you run with `--background`, Corydora launches in tmux and keeps state on disk as it goes. If a session stops, `corydora run --resume` reclaims expired file and task leases and continues from the saved state instead of starting over.

The main commands for long-running sessions are:

```bash
corydora run --background
corydora status
corydora attach
corydora run --resume
corydora stop
```

## What you will see in `status`

The status view is designed to answer a few practical questions quickly:

- Is the run still active?
- Which mode is running?
- Which isolation mode was actually used?
- Are workers analyzing files or applying fixes right now?
- Is anything deferred and waiting to retry?

Common task states:

| State        | Meaning                          |
| ------------ | -------------------------------- |
| `queued`     | Ready to run                     |
| `leased`     | Claimed by a worker              |
| `applying`   | A fix is being applied           |
| `validating` | Post-fix validation is running   |
| `done`       | Completed successfully           |
| `deferred`   | Will retry later                 |
| `blocked`    | Could not complete automatically |
| `manual`     | Left for human review            |

That is the user-facing lifecycle. The implementation underneath is designed to keep long runs recoverable and the handoffs concise, but you can use Corydora effectively without learning the internals first.
