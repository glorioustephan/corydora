---
title: Codex CLI
---

# Codex CLI

The `codex-cli` provider delegates execution to the local `codex` binary (OpenAI Codex CLI). Like other CLI-backed providers it uses native-agent execution, meaning the agent navigates and edits your codebase directly using its own tools.

## Prerequisites

- [OpenAI Codex CLI](https://github.com/openai/codex) installed and on your `PATH`
- An OpenAI API key or a local Codex authentication configuration

Verify the binary is available:

```sh
which codex
```

## Authentication

`codex-cli` accepts credentials in two ways:

**Environment variable** — the simplest approach. Set `OPENAI_API_KEY` in your shell or in `.corydora/.env.local`:

```sh
OPENAI_API_KEY=sk-...
```

**Local Codex config** — if you have previously authenticated through the Codex CLI, credentials are stored in `~/.codex/`. Corydora will detect the presence of that directory and treat auth as potentially configured.

`corydora doctor` reports this check as `codex-cli-auth`. A passing result shows:

```
codex-cli-binary   ✓  OpenAI Codex CLI binary detected.
codex-cli-auth     ✓  OPENAI_API_KEY is present.
```

If `~/.codex/` exists but no `OPENAI_API_KEY` is set, the status will be `unknown` rather than failing — Corydora cannot verify the stored credentials without invoking the CLI:

```
codex-cli-auth     ?  Codex config directory exists; auth may be configured.
```

## Models

| Model         | Notes                              |
| ------------- | ---------------------------------- |
| `gpt-5-codex` | Default. Optimized for code tasks. |
| `gpt-5`       | General-purpose GPT-5.             |

## Execution mode

`codex-cli` uses **native-agent** execution. Corydora writes the prompt to stdin and invokes `codex exec` with sandbox flags that control what the agent is allowed to do.

**Scan phase** — the agent runs in `--sandbox read-only` mode. An output schema is passed via `--output-schema` so the agent returns structured JSON, and the result is written to a temp file via `--output-last-message`:

```sh
codex exec \
  --cd <worktree> \
  --model gpt-5-codex \
  --sandbox read-only \
  --output-schema /tmp/corydora-<id>/scan-schema.json \
  --output-last-message /tmp/corydora-<id>/scan-output.json \
  -
```

**Fix phase** — the agent runs in `--sandbox workspace-write --full-auto` mode, which grants it write access to the workspace without requiring per-edit confirmation:

```sh
codex exec \
  --cd <worktree> \
  --model gpt-5-codex \
  --sandbox workspace-write \
  --full-auto \
  --output-last-message /tmp/corydora-<id>/fix-output.json \
  -
```

Temp files are cleaned up after each invocation.

## Example configuration

```json
{
  "runtime": {
    "provider": "codex-cli",
    "model": "gpt-5-codex"
  }
}
```

## Troubleshooting

**Binary not found**

```
codex-cli-binary   ✗  OpenAI Codex CLI binary not found.
```

Install the Codex CLI and ensure it is on your `PATH`. See the [OpenAI Codex CLI repository](https://github.com/openai/codex) for installation instructions.

**No credentials detected**

```
codex-cli-auth     ✗  No OPENAI_API_KEY or local Codex config detected.
```

Set `OPENAI_API_KEY` in `.corydora/.env.local` or authenticate through the Codex CLI directly.

**Auth unknown despite config directory existing**

If `~/.codex/` is present but the key is not in the environment, Corydora reports `unknown`. Verify the config is valid by running a `codex` command directly.
