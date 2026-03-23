---
title: Database Reviewer
---

# Database Reviewer

## Purpose

The Database Reviewer analyzes data access code for correctness risks and performance bottlenecks at the query layer. It looks at ORM usage, raw query construction, schema migration patterns, and the assumptions that application code makes about data consistency.

This agent is valuable in any codebase where queries are constructed dynamically, migrations run outside of a controlled process, or application code makes implicit assumptions about index availability or transaction isolation. It focuses on the data layer specifically — not general TypeScript correctness — and requires the `database` lens to be enabled.

## Categories

| Category      | Queue File                 |
| ------------- | -------------------------- |
| `bugs`        | `.corydora/bugs.md`        |
| `performance` | `.corydora/performance.md` |

## Tech Lenses

This agent is active when your project matches any of the following lenses:

| Lens         | Notes                                                      |
| ------------ | ---------------------------------------------------------- |
| `database`   | Primary activation lens — enables the Database Reviewer    |
| `typescript` | Default — active in all TypeScript projects                |
| `node-cli`   | Enables analysis of database scripts and migration runners |

The `database` lens is enabled by selecting the Database Reviewer during `corydora init`. It is not auto-detected from project structure.

## Prompt Guidance

> Focus on concrete query risks, indexing concerns, and data-layer correctness.

The agent does not flag general TypeScript issues — those belong to the Bug Investigator. Every finding must be specific to data access: a query that can corrupt or lose data, a lookup that will scan the full table, or a migration that can leave the schema in an inconsistent state.

## What It Finds

- **N+1 query patterns** — loops that execute a query per iteration rather than batching the lookup, particularly common with ORM `findOne` calls inside `map` or `forEach` over a result set.
- **Missing transaction boundaries** — multi-step write sequences (insert followed by update, or delete followed by insert) that are not wrapped in a transaction, leaving the database in an inconsistent state if the second operation fails.
- **Unindexed filter columns** — `WHERE` clauses filtering on columns that have no index, causing full table scans that degrade as the table grows; detectable when the column is not part of any schema index definition in the file.
- **Dynamic query construction with unsanitized input** — string concatenation or template literals used to build SQL or query filter objects with values that originate from user input, creating SQL injection or NoSQL injection risk.

## Example Finding

The following is a realistic task record this agent would produce, as it appears in `.corydora/performance.md`:

```markdown
- [ ] Batch getUsersByIds to eliminate N+1 query in renderTaskList (`src/queue/render.ts`)
      <!-- corydora:id=stu901 risk=low severity=medium -->
  - Why: `renderTaskList` calls `getUserById(task.ownerId)` inside a `for` loop over
    the task list. Each call issues a separate SELECT query. For a list of 50 tasks,
    this produces 50 round-trips to the database. The function should batch the IDs and
    issue a single `WHERE id IN (...)` query.
  - Validate: Replace the per-iteration call with a batched lookup. Confirm with query
    logging that the render path issues one query, not one per task.
```

**Task record fields:**

| Field      | Value                                                                               |
| ---------- | ----------------------------------------------------------------------------------- |
| Title      | Batch getUsersByIds to eliminate N+1 query in renderTaskList                        |
| File       | `src/queue/render.ts`                                                               |
| Severity   | `medium`                                                                            |
| Effort     | `small`                                                                             |
| Risk       | `low`                                                                               |
| Rationale  | Per-iteration SELECT produces O(n) queries; batching reduces this to one round-trip |
| Validation | Enable query logging and assert a single query is issued for the full task list     |
