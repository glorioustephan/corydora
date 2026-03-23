---
title: Agent Catalog
---

# Agent Catalog

Corydora ships 8 builtin agents, each specialized for a specific class of code improvement. During `corydora init`, agents are selected based on your project's detected tech stack. You can also import custom agents from your own markdown files.

## Task Categories

Each agent produces findings in one or more task categories. Every category maps to a queue file that Corydora writes to your project's `.corydora/` directory after a scan.

| Category      | Description                          | Queue File                 |
| ------------- | ------------------------------------ | -------------------------- |
| `bugs`        | Correctness issues and failure paths | `.corydora/bugs.md`        |
| `performance` | Speed and efficiency improvements    | `.corydora/performance.md` |
| `tests`       | Test coverage and quality gaps       | `.corydora/tests.md`       |
| `todo`        | Technical debt and deferred work     | `.corydora/todo.md`        |
| `features`    | Small feature opportunities          | `.corydora/features.md`    |

## Technical Lenses

Tech lenses determine which agents are relevant to your codebase. Corydora auto-detects lenses from your project structure during `corydora init` and records them in `.corydora.json`. Agents are only included in a scan when at least one of their declared lenses matches your project.

| Lens          | Detected When                                                  |
| ------------- | -------------------------------------------------------------- |
| `typescript`  | Always included (default)                                      |
| `react`       | `react` in dependencies                                        |
| `nextjs`      | `next.config.*` present, or `app/` or `pages/` directory found |
| `node-cli`    | `bin` field present in `package.json`                          |
| `electron`    | `electron` in dependencies                                     |
| `security`    | Paired with the Security Auditor agent                         |
| `database`    | Paired with the Database Reviewer agent                        |
| `refactoring` | Always included (default)                                      |

## Agent Matrix

The table below shows which agents cover which task categories. An agent is active in a scan only when its tech lenses match your project's detected lenses.

| Agent                                          | bugs | performance | tests | todo | features |
| ---------------------------------------------- | ---- | ----------- | ----- | ---- | -------- |
| [Bug Investigator](./bug-investigator)         | X    |             |       |      |          |
| [Performance Engineer](./performance-engineer) |      | X           |       |      |          |
| [Test Hardener](./test-hardener)               |      |             | X     |      |          |
| [Todo Triager](./todo-triager)                 |      |             |       | X    |          |
| [Feature Scout](./feature-scout)               |      |             |       |      | X        |
| [Security Auditor](./security-auditor)         | X    |             |       |      |          |
| [Database Reviewer](./database-reviewer)       | X    | X           |       |      |          |
| [Refactoring Engineer](./refactoring-engineer) |      | X           | X     | X    |          |

## Importing Custom Agents

You can extend Corydora's catalog with your own agents. Custom agents are markdown files with YAML frontmatter that define the agent's metadata and prompt guidance.

```bash
corydora agents import ./my-agents/
```

All `.md` files in the target directory are parsed and registered. Imported agents are stored in `.corydora/agents/imported-agents.json` and included in subsequent scans alongside the builtin catalog.

### Custom Agent Format

```markdown
---
id: my-custom-agent
label: My Custom Agent
description: Does something specific to this codebase
categories: [bugs]
techLenses: [typescript]
---

Your prompt guidance for this agent goes here. Be specific about what
patterns to look for and what kind of findings to produce.
```

### Frontmatter Fields

| Field         | Required    | Description                                                                           |
| ------------- | ----------- | ------------------------------------------------------------------------------------- |
| `id`          | Recommended | Unique identifier used in task records and deduplication. Falls back to the filename. |
| `label`       | Recommended | Human-readable name shown in `corydora agents list` output.                           |
| `description` | Optional    | Short summary of what the agent looks for.                                            |
| `categories`  | Optional    | One or more task categories. Defaults to `todo`.                                      |
| `techLenses`  | Optional    | Tech lenses that must match for the agent to be active. Defaults to `refactoring`.    |

The markdown body below the frontmatter becomes the agent's prompt guidance, trimmed to 4,000 characters.
