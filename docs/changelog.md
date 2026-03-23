---
title: Changelog
---

# Changelog

All notable changes to Corydora are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] - 2026-03-22

### Added

- Core CLI with commands: `init`, `run`, `doctor`, `status`, `attach`, `stop`, `agents list`, `agents import`, `config validate`
- 8 builtin agents: Bug Investigator, Performance Engineer, Test Hardener, Todo Triager, Feature Scout, Security Auditor, Database Reviewer, Refactoring Engineer
- Runtime adapters for 8 AI providers: `claude-cli`, `codex-cli`, `gemini-cli`, `anthropic-api`, `openai-api`, `google-api`, `bedrock`, `ollama`
- Git isolation with worktree (default), branch, and current-branch modes
- Background execution via tmux with attach, stop, and status management
- Resumable run state with scheduler cursors and per-task tracking
- Task deduplication via SHA256 hashing
- Category-specific markdown queue rendering (bugs, performance, tests, todo, features)
- Project fingerprint detection covering package manager, frameworks, and tech lenses
- JSON output mode (`--json`) for all commands
- Configuration validation via Zod schema
- CI pipeline with typecheck, test, build, and pack verification steps
- npm trusted publishing via GitHub Actions OIDC
