---
title: Gemini CLI
---

# Gemini CLI

The `gemini-cli` provider delegates execution to the local `gemini` binary (Google Gemini CLI). It uses native-agent execution, allowing the agent to read and modify your codebase using its own built-in tools.

## Prerequisites

- [Google Gemini CLI](https://github.com/google-gemini/gemini-cli) installed and on your `PATH`
- At least one form of Google authentication configured

Verify the binary is available:

```sh
which gemini
```

## Authentication

`gemini-cli` checks for credentials in the following order:

1. `GOOGLE_API_KEY` environment variable
2. `GEMINI_API_KEY` environment variable
3. `GOOGLE_APPLICATION_CREDENTIALS` environment variable (service account)
4. Application Default Credentials via gcloud (`~/.config/gcloud`)

Set a key in `.corydora/.env.local`:

```sh
GEMINI_API_KEY=AIza...
```

Or authenticate through the gcloud CLI for ADC:

```sh
gcloud auth application-default login
```

`corydora doctor` reports this check as `gemini-cli-auth`. Passing results:

```
gemini-cli-binary   ✓  Google Gemini CLI binary detected.
gemini-cli-auth     ✓  Google credentials detected in the environment.
```

If gcloud ADC is configured but no environment variable is set:

```
gemini-cli-auth     ?  gcloud config exists; Gemini CLI may be authenticated through ADC.
```

## Models

| Model              | Notes                                     |
| ------------------ | ----------------------------------------- |
| `gemini-2.5-pro`   | Default. Best reasoning and code quality. |
| `gemini-2.5-flash` | Faster and more cost-efficient.           |

## Execution mode

`gemini-cli` uses **native-agent** execution. Corydora passes the prompt via `--prompt` and controls the agent's permissions through `--sandbox` and `--approval-mode`.

**Scan phase** — sandboxed with `--approval-mode default`, which restricts the agent to read-only actions:

```sh
gemini \
  --model gemini-2.5-pro \
  --sandbox true \
  --approval-mode default \
  --output-format text \
  --prompt "<prompt>"
```

**Fix phase** — sandboxed with `--approval-mode auto_edit`, which allows the agent to apply edits automatically:

```sh
gemini \
  --model gemini-2.5-pro \
  --sandbox true \
  --approval-mode auto_edit \
  --output-format text \
  --prompt "<prompt>"
```

The sandbox flag keeps all file operations scoped to the working directory.

## Example configuration

```json
{
  "runtime": {
    "provider": "gemini-cli",
    "model": "gemini-2.5-pro"
  }
}
```

To use Flash for faster iteration:

```json
{
  "runtime": {
    "provider": "gemini-cli",
    "model": "gemini-2.5-flash"
  }
}
```

## Troubleshooting

**Binary not found**

```
gemini-cli-binary   ✗  Google Gemini CLI binary not found.
```

Install the Gemini CLI and ensure it is on your `PATH`. See the [Gemini CLI repository](https://github.com/google-gemini/gemini-cli) for installation instructions.

**No credentials detected**

```
gemini-cli-auth     ✗  No Gemini or Google credentials detected.
```

Set `GEMINI_API_KEY` or `GOOGLE_API_KEY` in `.corydora/.env.local`, or run `gcloud auth application-default login`.

**ADC config present but status unknown**

Corydora detects `~/.config/gcloud` but cannot verify the session without invoking the CLI. Run `gcloud auth application-default print-access-token` to confirm the ADC session is valid.
