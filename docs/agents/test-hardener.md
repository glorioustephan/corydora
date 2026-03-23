---
title: Test Hardener
---

# Test Hardener

## Purpose

The Test Hardener identifies gaps in test coverage and weaknesses in existing test quality. It looks for code paths that have no test, assertions that are too shallow to catch regressions, and patterns that make tests fragile or intermittently failing.

This agent is focused on observable behavior: the things a caller can actually verify from the outside. It recommends the smallest addition that meaningfully increases safety — a single test case for an untested branch, a tighter assertion, or a validation check that prevents silent data corruption.

## Categories

| Category | Queue File           |
| -------- | -------------------- |
| `tests`  | `.corydora/tests.md` |

## Tech Lenses

This agent is active when your project matches any of the following lenses:

| Lens         | Notes                                             |
| ------------ | ------------------------------------------------- |
| `typescript` | Default — active in all TypeScript projects       |
| `react`      | Enables component and hook testing analysis       |
| `nextjs`     | Enables route handler and server action analysis  |
| `node-cli`   | Enables CLI command and argument parsing analysis |

## Prompt Guidance

> Focus on observable behavior and missing safety nets. Recommend the narrowest test or validation addition.

The agent does not suggest broad coverage sweeps. Each finding points to a specific untested path or weak assertion that represents a real safety gap, not a coverage metric concern.

## What It Finds

- **Untested error paths** — functions that throw or return error states but have no test asserting the error case; particularly common in async functions and file I/O helpers.
- **Missing boundary tests** — logic with numeric limits, array lengths, or string constraints that is only tested with typical values, leaving minimum and maximum inputs uncovered.
- **Assertions that never fail** — tests using `toBeTruthy()` or `toBeDefined()` where a typed comparison would actually catch the regression; or tests where the assertion is on the wrong value.
- **Flaky async patterns** — tests using arbitrary `setTimeout` delays, missing `await` on assertions, or relying on test execution order for state that should be independently set up.

## Example Finding

The following is a realistic task record this agent would produce, as it appears in `.corydora/tests.md`:

```markdown
- [ ] Add test for parseTaskRecord when input is missing required fields (`src/queue/state.ts`)
      <!-- corydora:id=ghi789 risk=low severity=medium -->
  - Why: `parseTaskRecord` is called on every line of the queue file. There is no test
    for the case where `title` or `file` is absent. The function currently returns
    `undefined` silently, which causes the upstream consumer to skip the task without
    logging a warning.
  - Validate: Add a unit test asserting that `parseTaskRecord` throws or returns a
    typed error when required fields are missing, and that the caller handles it.
```

**Task record fields:**

| Field      | Value                                                                       |
| ---------- | --------------------------------------------------------------------------- |
| Title      | Add test for parseTaskRecord when input is missing required fields          |
| File       | `src/queue/state.ts`                                                        |
| Severity   | `medium`                                                                    |
| Effort     | `small`                                                                     |
| Risk       | `low`                                                                       |
| Rationale  | Missing fields cause silent skips with no warning; no test covers this path |
| Validation | Assert that the function throws or returns a typed error on malformed input |
