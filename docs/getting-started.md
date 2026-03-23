---
title: Getting Started
---

# Getting Started

Corydora is a globally installable CLI that runs overnight AI-assisted code cleanup on your project. It scans your codebase, builds a categorized task queue, and applies small focused fixes on a dedicated branch — leaving your working tree untouched.

## Prerequisites

Before installing Corydora, make sure you have the following:

- **Node.js** `24.14.0` or newer
- **pnpm** `10.32.1` or newer (recommended), or npm
- **git** — Corydora requires a git repository to isolate its changes
- **At least one AI provider** — see [Provider Setup](/providers/) for configuration instructions

Corydora supports CLI-backed providers (`claude-cli`, `codex-cli`, `gemini-cli`) and API-backed providers (`anthropic-api`, `openai-api`, `google-api`, `bedrock`, `ollama`). You only need one.

## Installation

Install Corydora globally with pnpm:

```bash
pnpm add -g corydora
```

Or with npm:

```bash
npm install -g corydora
```

## Verify Installation

Confirm the CLI is available:

```bash
corydora --version
```

You should see the current version number printed to stdout.

## First-time Setup

Before initializing a project, run `corydora doctor` from any directory to check which providers Corydora can find on your machine:

```bash
corydora doctor
```

The output reports:

- **Package manager** detected in the current directory
- **Frameworks** identified (Next.js, Electron, etc.)
- **tmux availability** — required for background runs
- **Per-provider status** — whether each provider is installed, and the authentication state (e.g., `ok`, `missing`, `unauthenticated`)

A provider with `installed=true auth=ok` is ready to use. If a provider shows `auth=missing`, consult the [Provider Setup](/providers/) page for the required environment variable or binary.

Example output:

```
Package manager: pnpm
Frameworks: nextjs, node
tmux available: yes
claude-cli: installed=true auth=ok (Claude Code authenticated)
anthropic-api: installed=true auth=ok (ANTHROPIC_API_KEY set)
openai-api: installed=false auth=missing (OPENAI_API_KEY not set)
```

## Next Steps

- **[Quickstart](/quickstart)** — initialize a project and run Corydora for the first time
- **[Provider Setup](/providers/)** — configure your AI provider credentials
