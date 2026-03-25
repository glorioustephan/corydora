---
title: CLI Reference
---

# CLI Reference

This page documents every command and flag available in the `corydora` CLI. All commands accept a global `--json` flag for scripted and CI use.

## Global Options

| Flag              | Description                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `--json`          | Print machine-readable JSON output instead of formatted terminal output. Works with every command. |
| `-V`, `--version` | Print the installed Corydora version and exit.                                                     |
| `-h`, `--help`    | Show command help, including subcommand usage, flags, arguments, and examples.                     |

---

## `corydora`

The default action. Behavior depends on whether `.corydora.json` exists and whether a TTY is attached.

| Condition                   | Behavior                                           |
| --------------------------- | -------------------------------------------------- |
| No `.corydora.json` present | Runs `corydora init`                               |
| Config exists, TTY attached | Shows interactive menu (run, status, doctor, init) |
| Config exists, no TTY       | Runs `corydora status`                             |

**Usage**

```sh
corydora
corydora --help
corydora --version
corydora --json
```

---

## `corydora init`

Scaffolds a new Corydora project. Creates `.corydora.json`, the `.corydora/` working directory, markdown queue files for each task category, and a `.corydora/.env.local` template for local secrets.

In interactive mode, `init` probes available runtimes, detects the project's tech stack, and prompts you to confirm or override each setting. Pass `--yes` to skip all prompts and accept the detected defaults.

**Flags**

| Flag    | Description                                    |
| ------- | ---------------------------------------------- |
| `--yes` | Accept all detected defaults without prompting |

**Usage**

```sh
# Interactive
corydora init

# Accept defaults (useful in CI or bootstrapping scripts)
corydora init --yes

# Output created config as JSON
corydora init --yes --json
```

**JSON output shape**

```json
{
  "projectRoot": "/path/to/project",
  "provider": "claude-cli",
  "model": "sonnet",
  "isolationMode": "worktree",
  "fingerprint": {
    "packageManager": "pnpm",
    "frameworks": ["next"],
    "techLenses": ["typescript", "react", "nextjs"]
  }
}
```

---

## `corydora run`

Starts the scan-and-fix loop. Corydora discovers candidate files, dispatches them to the configured agents in batches, and applies fixes as tasks are confirmed.

By default the run executes in the foreground. Pass `--background` to launch it inside a detached tmux session.

**Flags**

| Flag                    | Description                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `--dry-run`             | Preview the next scan batch and pending task without executing any provider actions                      |
| `--background`          | Launch the run in a detached tmux session. Requires tmux to be installed                                 |
| `--foreground`          | Force foreground execution even when `execution.backgroundByDefault` is `true` in config                 |
| `--resume`              | Resume from the last recorded run state instead of starting fresh                                        |
| `--session-name <name>` | Override the generated tmux session name (used internally when `--background` re-invokes `--foreground`) |

**Usage**

```sh
# Standard foreground run
corydora run

# Preview without making changes
corydora run --dry-run

# Run overnight in a tmux session
corydora run --background

# Resume a previously interrupted run
corydora run --resume

# Foreground even when backgroundByDefault is true
corydora run --foreground
```

**Dry-run JSON output shape**

```json
{
  "dryRun": true,
  "provider": "claude-cli",
  "model": "sonnet",
  "nextScanBatch": ["src/lib/parser.ts", "src/lib/formatter.ts"],
  "nextTask": {
    "title": "Fix null reference in getUserById",
    "status": "pending",
    "risk": "narrow"
  }
}
```

**Background JSON output shape**

```json
{
  "background": true,
  "sessionName": "corydora-my-project-123456",
  "keepAwake": true
}
```

> `--background` requires tmux. If tmux is unavailable, the command exits with an error suggesting `--foreground`.
> On macOS, `keepAwake` is `true` when Corydora was able to wrap the background run with `caffeinate -i`.

---

## `corydora status`

Shows the current or most recent run state: phase, run ID, overall status, and task queue counts. Also reports whether a live tmux session is attached to this project.

**Usage**

```sh
corydora status
corydora status --json
```

**JSON output shape**

```json
{
  "runState": {
    "runId": "run-1711234567890",
    "status": "running",
    "phase": "fixing",
    "provider": "claude-cli",
    "isolationMode": "worktree",
    "branchName": "corydora/run-1711234567890",
    "worktreePath": ".corydora/worktrees/run-1711234567890",
    "background": {
      "sessionName": "corydora-my-project-123456",
      "keepAwake": true
    }
  },
  "queue": {
    "pending": 4,
    "claimed": 1,
    "done": 12,
    "failed": 0,
    "blocked": 1
  },
  "tmuxAttached": true
}
```

---

## `corydora attach`

Attaches your terminal to the tmux session of a running background Corydora run. The session name is read from the recorded run state — no arguments needed.

**Usage**

```sh
corydora attach
```

> Exits with an error if no tmux-backed session is recorded, or if the session has already exited.

---

## `corydora stop`

Requests a graceful stop of an active background run. Sets `stopRequested` in the run state file so the session loop exits cleanly at its next checkpoint, then kills the tmux session.

**Usage**

```sh
corydora stop
corydora stop --json
```

**JSON output shape**

```json
{
  "stopRequested": true,
  "tmuxStopped": true
}
```

---

## `corydora doctor`

Reports the availability and authentication status of every provider, tmux support, and detected project characteristics. Useful for diagnosing setup issues before running.

**Usage**

```sh
corydora doctor
corydora doctor --json
```

**Example terminal output**

```
Package manager: pnpm
Frameworks: next
tmux available: yes
claude-cli: installed=true auth=authenticated (claude binary found)
anthropic-api: installed=true auth=unauthenticated (ANTHROPIC_API_KEY not set)
openai-api: installed=true auth=unauthenticated (OPENAI_API_KEY not set)
gemini-cli: installed=false auth=unauthenticated (gemini binary not found)
bedrock: installed=true auth=unauthenticated (AWS credentials not configured)
ollama: installed=false auth=unauthenticated (OLLAMA_HOST not reachable)
```

**JSON output shape**

```json
{
  "fingerprint": {
    "packageManager": "pnpm",
    "frameworks": ["next"],
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
      "auth": { "status": "authenticated", "message": "claude binary found" },
      "models": ["sonnet", "haiku", "opus"]
    }
  ],
  "checks": [
    {
      "provider": "claude-cli",
      "checks": [{ "name": "binary", "ok": true, "message": "claude binary found" }]
    }
  ]
}
```

---

## `corydora agents list`

Lists all active agents — both builtin and any imported agents loaded from the configured `importedAgentDirectory`. Displays each agent's ID, source, categories, tech lenses, and description.

If `.corydora.json` does not exist, falls back to listing all builtin agents.

**Usage**

```sh
corydora agents list
corydora agents list --json
```

**Example terminal output**

```
bug-investigator [builtin] -> Find correctness bugs and concrete failure paths in one file at a time.
performance-engineer [builtin] -> Find unnecessary renders, repeated work, and heavy I/O hot spots.
test-hardener [builtin] -> Identify missing tests, flaky patterns, and weak validation.
todo-triager [builtin] -> Turns comments, skipped code paths, and deferred work into concrete tasks.
feature-scout [builtin] -> Identifies small feature opportunities that fit the existing architecture.
security-auditor [builtin] -> Looks for frontend and backend security issues with concrete exploit paths.
database-reviewer [builtin] -> Finds risky queries, schema drift issues, and performance bottlenecks around data access.
refactoring-engineer [builtin] -> Finds low-risk structural cleanups that make future work easier.
```

---

## `corydora agents import <dir>`

Imports external agent definitions from a directory of markdown files. Each markdown file must include YAML frontmatter declaring the agent's `id`, `label`, `categories`, `techLenses`, and `prompt`.

Imported agent metadata is stored in `.corydora/agents/imported-agents.json` and merged into the active agent catalog at run time.

**Arguments**

| Argument | Description                                           |
| -------- | ----------------------------------------------------- |
| `<dir>`  | Path to the directory containing agent markdown files |

**Usage**

```sh
corydora agents import ./my-agents
corydora agents import ./my-agents --json
```

**JSON output shape**

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

---

## `corydora config validate`

Validates `.corydora.json` against the Zod schema and the published JSON schema at `schemas/corydora.schema.json`. Exits with a non-zero status code and prints each validation error if the config is invalid.

**Usage**

```sh
corydora config validate
corydora config validate --json
```

**JSON output shape (valid config)**

```json
{
  "ok": true,
  "config": { "version": 1, "git": { "..." } }
}
```
