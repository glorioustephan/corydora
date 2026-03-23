---
title: Feature Scout
---

# Feature Scout

## Purpose

The Feature Scout identifies small product improvements that fit naturally into the existing architecture. It looks for capabilities that are almost already present — a missing flag, a UI affordance implied by surrounding code, or a workflow gap that is one step away from being filled.

This agent is deliberately conservative. It does not propose net-new features that require significant new infrastructure. Every suggestion must fit the existing component and data model without introducing new dependencies or broad changes. Features discovered by this agent are queued in `.corydora/features.md` and are not auto-applied unless the `features` category is explicitly enabled in your run configuration.

## Categories

| Category   | Queue File              |
| ---------- | ----------------------- |
| `features` | `.corydora/features.md` |

## Tech Lenses

This agent is active when your project matches any of the following lenses:

| Lens       | Notes                                                   |
| ---------- | ------------------------------------------------------- |
| `react`    | Enables UI component opportunity analysis               |
| `nextjs`   | Enables page-level and API route opportunity analysis   |
| `node-cli` | Enables CLI flag and command opportunity analysis       |
| `electron` | Enables desktop affordance and IPC opportunity analysis |

## Prompt Guidance

> Propose only incremental product improvements. Features are queued by default and not auto-fixed unless enabled.

The agent restricts itself to suggestions that are one small step beyond what the code already does. It does not flag missing features in the abstract — the opportunity must be grounded in existing structure that almost supports it.

## What It Finds

- **Missing CLI flags for existing behavior** — a CLI command that hardcodes a value (like output format or verbosity) that callers would reasonably want to override via an argument.
- **Incomplete UI affordances** — a component that shows data but lacks an expected interaction, such as a list with no empty state, a form with no loading indicator, or a table with no sorting.
- **Unexposed configuration options** — internal constants or logic branches that are already parameterizable but not wired to the config schema or user-facing settings.
- **Partial feature implementations** — code that handles two of three expected cases (for example, a status display that shows `pending` and `done` but silently ignores `failed`).

## Example Finding

The following is a realistic task record this agent would produce, as it appears in `.corydora/features.md`:

```markdown
- [ ] Add --format flag to corydora status to support JSON output (`src/commands/status.ts`)
      <!-- corydora:id=mno345 risk=low severity=low -->
  - Why: The `status` command renders output using a fixed terminal format. The
    underlying data is already structured as a typed object. Adding a `--format json`
    flag would let CI pipelines and scripts consume run state programmatically without
    parsing terminal output.
  - Validate: Pass `--format json` and assert that stdout is valid JSON matching the
    RunState shape. Confirm the default output is unchanged.
```

**Task record fields:**

| Field      | Value                                                                           |
| ---------- | ------------------------------------------------------------------------------- |
| Title      | Add --format flag to corydora status to support JSON output                     |
| File       | `src/commands/status.ts`                                                        |
| Severity   | `low`                                                                           |
| Effort     | `small`                                                                         |
| Risk       | `low`                                                                           |
| Rationale  | Output is structured but not machine-readable; one flag away from CI utility    |
| Validation | Assert `--format json` produces valid JSON matching RunState; default unchanged |
