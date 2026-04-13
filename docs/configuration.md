---
title: Configuration Reference
description: Configure Corydora defaults, modes, routing, and execution limits for your project.
---

# Configuration Reference

`.corydora.json` is the project-level config file Corydora reads every time you run it. Most teams only need to change a few sections:

- `git` to control where changes land
- `runtime` to choose providers, models, and stage-specific routes
- `modes` to set a default focus and tailor mode-specific agent pools
- `execution` to tune retry behavior and parallelism

You can edit the file directly and validate it with [`corydora config validate`](./cli-reference#corydora-config-validate).

The published schema is available in the npm package at `schemas/corydora.schema.json` and in the repository on [GitHub](https://github.com/glorioustephan/corydora/blob/main/schemas/corydora.schema.json).

## A practical way to read this file

Think of the config in layers:

1. Choose where Corydora should make changes with `git`.
2. Choose which provider and model should do the work with `runtime`.
3. Choose which kind of work you want by default with `modes`.
4. Limit how aggressive the run should be with `execution`.

---

## `version`

| Property  | Type      | Required | Description                  |
| --------- | --------- | -------- | ---------------------------- |
| `version` | `integer` | Yes      | Schema version. Must be `1`. |

---

## `git`

Controls how Corydora isolates generated changes from your current work.

| Property              | Type                                         | Default      | Description                                         |
| --------------------- | -------------------------------------------- | ------------ | --------------------------------------------------- |
| `isolationMode`       | `"worktree" \| "branch" \| "current-branch"` | `"worktree"` | How changes are isolated from your working tree     |
| `branchPrefix`        | `string`                                     | `"corydora"` | Prefix for generated branch and worktree names      |
| `trackMarkdownQueues` | `boolean`                                    | `false`      | Commit markdown queue files to the generated branch |
| `worktreeRoot`        | `string`                                     | —            | Custom root directory for worktrees                 |

### Isolation modes

**`worktree`** is the safest starting point. Corydora tries to keep generated changes out of your main checkout.

**`branch`** keeps work in the current checkout but still isolates it on a generated branch.

**`current-branch`** edits your active branch directly. Use it only when that is exactly what you want.

If you configure `worktree`, Corydora may still use `branch` for a specific run when the chosen fix route or validation step needs reliable access to the repository's existing dependencies. The CLI and `corydora status` both report the effective isolation mode that was actually used.

---

## `runtime`

Controls the default provider, model, and request limits.

| Property           | Type                | Default           | Description                                               |
| ------------------ | ------------------- | ----------------- | --------------------------------------------------------- |
| `provider`         | `RuntimeProviderId` | —                 | The AI runtime to use                                     |
| `model`            | `string`            | Provider-specific | Model identifier passed to the provider                   |
| `fallbackProvider` | `RuntimeProviderId` | —                 | Secondary provider to use if the primary fails            |
| `maxOutputTokens`  | `integer` (min 1)   | `8192`            | Upper bound for generated output tokens per provider call |
| `requestTimeoutMs` | `integer` (min 1)   | `900000`          | Per-request timeout in milliseconds                       |
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

See [Providers](/providers/) for setup details.

### `runtime.stages`

You can override the default runtime per stage:

| Stage     | What it controls                                 |
| --------- | ------------------------------------------------ |
| `analyze` | File analysis and task discovery                 |
| `fix`     | Applying the selected fix                        |
| `summary` | Reserved for summary-stage routing compatibility |

Each stage accepts the same keys:

- `provider`
- `model`
- `fallbackProvider`
- `maxOutputTokens`
- `requestTimeoutMs`
- `maxRetries`

This is useful when you want a less expensive model for analysis and a stronger model for fixes.

Example:

```json
{
  "runtime": {
    "provider": "claude-cli",
    "model": "sonnet",
    "fallbackProvider": "openai-api",
    "maxOutputTokens": 8192,
    "requestTimeoutMs": 900000,
    "maxRetries": 3,
    "stages": {
      "analyze": {
        "provider": "openai-api",
        "model": "gpt-5-mini",
        "maxOutputTokens": 4096,
        "requestTimeoutMs": 300000
      },
      "fix": {
        "provider": "claude-cli",
        "model": "sonnet"
      },
      "summary": {}
    }
  }
}
```

### Default models

When `corydora init` creates a config, it fills in a provider-specific default model:

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

## `modes`

Modes change what Corydora prioritizes. The mode you choose affects file ranking, agent selection, validation behavior, and how the run spends its effort.

| Property   | Type           | Default                | Description                                            |
| ---------- | -------------- | ---------------------- | ------------------------------------------------------ |
| `default`  | `CorydoraMode` | `"auto"`               | Mode used when you run `corydora run` without `--mode` |
| `profiles` | object         | Mode-specific defaults | Agent and category preferences for each mode           |

### Available modes

| Mode            | Use it when you want Corydora to                               |
| --------------- | -------------------------------------------------------------- |
| `auto`          | make balanced maintenance decisions on its own                 |
| `churn`         | start with recently changed, frequently touched, larger files  |
| `clean`         | make low-risk cleanup and consistency improvements             |
| `refactor`      | simplify awkward or high-friction files                        |
| `performance`   | focus on runtime hotspots and repeated work                    |
| `linting`       | prefer lint-driven tasks first                                 |
| `documentation` | improve README, schema, CLI help, and other public-facing docs |

### Mode profiles

Each mode profile can define:

| Property       | Type             | Description                                        |
| -------------- | ---------------- | -------------------------------------------------- |
| `agentIds`     | `string[]`       | Default agents for that mode                       |
| `categoryBias` | `TaskCategory[]` | Categories Corydora should emphasize for that mode |

Example:

```json
{
  "modes": {
    "default": "churn",
    "profiles": {
      "auto": {},
      "churn": {
        "agentIds": ["refactoring-engineer", "bug-investigator"],
        "categoryBias": ["bugs", "todo", "tests"]
      },
      "clean": {},
      "refactor": {},
      "performance": {},
      "linting": {},
      "documentation": {}
    }
  }
}
```

`corydora run --mode <mode>` overrides `modes.default` for one run.

---

## `agents`

Controls which agents Corydora can use by default.

| Property                 | Type             | Default           | Description                                                                 |
| ------------------------ | ---------------- | ----------------- | --------------------------------------------------------------------------- |
| `enabledCategories`      | `TaskCategory[]` | All 5 categories  | Which task categories to scan for                                           |
| `selectedBuiltinAgents`  | `string[]`       | Project-dependent | Default builtin agent IDs to use when a mode profile does not override them |
| `importedAgentDirectory` | `string`         | —                 | Path to a directory of imported agent markdown files                        |

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

`corydora init` pre-selects builtin agents that match the detected project. Those selections are not just hints: Corydora uses them at runtime unless a mode profile or `--agent` overrides them.

---

## `scan`

Controls which files Corydora is allowed to inspect and how analysis batches are built.

| Property             | Type              | Default   | Description                                        |
| -------------------- | ----------------- | --------- | -------------------------------------------------- |
| `batchSize`          | `integer` (min 1) | `6`       | Number of files dispatched in a single scan batch  |
| `maxConcurrentScans` | `integer` (min 1) | `3`       | Upper bound for concurrent scan operations         |
| `allowBroadRisk`     | `boolean`         | `false`   | Include broader-scope findings in automated fixing |
| `includeExtensions`  | `string[]`        | See below | File extensions to include in discovery            |
| `excludeDirectories` | `string[]`        | See below | Directory names to skip during discovery           |

### `allowBroadRisk`

By default, Corydora only auto-applies tasks that stay within a smaller blast radius. Set `allowBroadRisk: true` only if you want it to pick up broader changes too.

### Default `includeExtensions`

`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`, `.json`

### Default `excludeDirectories`

`.git`, `.next`, `.corydora`, `.turbo`, `build`, `coverage`, `dist`, `docs`, `documentation`, `generated`, `logs`, `node_modules`, `out`, `public`, `storybook-static`, `tmp`

If you want `documentation` mode to work inside `docs/`, remove `docs` and any other documentation directories you want scanned from `excludeDirectories`.

---

## `execution`

Controls run limits, retries, validation, and parallelism.

| Property              | Type              | Default | Description                                                                |
| --------------------- | ----------------- | ------- | -------------------------------------------------------------------------- |
| `backgroundByDefault` | `boolean`         | `false` | Automatically launch runs in tmux without needing `--background`           |
| `preventIdleSleep`    | `boolean`         | `true`  | On macOS, wrap background runs with `caffeinate -i` when available         |
| `maxFixesPerRun`      | `integer` (min 1) | `20`    | Maximum number of fixes applied before the run stops                       |
| `maxRuntimeMinutes`   | `integer` (min 1) | `480`   | Maximum wall-clock duration before the run stops                           |
| `backlogTarget`       | `integer` (min 1) | `8`     | Target number of pending tasks to maintain before scanning more files      |
| `validateAfterFix`    | `boolean`         | `true`  | Run a local validation command after each fix when one is available        |
| `maxAnalyzeWorkers`   | `integer` (min 1) | `2`     | Maximum number of analysis workers Corydora will try to run at once        |
| `maxFixWorkers`       | `integer` (min 1) | `1`     | Maximum number of fix workers Corydora will try to run at once             |
| `maxAttempts`         | `integer` (min 1) | `3`     | Retry budget before a task or file is deferred                             |
| `leaseTtlMinutes`     | `integer` (min 1) | `15`    | How long a leased file or task can stay in progress before it is reclaimed |

### Validation by mode

When `validateAfterFix` is enabled, Corydora chooses the validation command based on the run mode:

| Mode            | Validation behavior                                          |
| --------------- | ------------------------------------------------------------ |
| `linting`       | Runs `lint` if available                                     |
| `documentation` | Runs `docs:check`, `docs:build`, or `docs:lint` if available |
| All other modes | Runs `typecheck` if available, otherwise `test`              |

### Concurrency guidance

- Corydora uses the lower of `execution.maxAnalyzeWorkers` and `scan.maxConcurrentScans` for analysis.
- Corydora may reduce analysis concurrency automatically when the fix backlog is already full or recent failures suggest it should slow down.
- Keep `maxFixWorkers` at `1` unless you have a clean, well-behaved repository and want to experiment with more parallel fixes.

---

## `todo`

Controls markdown task-file behavior.

| Property               | Type      | Default | Description                                               |
| ---------------------- | --------- | ------- | --------------------------------------------------------- |
| `trackMarkdownFiles`   | `boolean` | `false` | Compatibility setting for markdown task-file workflows    |
| `renderCompletedTasks` | `boolean` | `true`  | Include completed tasks when rendering the markdown queue |

---

## `paths`

Overrides the locations of Corydora's internal directories and files. Most projects should keep the defaults.

| Property      | Type     | Default                | Description                                            |
| ------------- | -------- | ---------------------- | ------------------------------------------------------ |
| `corydoraDir` | `string` | `.corydora`            | Root working directory for Corydora data               |
| `stateDir`    | `string` | `.corydora/state`      | Task store and run state files                         |
| `logsDir`     | `string` | `.corydora/logs`       | Log files for each run                                 |
| `runsDir`     | `string` | `.corydora/runs`       | Historical run records                                 |
| `agentsDir`   | `string` | `.corydora/agents`     | Imported agent metadata                                |
| `envFile`     | `string` | `.corydora/.env.local` | Local environment secrets loaded before provider calls |

`.corydora/.env.local` is excluded from git by default. Store provider API keys there, not in `.corydora.json`.

---

## Example configuration

This example keeps the default experience simple while showing the new mode and routing controls:

```json
{
  "version": 1,
  "git": {
    "isolationMode": "worktree",
    "branchPrefix": "corydora",
    "trackMarkdownQueues": false
  },
  "runtime": {
    "provider": "claude-cli",
    "model": "sonnet",
    "fallbackProvider": "openai-api",
    "maxOutputTokens": 8192,
    "requestTimeoutMs": 900000,
    "maxRetries": 3,
    "stages": {
      "analyze": {
        "provider": "openai-api",
        "model": "gpt-5-mini",
        "maxOutputTokens": 4096,
        "requestTimeoutMs": 300000
      },
      "fix": {},
      "summary": {}
    }
  },
  "modes": {
    "default": "churn",
    "profiles": {
      "auto": {},
      "churn": {
        "agentIds": ["bug-investigator", "refactoring-engineer"],
        "categoryBias": ["bugs", "todo", "tests"]
      },
      "clean": {},
      "refactor": {},
      "performance": {},
      "linting": {},
      "documentation": {}
    }
  },
  "agents": {
    "enabledCategories": ["bugs", "performance", "tests", "todo", "features"],
    "selectedBuiltinAgents": [
      "bug-investigator",
      "performance-engineer",
      "test-hardener",
      "todo-triager",
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
    "validateAfterFix": true,
    "maxAnalyzeWorkers": 2,
    "maxFixWorkers": 1,
    "maxAttempts": 3,
    "leaseTtlMinutes": 15
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
