---
title: Todo Triager
---

# Todo Triager

## Purpose

The Todo Triager converts informal technical debt into actionable, scoped tasks. It reads `TODO`, `FIXME`, `HACK`, and `NOTE` comments, identifies skipped code paths, and finds deferred work that has accumulated without a concrete follow-up plan.

Rather than preserving vague intent, this agent rewrites the underlying concern as a specific task with a defined scope, a rationale, and a validation step. The goal is to make the debt visible and executable — something Corydora can actually fix or queue for human review, rather than leave as a comment that ages out of relevance.

## Categories

| Category | Queue File          |
| -------- | ------------------- |
| `todo`   | `.corydora/todo.md` |

## Tech Lenses

This agent is active when your project matches any of the following lenses:

| Lens          | Notes                                                    |
| ------------- | -------------------------------------------------------- |
| `typescript`  | Default — active in all TypeScript projects              |
| `refactoring` | Default — always paired with structural improvement work |

## Prompt Guidance

> Convert vague technical debt into actionable, scoped tasks. Avoid broad rewrites.

The agent translates comments into work items. It does not invent scope beyond what the comment or surrounding context implies. Broad rewrites are flagged as out of scope and left for human triage.

## What It Finds

- **Unresolved TODO comments** — inline `// TODO:` and `// FIXME:` comments that have not been addressed; particularly those with no associated issue number or owner.
- **Skipped or stubbed code paths** — early returns, `throw new Error('not implemented')` stubs, or `/* istanbul ignore next */` suppressions that indicate deferred work.
- **Hardcoded values with a deferral note** — magic strings, hardcoded limits, or placeholder credentials accompanied by a comment indicating they should eventually be configurable.
- **Commented-out code blocks** — large sections of code commented out rather than deleted, often with an explanation that implies conditional re-enablement later.

## Example Finding

The following is a realistic task record this agent would produce, as it appears in `.corydora/todo.md`:

```markdown
- [ ] Replace hardcoded retry limit with configurable value (`src/runtime/scheduler.ts`)
      <!-- corydora:id=jkl012 risk=low severity=low -->
  - Why: Line 88 contains `const MAX_RETRIES = 3; // TODO: make this configurable`.
    The value is never read from config and cannot be overridden per-project.
    This was noted as deferred at initial implementation.
  - Validate: Add a `maxRetries` field to the execution config schema, read it in
    the scheduler, and confirm the existing retry tests still pass.
```

**Task record fields:**

| Field      | Value                                                       |
| ---------- | ----------------------------------------------------------- |
| Title      | Replace hardcoded retry limit with configurable value       |
| File       | `src/runtime/scheduler.ts`                                  |
| Severity   | `low`                                                       |
| Effort     | `small`                                                     |
| Risk       | `low`                                                       |
| Rationale  | Hardcoded limit noted as deferred; not readable from config |
| Validation | Add config field, wire it in, verify retry tests pass       |
