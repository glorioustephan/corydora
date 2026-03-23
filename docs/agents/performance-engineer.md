---
title: Performance Engineer
---

# Performance Engineer

## Purpose

The Performance Engineer looks for code patterns that cause measurable slowdowns visible to users or significant resource waste in the runtime. It targets work that is being repeated unnecessarily, data that is being loaded when it shouldn't be, and UI components that re-render more than their inputs require.

This agent is most valuable in React and Next.js codebases where render performance directly affects perceived responsiveness, and in Node.js or Electron apps where I/O on the main thread blocks the event loop. It prefers small, targeted changes over architectural refactors.

## Categories

| Category      | Queue File                 |
| ------------- | -------------------------- |
| `performance` | `.corydora/performance.md` |

## Tech Lenses

This agent is active when your project matches any of the following lenses:

| Lens         | Notes                                       |
| ------------ | ------------------------------------------- |
| `typescript` | Default — active in all TypeScript projects |
| `react`      | Enables render-specific analysis            |
| `nextjs`     | Enables SSR/SSG data-fetching analysis      |
| `electron`   | Enables main-process and IPC analysis       |

## Prompt Guidance

> Look for measurable performance improvements. Prefer small changes with clear user-facing impact.

The agent avoids speculative micro-optimizations. A finding must identify work that has a credible user-facing cost — slower renders, blocked I/O, unnecessary network round-trips, or avoidable recomputation.

## What It Finds

- **Unnecessary React re-renders** — components missing `React.memo`, `useMemo`, or `useCallback` where props or computed values are referentially unstable across renders.
- **Redundant data fetching** — repeated calls to an API or database within the same render cycle or request handler that could be deduplicated or cached.
- **Blocking I/O on the main thread** — synchronous file system reads (`fs.readFileSync`), blocking JSON parsing of large payloads, or CPU-intensive work running on the Node.js event loop.
- **Unbatched state updates** — multiple `setState` calls in event handlers or effects that trigger separate renders where a single batched update would suffice.

## Example Finding

The following is a realistic task record this agent would produce, as it appears in `.corydora/performance.md`:

```markdown
- [ ] Memoize getFilteredResults to avoid recomputation on every render (`src/components/TaskList.tsx`)
      <!-- corydora:id=def456 risk=low severity=medium -->
  - Why: `getFilteredResults` is called inline during render and performs an O(n) filter
    over the full task list on every keystroke. The result depends only on `tasks` and
    `filterText`, both of which are stable between most renders.
  - Validate: Wrap in `useMemo` with `[tasks, filterText]` deps. Confirm with React
    DevTools that the component no longer re-computes on unrelated parent re-renders.
```

**Task record fields:**

| Field      | Value                                                                            |
| ---------- | -------------------------------------------------------------------------------- |
| Title      | Memoize getFilteredResults to avoid recomputation on every render                |
| File       | `src/components/TaskList.tsx`                                                    |
| Severity   | `medium`                                                                         |
| Effort     | `small`                                                                          |
| Risk       | `low`                                                                            |
| Rationale  | Inline O(n) filter runs on every keystroke; result depends only on stable inputs |
| Validation | Wrap in `useMemo` and confirm with React DevTools profiler                       |
