---
title: Providers
---

# Providers

Corydora is provider-neutral. It ships runtime adapters for 8 AI runtimes, and you configure exactly one as your active provider in `.corydora.json`. The adapters fall into two categories based on how they execute work.

## CLI-backed providers

CLI-backed providers use **native-agent** execution mode. Corydora spawns the AI tool as a subprocess and lets it run autonomously inside a git worktree. The agent reads and edits files using its own built-in tools — Corydora does not intermediate the file I/O. This makes CLI-backed providers the strongest choice for complex, multi-file changes where the model benefits from being able to navigate the codebase iteratively.

## API-backed providers

API-backed providers use **single-file-json** execution mode. Corydora reads the target file, constructs a prompt that includes the full file content, sends it to the provider's API, and parses the response as a structured JSON payload. The model returns either inline `fileEdits` (path + replacement content) or a diff-style result, which Corydora applies. This mode is simpler to set up and works well for focused single-file fixes.

## Provider comparison

| Provider        | Type | Execution Mode   | Default Model                               | Auth Method                         |
| --------------- | ---- | ---------------- | ------------------------------------------- | ----------------------------------- |
| `claude-cli`    | CLI  | native-agent     | `sonnet`                                    | Claude Code auth                    |
| `codex-cli`     | CLI  | native-agent     | `gpt-5-codex`                               | OpenAI auth / `OPENAI_API_KEY`      |
| `gemini-cli`    | CLI  | native-agent     | `gemini-2.5-pro`                            | Google auth / API key               |
| `anthropic-api` | API  | single-file-json | `claude-sonnet-4-5`                         | `ANTHROPIC_API_KEY`                 |
| `openai-api`    | API  | single-file-json | `gpt-5`                                     | `OPENAI_API_KEY`                    |
| `google-api`    | API  | single-file-json | `gemini-2.5-pro`                            | `GOOGLE_API_KEY` / `GEMINI_API_KEY` |
| `bedrock`       | API  | single-file-json | `anthropic.claude-3-7-sonnet-20250219-v1:0` | AWS credentials                     |
| `ollama`        | API  | single-file-json | `qwen2.5-coder:7b`                          | Local Ollama server                 |

## Which provider should I use?

- **Claude Code installed** — use `claude-cli`. It has the richest tool access (Read, Glob, Grep, Edit, Write, and scoped Bash) and handles large multi-file refactors well.
- **API key only** — `anthropic-api` or `openai-api` are straightforward starting points. Set one environment variable and you're running.
- **Fully local / privacy-sensitive** — use `ollama`. No data leaves your machine.
- **AWS infrastructure** — use `bedrock` to stay within your existing IAM and audit boundaries.

Run `corydora doctor` at any time to see which providers are installed and authenticated on your machine.

## Secrets and environment variables

Store project-local secrets in `.corydora/.env.local`. This file is git-ignored by default and is loaded automatically when Corydora starts. Never put API keys or credentials in `.corydora.json` — that file is meant to be committed.

```
.corydora/
  .env.local      # secrets — git-ignored
  .corydora.json  # config — commit this
```
