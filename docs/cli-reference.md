---
title: CLI Reference
description: Command and flag reference for the Corydora CLI.
---

# CLI Reference

This page documents the public CLI surface for `corydora`. Every command also accepts the global `--json` flag if you want structured output for scripts or automation.

## Global Options

| Flag              | Description                                                             |
| ----------------- | ----------------------------------------------------------------------- |
| `--json`          | Print machine-readable JSON output instead of formatted terminal output |
| `-V`, `--version` | Print the installed Corydora version and exit                           |
| `-h`, `--help`    | Show command help                                                       |

## `corydora`

The top-level command is context-aware:

| Condition                   | Behavior                   |
| --------------------------- | -------------------------- |
| No `.corydora.json` present | Runs `corydora init`       |
| Config exists, TTY attached | Shows the interactive menu |
| Config exists, no TTY       | Runs `corydora status`     |

## `corydora init`

Creates `.corydora.json` and the `.corydora/` working directory for the current repository.

Use `--yes` to accept detected defaults without prompts.

**Flags**

| Flag    | Description                                    |
| ------- | ---------------------------------------------- |
| `--yes` | Accept all detected defaults without prompting |

**Examples**

```sh
corydora init
corydora init --yes
corydora init --yes --json
```

**JSON output**

```json
{
  "projectRoot": "/path/to/project",
  "provider": "claude-cli",
  "model": "sonnet",
  "isolationMode": "worktree",
  "fingerprint": {
    "packageManager": "pnpm",
    "frameworks": ["nextjs"],
    "techLenses": ["typescript", "react", "nextjs"]
  }
}
```

## `corydora run`

Starts a run for the current project. `run` is the command you will use most often.

**Flags**

| Flag                    | Description                                                                    |
| ----------------------- | ------------------------------------------------------------------------------ |
| `--dry-run`             | Show the next analysis batch and selected agents without making provider calls |
| `--background`          | Launch the run in a detached tmux session                                      |
| `--foreground`          | Force foreground execution even when background mode is enabled by default     |
| `--resume`              | Resume the last recorded run                                                   |
| `--mode <mode>`         | Override the configured default mode for this run                              |
| `--agent <ids>`         | Override the selected agent IDs for this run with a comma-separated list       |
| `--no-verify`           | Skip git commit hooks while applying fixes                                     |
| `--session-name <name>` | Override the generated tmux session name                                       |

**Modes**

`auto`, `churn`, `clean`, `refactor`, `performance`, `linting`, `documentation`

**Examples**

```sh
corydora run
corydora run --dry-run
corydora run --background
corydora run --resume
corydora run --mode churn
corydora run --mode refactor --agent refactoring-engineer
corydora run --foreground
```

**Dry-run JSON output**

```json
{
  "dryRun": true,
  "provider": "claude-cli",
  "model": "sonnet",
  "mode": "churn",
  "selectedAgents": ["refactoring-engineer", "bug-investigator"],
  "nextScanBatch": ["src/lib/parser.ts", "src/lib/formatter.ts"],
  "nextAnalysisBatch": ["src/lib/parser.ts", "src/lib/formatter.ts"],
  "nextTask": "Remove duplicate parsing branch in parser.ts"
}
```

**Background JSON output**

```json
{
  "background": true,
  "sessionName": "corydora-my-project-123456",
  "keepAwake": true
}
```

`--background` requires tmux. On macOS, Corydora also reports whether it enabled keep-awake support for the session.

## `corydora status`

Shows the current or most recent run, including worker activity and queue counts.

**Examples**

```sh
corydora status
corydora status --json
```

**JSON output**

```json
{
  "runState": {
    "runId": "run-1711234567890",
    "status": "running",
    "phase": "fix",
    "provider": "claude-cli",
    "isolationMode": "worktree",
    "effectiveIsolationMode": "branch",
    "mode": "auto",
    "selectedAgentIds": ["bug-investigator", "refactoring-engineer"],
    "branchName": "corydora/run-1711234567890",
    "workers": [
      {
        "id": "analyze-1",
        "kind": "analyze",
        "status": "running",
        "details": "src/lib/parser.ts"
      }
    ],
    "background": {
      "sessionName": "corydora-my-project-123456",
      "keepAwake": true
    }
  },
  "queue": {
    "queued": 4,
    "leased": 1,
    "applying": 1,
    "validating": 0,
    "done": 12,
    "deferred": 2,
    "blocked": 1,
    "manual": 0
  },
  "files": {
    "queued": 18,
    "leased": 1,
    "analyzed": 42,
    "deferred": 0,
    "manual": 0
  },
  "nextRetry": ["task_abc123 @ 2026-04-12T08:30:00.000Z"],
  "tmuxAttached": true
}
```

## `corydora attach`

Attaches your terminal to the tmux session for the active background run.

**Example**

```sh
corydora attach
```

## `corydora stop`

Requests a graceful stop for the active run. If the run is using tmux, Corydora also stops the tmux session.

**Examples**

```sh
corydora stop
corydora stop --json
```

**JSON output**

```json
{
  "stopRequested": true,
  "tmuxStopped": true
}
```

## `corydora doctor`

Checks local prerequisites and runtime readiness.

**Examples**

```sh
corydora doctor
corydora doctor --json
```

**Example terminal output**

```
Package manager: pnpm
Frameworks: nextjs
tmux available: yes
background keep-awake available: yes
claude-cli: installed=true auth=ready (claude binary found)
anthropic-api: installed=true auth=missing (ANTHROPIC_API_KEY not set)
openai-api: installed=true auth=missing (OPENAI_API_KEY not set)
Configured mode: auto
Fix route: claude-cli (sonnet)
Isolation compatibility: worktree -> branch
Validation command: pnpm run typecheck
```

**JSON output**

```json
{
  "fingerprint": {
    "packageManager": "pnpm",
    "frameworks": ["nextjs"],
    "techLenses": ["typescript", "react", "nextjs"]
  },
  "tmuxAvailable": true,
  "backgroundKeepAwakeAvailable": true,
  "runtimes": [
    {
      "provider": "claude-cli",
      "label": "Claude CLI",
      "installed": true,
      "recommended": true,
      "auth": { "status": "ready", "message": "claude binary found" },
      "models": ["sonnet", "haiku", "opus"]
    }
  ],
  "checks": [
    {
      "provider": "claude-cli",
      "checks": [{ "id": "binary", "ok": true, "message": "claude binary found" }]
    }
  ],
  "config": {
    "mode": "auto",
    "fixProvider": "claude-cli",
    "effectiveIsolationMode": "branch",
    "validationCommand": "pnpm run typecheck",
    "lintPrerequisite": null
  }
}
```

## `corydora agents list`

Lists builtin agents and any imported agents available to the current project.

**Examples**

```sh
corydora agents list
corydora agents list --json
```

## `corydora agents import <dir>`

Imports markdown-based agent definitions from a directory.

**Arguments**

| Argument | Description                                     |
| -------- | ----------------------------------------------- |
| `<dir>`  | Directory containing markdown agent definitions |

**Examples**

```sh
corydora agents import ./my-agents
corydora agents import ./my-agents --json
```

**JSON output**

```json
[
  {
    "id": "my-custom-agent",
    "label": "My Custom Agent",
    "description": "Does something specific to our stack.",
    "categories": ["bugs"],
    "techLenses": ["typescript"],
    "source": "imported"
  }
]
```

## `corydora config validate`

Validates `.corydora.json`.

**Examples**

```sh
corydora config validate
corydora config validate --json
```

**JSON output**

```json
{
  "ok": true,
  "config": { "version": 1, "git": { "...": "..." } }
}
```
