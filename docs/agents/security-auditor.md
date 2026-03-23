---
title: Security Auditor
---

# Security Auditor

## Purpose

The Security Auditor looks for exploitable security issues in frontend and backend code. It focuses on concrete threat paths — places where attacker-controlled input reaches a sensitive operation, where trust boundaries are crossed without verification, or where auth assumptions are violated in ways that could be triggered in a real deployment.

This agent is not a linter pass for security style. Every finding must have an identifiable exploit path: a sequence of steps that a realistic attacker could follow to extract data, bypass authorization, or corrupt state. Speculative concerns without a concrete path are out of scope.

## Categories

| Category | Queue File          |
| -------- | ------------------- |
| `bugs`   | `.corydora/bugs.md` |

## Tech Lenses

This agent is active when your project matches any of the following lenses:

| Lens         | Notes                                                         |
| ------------ | ------------------------------------------------------------- |
| `security`   | Primary activation lens — enables the Security Auditor        |
| `typescript` | Default — active in all TypeScript projects                   |
| `react`      | Enables client-side injection and DOM trust analysis          |
| `nextjs`     | Enables server action, route handler, and middleware analysis |
| `node-cli`   | Enables shell execution and file path traversal analysis      |

The `security` lens is enabled by selecting the Security Auditor during `corydora init`. It is not auto-detected from project structure.

## Prompt Guidance

> Prioritize trust boundaries, unsafe input handling, auth assumptions, and exploitable patterns.

The agent focuses on four categories of risk: where input from an untrusted source reaches a sensitive sink without sanitization, where authentication or authorization is assumed rather than verified, where sensitive data is exposed through logging or error responses, and where dependency or configuration choices create known vulnerability surfaces.

## What It Finds

- **Unsanitized user input in dynamic operations** — template literals, `eval`, shell command construction, or file path resolution that includes unvalidated user-supplied values without encoding or allowlisting.
- **Authorization checks missing on internal routes** — API routes or server actions that rely on the caller being authenticated but do not verify session state server-side, trusting a client-supplied header or body field instead.
- **Sensitive values in error responses or logs** — caught errors that serialize the full exception stack, database error messages, or internal paths into API responses visible to callers.
- **Insecure direct object references** — resource lookups that use a user-supplied ID without verifying the authenticated user owns the resource, allowing horizontal privilege escalation.

## Example Finding

The following is a realistic task record this agent would produce, as it appears in `.corydora/bugs.md`:

```markdown
- [ ] Validate that authenticated user owns resource before returning in getTaskById (`src/commands/run.ts`)
      <!-- corydora:id=pqr678 risk=low severity=high -->
  - Why: `getTaskById` accepts a task ID from the request body and returns the task
    without checking whether the requesting user's session matches the task's owner.
    An authenticated user can enumerate and read any task by ID, including tasks
    belonging to other users.
  - Validate: Add an ownership check after the task lookup. Return a 403 if the
    authenticated user ID does not match the task owner. Add a test that asserts a
    cross-user fetch returns 403, not the task data.
```

**Task record fields:**

| Field      | Value                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| Title      | Validate that authenticated user owns resource before returning in getTaskById                               |
| File       | `src/commands/run.ts`                                                                                        |
| Severity   | `high`                                                                                                       |
| Effort     | `small`                                                                                                      |
| Risk       | `low`                                                                                                        |
| Rationale  | Task lookup uses caller-supplied ID without ownership verification; any authenticated user can read any task |
| Validation | Add ownership check; assert cross-user fetch returns 403                                                     |
