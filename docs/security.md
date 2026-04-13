---
title: Security Model
description: How Corydora handles secrets, git isolation, provider access, and local validation.
---

# Security Model

Corydora is designed to keep control in your hands. It runs locally, writes to a git-isolated workspace or branch, and leaves publishing decisions to you.

## Secrets Management

`.corydora.json` does not store secrets. Put API keys and similar credentials in `.corydora/.env.local`, which Corydora creates during `init` and keeps out of git by default.

Use that file for provider credentials. Do not commit it.

If it does get staged accidentally:

```bash
git rm --cached .corydora/.env.local
```

## Git Isolation

Corydora supports three isolation modes in `git.isolationMode`.

### `worktree`

```json
{ "git": { "isolationMode": "worktree" } }
```

Corydora tries to keep generated changes away from your main checkout.

### `branch`

```json
{ "git": { "isolationMode": "branch" } }
```

Corydora creates a generated branch in the current checkout.

### `current-branch`

```json
{ "git": { "isolationMode": "current-branch" } }
```

Corydora edits your active branch directly. This is the least isolated option and requires an explicit choice.

### Configured mode vs effective mode

For reliability, a run configured for `worktree` may still use `branch` when the chosen fix route or post-fix validation step needs direct access to the repository's installed dependencies. Corydora reports both the configured isolation mode and the effective isolation mode so you can see exactly what happened.

Use `worktree` or `branch` unless you have a specific reason to work on the current branch.

## Runtime Permissions

Provider access depends on how you run Corydora.

### Analysis

Analysis does not modify files. Corydora either sends file content to an API provider or lets a CLI-backed provider inspect the repository in the working directory.

| Provider                                                                         | Constraint                                                              |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `claude-cli`                                                                     | `--permission-mode plan` with only Read, Glob, and Grep tools available |
| `codex-cli`                                                                      | `--sandbox read-only`                                                   |
| API providers (`anthropic-api`, `openai-api`, `google-api`, `bedrock`, `ollama`) | Receive file content as prompt context; have no filesystem access       |

### Fixing

Fixes are scoped to the task Corydora is applying.

| Provider      | Constraint                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `claude-cli`  | `--permission-mode acceptEdits`; Bash tool restricted to `git status*` and `git diff*` patterns |
| `codex-cli`   | `--sandbox workspace-write --full-auto`                                                         |
| API providers | Return replacement content in structured JSON; Corydora writes to disk                          |

## Validation and review boundaries

When `execution.validateAfterFix` is enabled, Corydora runs a local validation command after each fix. That validation runs on your machine against your repository, not inside a remote service.

This gives you two lines of defense:

- isolated git output
- local validation before Corydora moves on to the next change

## Risk Classification

Corydora classifies findings by scope. By default, it avoids automatically applying broader changes.

| Level    | Meaning                                                              |
| -------- | -------------------------------------------------------------------- |
| `low`    | Narrow, self-contained change with minimal blast radius              |
| `medium` | Moderate scope; touches a single module or component                 |
| `broad`  | Cross-cutting change; may affect multiple files or public interfaces |

If you want Corydora to include broader changes, enable `scan.allowBroadRisk`.

```json
{ "scan": { "allowBroadRisk": true } }
```

Only enable that when you are comfortable with a wider change surface.

## What Corydora Does Not Do

- Does not push branches or create pull requests automatically. All changes stay local until you push them.
- Does not modify your main branch unless you explicitly run in `current-branch` mode while on that branch.
- Does not send source code to any service other than the AI provider you have configured in `.corydora.json`.
- Does not store or log API keys in `.corydora.json`.
