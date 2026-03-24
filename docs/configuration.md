---
title: Configuration Reference
---

# Configuration Reference

`.corydora.json` is the project-level configuration file. It is created by [`corydora init`](./cli-reference#corydora-init) and lives at the root of your repository alongside `.corydora/`, the working directory Corydora uses for state, logs, and agent data.

You can edit `.corydora.json` manually at any time. Run [`corydora config validate`](./cli-reference#corydora-config-validate) to check your edits against the schema before the next run.

The full JSON schema is published at [`schemas/corydora.schema.json`](../schemas/corydora.schema.json).

---

## `version`

| Property  | Type      | Required | Description                  |
| --------- | --------- | -------- | ---------------------------- |
| `version` | `integer` | Yes      | Schema version. Must be `1`. |

---

## `git`

Controls how Corydora isolates generated changes from your working tree.

| Property              | Type                                         | Default      | Description                                         |
| --------------------- | -------------------------------------------- | ------------ | --------------------------------------------------- |
| `isolationMode`       | `"worktree" \| "branch" \| "current-branch"` | `"worktree"` | How changes are isolated from your working tree     |
| `branchPrefix`        | `string`                                     | `"corydora"` | Prefix for generated branch and worktree names      |
| `trackMarkdownQueues` | `boolean`                                    | `false`      | Commit markdown queue files to the generated branch |
| `worktreeRoot`        | `string`                                     | —            | Custom root directory for worktrees (optional)      |

### Isolation modes

**`worktree`** (default and recommended) — Each run creates a dedicated git worktree. Generated changes are fully separated from your main checkout and cannot interfere with uncommitted work.

**`branch`** — Creates a new branch in the current checkout directory. No separate worktree is created, but changes are still isolated on their own branch.

**`current-branch`** — Edits the currently active branch directly. Requires explicit opt-in because it modifies the branch you are working on. Use this only when you understand the implications.

> See the [Security Model](./security) page for details on why `worktree` mode is the default.

---

## `runtime`

Specifies which AI provider and model Corydora uses to execute agent tasks.

| Property           | Type                | Default           | Description                                               |
| ------------------ | ------------------- | ----------------- | --------------------------------------------------------- |
| `provider`         | `RuntimeProviderId` | —                 | The AI runtime to use (required)                          |
| `model`            | `string`            | Provider-specific | Model identifier passed to the provider                   |
| `fallbackProvider` | `RuntimeProviderId` | —                 | Secondary provider to use if the primary fails (optional) |
| `maxOutputTokens`  | `integer` (min 1)   | `8192`            | Upper bound for generated output tokens per provider call |
| `requestTimeoutMs` | `integer` (min 1)   | `900000`          | Per-request timeout in milliseconds (15 minutes)          |
| `maxRetries`       | `integer` (min 0)   | `3`               | Retry budget for retryable request failures               |

### Provider IDs

| Provider ID     | Type  | Requires                                                |
| --------------- | ----- | ------------------------------------------------------- |
| `claude-cli`    | CLI   | `claude` binary, authenticated Claude Code installation |
| `codex-cli`     | CLI   | `codex` binary and local Codex auth/config              |
| `gemini-cli`    | CLI   | `gemini` binary and CLI auth or Google credentials      |
| `anthropic-api` | API   | `ANTHROPIC_API_KEY`                                     |
| `openai-api`    | API   | `OPENAI_API_KEY`                                        |
| `google-api`    | API   | `GOOGLE_API_KEY` or `GEMINI_API_KEY`                    |
| `bedrock`       | API   | `AWS_REGION` and standard AWS credentials               |
| `ollama`        | Local | Ollama running locally with `OLLAMA_HOST` reachable     |

See [Provider Setup](./providers/) for authentication details for each provider.

### Default models

When `model` is not specified, `corydora init` populates it from the detected provider's default. The defaults are:

| Provider        | Default model                               |
| --------------- | ------------------------------------------- |
| `claude-cli`    | `sonnet`                                    |
| `codex-cli`     | `gpt-5-codex`                               |
| `gemini-cli`    | `gemini-2.5-pro`                            |
| `anthropic-api` | `claude-sonnet-4-5`                         |
| `openai-api`    | `gpt-5`                                     |
| `google-api`    | `gemini-2.5-pro`                            |
| `bedrock`       | `anthropic.claude-3-7-sonnet-20250219-v1:0` |
| `ollama`        | `qwen2.5-coder:7b`                          |

---

## `agents`

Controls which agents are active and what task categories they scan for.

| Property                 | Type             | Default          | Description                                                     |
| ------------------------ | ---------------- | ---------------- | --------------------------------------------------------------- |
| `enabledCategories`      | `TaskCategory[]` | All 5 categories | Which task categories to scan for                               |
| `selectedBuiltinAgents`  | `string[]`       | All 8 agents     | Which builtin agents to activate                                |
| `importedAgentDirectory` | `string`         | —                | Path to a directory of imported agent markdown files (optional) |

### Task categories

| Category      | Description                                               |
| ------------- | --------------------------------------------------------- |
| `bugs`        | Correctness bugs, failure paths, security vulnerabilities |
| `performance` | Unnecessary renders, repeated work, I/O hot spots         |
| `tests`       | Missing tests, flaky patterns, weak validation            |
| `todo`        | Comments, deferred code paths, and technical debt         |
| `features`    | Incremental product improvement opportunities             |

### Builtin agent IDs

| ID                     | Label                | Categories                     | Tech lenses                                             |
| ---------------------- | -------------------- | ------------------------------ | ------------------------------------------------------- |
| `bug-investigator`     | Bug Investigator     | `bugs`                         | `typescript`, `refactoring`                             |
| `performance-engineer` | Performance Engineer | `performance`                  | `typescript`, `react`, `nextjs`, `electron`             |
| `test-hardener`        | Test Hardener        | `tests`                        | `typescript`, `react`, `nextjs`, `node-cli`             |
| `todo-triager`         | Todo Triager         | `todo`                         | `typescript`, `refactoring`                             |
| `feature-scout`        | Feature Scout        | `features`                     | `react`, `nextjs`, `node-cli`, `electron`               |
| `security-auditor`     | Security Auditor     | `bugs`                         | `security`, `typescript`, `react`, `nextjs`, `node-cli` |
| `database-reviewer`    | Database Reviewer    | `bugs`, `performance`          | `database`, `typescript`, `node-cli`                    |
| `refactoring-engineer` | Refactoring Engineer | `todo`, `performance`, `tests` | `refactoring`, `typescript`                             |

`corydora init` pre-selects the agents whose tech lenses match the detected project fingerprint. You can adjust `selectedBuiltinAgents` manually to activate only the agents relevant to your codebase.

For importing custom agents, see [`corydora agents import`](./cli-reference#corydora-agents-import-dir) and the [Agent Catalog](./agents/) page.

---

## `scan`

Controls how the file discovery and batch-scanning phase behaves.

| Property             | Type              | Default   | Description                                                   |
| -------------------- | ----------------- | --------- | ------------------------------------------------------------- |
| `batchSize`          | `integer` (min 1) | `6`       | Number of files dispatched to an agent in a single scan batch |
| `maxConcurrentScans` | `integer` (min 1) | `3`       | Maximum number of scan operations running in parallel         |
| `allowBroadRisk`     | `boolean`         | `false`   | Include broad-risk findings in the fix queue                  |
| `includeExtensions`  | `string[]`        | See below | File extensions to include in discovery                       |
| `excludeDirectories` | `string[]`        | See below | Directory names to skip entirely during discovery             |

### `allowBroadRisk`

Each task produced by an agent is tagged with a risk level. `narrow` tasks touch a single, well-understood location. `broad` tasks involve cross-cutting changes. By default, broad-risk tasks are surfaced in the markdown queue for human review but not automatically executed. Set `allowBroadRisk: true` to include them in automated fixing.

### Default `includeExtensions`

`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`, `.json`

### Default `excludeDirectories`

`.git`, `.next`, `.corydora`, `.turbo`, `build`, `coverage`, `dist`, `docs`, `documentation`, `generated`, `logs`, `node_modules`, `out`, `public`, `storybook-static`, `tmp`

---

## `execution`

Controls run lifecycle limits and behavior.

| Property              | Type              | Default | Description                                                                |
| --------------------- | ----------------- | ------- | -------------------------------------------------------------------------- |
| `backgroundByDefault` | `boolean`         | `false` | Automatically launch runs in a tmux session without needing `--background` |
| `preventIdleSleep`    | `boolean`         | `true`  | On macOS, wrap background runs with `caffeinate -i` when available         |
| `maxFixesPerRun`      | `integer` (min 1) | `20`    | Maximum number of fixes applied before the run stops                       |
| `maxRuntimeMinutes`   | `integer` (min 1) | `480`   | Maximum wall-clock duration in minutes before the run stops (8 hours)      |
| `backlogTarget`       | `integer` (min 1) | `8`     | Target number of pending tasks to maintain before scanning more files      |
| `validateAfterFix`    | `boolean`         | `true`  | Run the project's validation command (e.g. `tsc`, `eslint`) after each fix |

### How `backlogTarget` works

The scheduler maintains a rolling backlog. When the number of pending tasks drops below `backlogTarget`, Corydora dispatches the next scan batch to replenish the queue. Higher values keep more work queued ahead of the fixer; lower values reduce unnecessary scanning on small codebases.

---

## `todo`

Controls behavior specific to the `todo` task category and its markdown queue file.

| Property               | Type      | Default | Description                                               |
| ---------------------- | --------- | ------- | --------------------------------------------------------- |
| `trackMarkdownFiles`   | `boolean` | `false` | Track the `todo.md` queue file in git                     |
| `renderCompletedTasks` | `boolean` | `true`  | Include completed tasks when rendering the markdown queue |

---

## `paths`

Overrides the locations of Corydora's internal directories and files. You rarely need to change these; they are useful when the defaults conflict with existing project structure.

| Property      | Type     | Default                | Description                                            |
| ------------- | -------- | ---------------------- | ------------------------------------------------------ |
| `corydoraDir` | `string` | `.corydora`            | Root working directory for all Corydora data           |
| `stateDir`    | `string` | `.corydora/state`      | Task store and run state files                         |
| `logsDir`     | `string` | `.corydora/logs`       | Log files for each run                                 |
| `runsDir`     | `string` | `.corydora/runs`       | Historical run records                                 |
| `agentsDir`   | `string` | `.corydora/agents`     | Imported agent metadata                                |
| `envFile`     | `string` | `.corydora/.env.local` | Local environment secrets loaded before provider calls |

> `.corydora/.env.local` is excluded from git by default and never read into `.corydora.json`. Store provider API keys and other secrets there, not in the config file.

---

## Complete example

The following `.corydora.json` shows every field with sensible production values for a TypeScript/Next.js project using the Anthropic API.

```json
{
  "version": 1,
  "git": {
    "isolationMode": "worktree",
    "branchPrefix": "corydora",
    "trackMarkdownQueues": false
  },
  "runtime": {
    "provider": "anthropic-api",
    "model": "claude-sonnet-4-5",
    "fallbackProvider": "claude-cli",
    "maxOutputTokens": 8192,
    "requestTimeoutMs": 900000,
    "maxRetries": 3
  },
  "agents": {
    "enabledCategories": ["bugs", "performance", "tests", "todo"],
    "selectedBuiltinAgents": [
      "bug-investigator",
      "performance-engineer",
      "test-hardener",
      "todo-triager",
      "security-auditor",
      "refactoring-engineer"
    ]
  },
  "scan": {
    "batchSize": 6,
    "maxConcurrentScans": 3,
    "allowBroadRisk": false,
    "includeExtensions": [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs", ".json"],
    "excludeDirectories": [
      ".git",
      ".next",
      ".corydora",
      ".turbo",
      "build",
      "coverage",
      "dist",
      "docs",
      "documentation",
      "generated",
      "logs",
      "node_modules",
      "out",
      "public",
      "storybook-static",
      "tmp"
    ]
  },
  "execution": {
    "backgroundByDefault": true,
    "preventIdleSleep": true,
    "maxFixesPerRun": 20,
    "maxRuntimeMinutes": 480,
    "backlogTarget": 8,
    "validateAfterFix": true
  },
  "todo": {
    "trackMarkdownFiles": false,
    "renderCompletedTasks": true
  },
  "paths": {
    "corydoraDir": ".corydora",
    "stateDir": ".corydora/state",
    "logsDir": ".corydora/logs",
    "runsDir": ".corydora/runs",
    "agentsDir": ".corydora/agents",
    "envFile": ".corydora/.env.local"
  }
}
```
