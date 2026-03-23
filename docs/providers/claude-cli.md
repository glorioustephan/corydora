---
title: Claude CLI
---

# Claude CLI

The `claude-cli` provider delegates all execution to the local `claude` binary (Claude Code). It is the recommended provider for multi-file refactoring tasks because the agent can navigate your codebase using its own tools without Corydora having to intermediate file reads or writes.

## Prerequisites

- [Claude Code](https://claude.ai/code) installed and on your `PATH`
- An authenticated Claude Code session

Verify the binary is available:

```sh
which claude
```

## Authentication

`claude-cli` uses Claude Code's own credential store — there is no API key to set. Run the following to check your authentication status:

```sh
claude auth status
```

If the command exits with a non-zero code, run `claude auth login` to authenticate.

`corydora doctor` reports this check as `claude-cli-auth`. A passing result shows:

```
claude-cli-binary   ✓  Claude Code binary detected.
claude-cli-auth     ✓  Claude auth is configured.
```

## Models

| Model    | Notes                                          |
| -------- | ---------------------------------------------- |
| `sonnet` | Default. Fast and capable for most tasks.      |
| `opus`   | Highest capability. Use for complex refactors. |

## Execution mode

`claude-cli` uses **native-agent** execution. Corydora writes the prompt to stdin and spawns `claude -p` with tightly scoped flags.

**Scan phase** — the agent runs with `--permission-mode plan`, which restricts it to read-only operations. Only `Read`, `Glob`, and `Grep` tools are allowed:

```sh
claude -p --model sonnet --output-format text \
  --permission-mode plan \
  --allowedTools Read \
  --allowedTools Glob \
  --allowedTools Grep
```

**Fix phase** — the agent runs with `--permission-mode acceptEdits`, which allows file modifications. Allowed tools are `Read`, `Write`, `Edit`, `Glob`, `Grep`, plus `Bash(git status*)` and `Bash(git diff*)` for validation:

```sh
claude -p --model sonnet --output-format text \
  --permission-mode acceptEdits \
  --allowedTools Read --allowedTools Write --allowedTools Edit \
  --allowedTools Glob --allowedTools Grep \
  --allowedTools 'Bash(git status*)' \
  --allowedTools 'Bash(git diff*)'
```

Because the agent writes files directly, `claude-cli` works best with Corydora's default `worktree` isolation mode so generated changes stay on a dedicated branch.

## Example configuration

```json
{
  "runtime": {
    "provider": "claude-cli",
    "model": "sonnet"
  }
}
```

To use Opus:

```json
{
  "runtime": {
    "provider": "claude-cli",
    "model": "opus"
  }
}
```

## Troubleshooting

**Binary not found**

```
claude-cli-binary   ✗  Claude Code binary not found.
```

Install Claude Code from [claude.ai/code](https://claude.ai/code) and ensure the `claude` binary is on your `PATH`.

**Not authenticated**

```
claude-cli-auth     ✗  Claude binary is present but not authenticated.
```

Run `claude auth login` and complete the authentication flow.

**Auth status unknown**

```
claude-cli-auth     ?  Unable to determine Claude auth status.
```

Corydora could not execute `claude auth status`. This usually means the binary exists but threw an unexpected error. Check `claude auth status` directly and resolve any errors it reports.
