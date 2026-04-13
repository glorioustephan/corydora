---
title: Getting Started
description: Install Corydora, verify your runtime, and prepare your repository for its first run.
---

# Getting Started

Corydora is a globally installable CLI for overnight code maintenance. You point it at a git repository, choose a provider and a mode, and let it work through focused improvements that you can review later.

## Prerequisites

Before you install Corydora, make sure you have:

- **Node.js** `20.19.0` or newer
- **pnpm** `10.32.1` or newer if you want the recommended package manager, or npm if you prefer it
- **git** because Corydora runs inside a git repository
- **At least one configured provider**. See [Providers](/providers/) for setup details.

You only need one runtime. Corydora supports CLI-backed providers such as `claude-cli`, `codex-cli`, and `gemini-cli`, plus API-backed providers such as `anthropic-api`, `openai-api`, `google-api`, `bedrock`, and `ollama`.

## Installation

Install Corydora globally:

```bash
pnpm add -g corydora
```

Or:

```bash
npm install -g corydora
```

## Verify the CLI

Confirm the binary is available:

```bash
corydora --version
```

You should see the installed version.

## Check provider readiness

Run `doctor` before your first project setup:

```bash
corydora doctor
```

The output tells you:

- which package manager and frameworks Corydora detects
- whether `tmux` is available for background runs
- which providers are installed
- whether each provider looks ready, missing, or unknown from the current machine state

A provider that reports `installed=true auth=ready` is a good default choice. If a provider reports `missing`, use the matching setup guide in [Providers](/providers/).

Example output:

```
Package manager: pnpm
Frameworks: nextjs, node
tmux available: yes
background keep-awake available: yes
claude-cli: installed=true auth=ready (Claude Code authenticated)
anthropic-api: installed=true auth=ready (ANTHROPIC_API_KEY set)
openai-api: installed=false auth=missing (OPENAI_API_KEY not set)
```

## Initialize a repository

From the root of the repository you want Corydora to maintain:

```bash
corydora init
```

`init` creates:

- `.corydora.json` with your default provider, model, isolation mode, and runtime settings
- `.corydora/` for run state, logs, imported agents, and generated task queues

If you want a non-interactive setup:

```bash
corydora init --yes
```

## What to do next

- [Quickstart](/quickstart) shows the first end-to-end run, including `--mode`, background runs, and review workflow.
- [Configuration](/configuration) explains how to change defaults, tune worker counts, and route stages to different providers or models.
- [CLI Reference](/cli-reference) documents every command and flag.
