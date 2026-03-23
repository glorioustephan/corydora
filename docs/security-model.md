# Security Model

- Corydora never stores secrets in `.corydora.json`.
- `.corydora/.env.local` is ignored by default.
- Runtime adapters probe availability and auth state separately.
- Queue markdown files are derived from machine state so agent output is normalized before it is
  rendered into a user-facing task list.
- `current-branch` mode requires explicit opt-in because it edits the active checkout directly.
- `worktree` mode is the default because it isolates generated changes from the user’s main working
  tree.
