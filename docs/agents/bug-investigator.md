---
title: Bug Investigator
---

# Bug Investigator

## Purpose

The Bug Investigator reviews individual files for correctness problems — situations where the code does not do what it claims to do, or where specific inputs will trigger failures. It is focused and narrow by design: it looks at one file at a time and only flags issues that have a plausible, testable path to failure.

This agent is well-suited to logic-heavy modules, data transformation pipelines, and utility functions where edge-case handling is critical. It avoids speculative concerns, preferring findings backed by evidence in the file itself.

## Categories

| Category | Queue File          |
| -------- | ------------------- |
| `bugs`   | `.corydora/bugs.md` |

## Tech Lenses

This agent is active when your project matches any of the following lenses:

| Lens          | Notes                                                    |
| ------------- | -------------------------------------------------------- |
| `typescript`  | Default — active in all TypeScript projects              |
| `refactoring` | Default — always paired with structural improvement work |

## Prompt Guidance

> Focus on concrete bugs, edge-case failures, and misleading behavior. Prefer narrow fixes and testable evidence.

The agent avoids broad rewrites and speculative improvements. A finding must point to a real failure path, not a style preference or hypothetical misuse.

## What It Finds

- **Unguarded null or undefined access** — property reads on values that can be `null` or `undefined` at runtime, without a preceding guard or optional chain.
- **Off-by-one errors in loops and slices** — boundary conditions in `for` loops, `Array.slice`, or index calculations that produce incorrect results at the edges of a range.
- **Silent failure on rejected promises** — `async` functions or `Promise` chains where errors are swallowed, logged but not re-thrown, or only partially handled.
- **Incorrect conditional logic** — comparisons using `==` instead of `===`, inverted boolean conditions, or logic that passes type-checking but fails at runtime for specific input shapes.

## Example Finding

The following is a realistic task record this agent would produce, as it appears in `.corydora/bugs.md`:

```markdown
- [ ] Guard against undefined return value in resolveUserConfig (`src/config/files.ts`)
      <!-- corydora:id=abc123 risk=low severity=medium -->
  - Why: `resolveUserConfig` returns `undefined` when the config file is missing,
    but the caller at line 42 destructures the return value without a null check.
    This throws a TypeError at runtime when the file does not exist.
  - Validate: Add a test that calls the function with a non-existent path and
    asserts the caller handles the missing case gracefully.
```

**Task record fields:**

| Field      | Value                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------- |
| Title      | Guard against undefined return value in resolveUserConfig                                   |
| File       | `src/config/files.ts`                                                                       |
| Severity   | `medium`                                                                                    |
| Effort     | `small`                                                                                     |
| Risk       | `low`                                                                                       |
| Rationale  | Destructuring an `undefined` return value throws a TypeError when the config file is absent |
| Validation | Test the caller with a missing config path and assert graceful handling                     |
