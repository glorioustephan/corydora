---
title: Refactoring Engineer
---

# Refactoring Engineer

## Purpose

The Refactoring Engineer identifies structural problems that make code harder to understand, test, and change — without altering its external behavior. It focuses on complexity that compounds over time: functions doing too many things, duplicated logic that diverges when one copy is updated, and abstractions that have grown misaligned with their current use.

This agent prioritizes changes that have a high benefit-to-risk ratio. A good finding from the Refactoring Engineer is something that reduces cognitive load and makes the next developer's work easier, without requiring a broad rewrite or behavior change. Changes flagged as `broad` risk are noted but not auto-applied.

## Categories

| Category      | Queue File                 |
| ------------- | -------------------------- |
| `todo`        | `.corydora/todo.md`        |
| `performance` | `.corydora/performance.md` |
| `tests`       | `.corydora/tests.md`       |

## Tech Lenses

This agent is active when your project matches any of the following lenses:

| Lens          | Notes                                               |
| ------------- | --------------------------------------------------- |
| `refactoring` | Primary activation lens — always enabled by default |
| `typescript`  | Default — active in all TypeScript projects         |

## Prompt Guidance

> Prefer low-risk structure improvements that reduce complexity without changing behavior.

The agent avoids proposing rewrites that change observable behavior. Every finding should be something that could be reviewed and merged in isolation, leaving the module's public interface and side effects unchanged.

## What It Finds

- **Oversized functions with multiple responsibilities** — functions exceeding a reasonable complexity threshold that combine data fetching, transformation, and side effects in a single body, making them difficult to test in isolation.
- **Duplicated logic across sibling modules** — identical or near-identical code blocks that have been copied rather than extracted, creating divergence risk when the logic needs to change.
- **Deep nesting from unguarded conditionals** — callback pyramids or nested `if` chains that can be flattened with early returns or extracted helper functions, reducing indentation depth and improving readability.
- **Misnamed or misleading abstractions** — functions or variables whose names no longer reflect their current behavior after incremental changes, creating false documentation for future readers.

## Example Finding

The following is a realistic task record this agent would produce, as it appears in `.corydora/todo.md`:

```markdown
- [ ] Extract file extension filtering from importAgentsFromDirectory into a helper (`src/agents/catalog.ts`)
      <!-- corydora:id=vwx234 risk=low severity=low -->
  - Why: `importAgentsFromDirectory` contains inline logic for filtering by file
    extension, checking `isFile()`, and skipping non-`.md` entries. This same pattern
    appears in `discovery.ts`. Extracting it into a shared helper reduces duplication
    and makes both call sites easier to test independently.
  - Validate: Extract `isMarkdownFile(entry: Dirent): boolean` into a shared util.
    Replace both call sites. Run existing tests to confirm no behavior change.
```

**Task record fields:**

| Field      | Value                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Title      | Extract file extension filtering from importAgentsFromDirectory into a helper                  |
| File       | `src/agents/catalog.ts`                                                                        |
| Severity   | `low`                                                                                          |
| Effort     | `small`                                                                                        |
| Risk       | `low`                                                                                          |
| Rationale  | Inline extension filtering is duplicated in `discovery.ts`; divergence risk when logic changes |
| Validation | Extract shared util, replace both call sites, confirm existing tests pass                      |
