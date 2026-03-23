---
title: Security Model
---

# Security Model

Corydora is designed with a minimal footprint: it reads your code, delegates work to a configured AI provider, and writes results back through controlled, validated pathways. This page documents the security decisions built into every layer.

## Secrets Management

`.corydora.json` never contains secrets. The config file holds only provider IDs, model names, and behavioral configuration — nothing that would be sensitive if committed to source control.

Project-local secrets (API keys, tokens, environment-specific values) belong in `.corydora/.env.local`, which is gitignored by default. When you run `corydora init`, the `.env.local` template is created automatically with placeholder entries for each configured provider.

```
.corydora/
  .env.local        # gitignored — API keys and secrets go here
  queue/            # generated task markdown files
  state.json        # scheduler cursor and run state
```

Never commit `.env.local`. If it is accidentally staged, remove it with:

```bash
git rm --cached .corydora/.env.local
```

## Git Isolation

Corydora offers three isolation modes that control how generated changes interact with your repository. The mode is set in `.corydora.json` under `git.isolationMode`.

### Worktree mode (default)

```json
{ "git": { "isolationMode": "worktree" } }
```

Corydora creates a separate git worktree in a temporary directory. Your main checkout is completely untouched. Generated changes live in an isolated directory and are only visible to you after you inspect or merge them. This is the safest mode and the default for all new projects.

### Branch mode

```json
{ "git": { "isolationMode": "branch" } }
```

Corydora creates a new branch and checks it out in the same working directory. Your main branch is not modified, but the working tree is shared. This is appropriate when you want to review diffs inline using your normal editor setup.

### Current-branch mode

```json
{ "git": { "isolationMode": "current-branch" } }
```

Corydora edits directly on your active branch. This requires explicit opt-in in the config and should only be used when you understand that generated changes will land on your working branch. There is no automatic rollback if you decide you do not want the results.

**Use worktree or branch mode unless you have a specific reason to work on the current branch.**

## Runtime Permissions

Permission grants differ between the scan phase (read-only analysis) and the fix phase (controlled writes).

### During scans

AI providers operate in read-only mode. No writes to the filesystem occur during a scan pass.

| Provider                                                                         | Constraint                                                              |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `claude-cli`                                                                     | `--permission-mode plan` with only Read, Glob, and Grep tools available |
| `codex-cli`                                                                      | `--sandbox read-only`                                                   |
| API providers (`anthropic-api`, `openai-api`, `google-api`, `bedrock`, `ollama`) | Receive file content as prompt context; have no filesystem access       |

### During fixes

Providers have controlled write access scoped to the task being applied.

| Provider      | Constraint                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `claude-cli`  | `--permission-mode acceptEdits`; Bash tool restricted to `git status*` and `git diff*` patterns                             |
| `codex-cli`   | `--sandbox workspace-write --full-auto`                                                                                     |
| API providers | Return replacement content in structured JSON; Corydora writes to disk — the provider never touches the filesystem directly |

## Task Normalization

Agent output is never used raw. Every response passes through a Zod schema validation step before it becomes a task record in the queue:

1. Raw AI text or JSON is parsed against the expected task schema.
2. Invalid or incomplete fields are rejected — the task is dropped, not partially stored.
3. Task titles, descriptions, and file paths are stored as validated data types.
4. Queue markdown files are rendered from validated task records, not from raw AI output.

Deduplication runs after normalization. Each task is fingerprinted with a SHA256 hash of its normalized content. Tasks with matching hashes are silently dropped, preventing the same finding from accumulating across repeated scan passes.

## Risk Classification

Every finding produced by a scan is assigned a risk level.

| Level    | Meaning                                                              |
| -------- | -------------------------------------------------------------------- |
| `low`    | Narrow, self-contained change with minimal blast radius              |
| `medium` | Moderate scope; touches a single module or component                 |
| `broad`  | Cross-cutting change; may affect multiple files or public interfaces |

By default, `broad` risk findings are excluded from the fix queue. They are surfaced in the scan results for manual review but Corydora will not attempt to apply them automatically.

To include broad-risk tasks in automated fixes, set the following in `.corydora.json`:

```json
{ "scan": { "allowBroadRisk": true } }
```

Only enable this when you have reviewed the broad-risk findings and are comfortable with the scope of changes they may introduce.

Post-fix validation is enabled by default (`execution.validateAfterFix: true`). After each task is applied, Corydora runs a validation step to confirm the change did not break the build or introduce obvious regressions before moving to the next task.

## What Corydora Does Not Do

- Does not push branches or create pull requests automatically. All changes stay local until you push them.
- Does not modify your main branch unless you have explicitly configured `git.isolationMode: "current-branch"` and your active branch is main.
- Does not send source code to any service other than the AI provider you have configured in `.corydora.json`.
- Does not store or log API keys. Keys are read from `.corydora/.env.local` at runtime and never written to disk or console output.
