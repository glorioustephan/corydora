---
title: Anthropic API
---

# Anthropic API

The `anthropic-api` provider calls the Anthropic Messages API directly using the `@anthropic-ai/sdk` client. It is the simplest way to use Claude models without installing any additional tools — an API key is all that is required.

## Prerequisites

- An [Anthropic API key](https://console.anthropic.com/)
- No additional binaries required

## Authentication

Set `ANTHROPIC_API_KEY` in your environment or in `.corydora/.env.local`:

```sh
ANTHROPIC_API_KEY=sk-ant-...
```

`corydora doctor` reports this check as `anthropic-api-auth`:

```
anthropic-api-auth   ✓  ANTHROPIC_API_KEY is present.
```

If the key is missing:

```
anthropic-api-auth   ✗  ANTHROPIC_API_KEY is missing.
```

## Models

| Model               | Notes                                            |
| ------------------- | ------------------------------------------------ |
| `claude-sonnet-4-5` | Default. Strong balance of speed and capability. |
| `claude-opus-4-1`   | Highest capability for the most demanding tasks. |

Pass any valid Anthropic model ID in the `model` field — Corydora forwards it directly to the API.

## Execution mode

`anthropic-api` uses **single-file-json** execution. For each file being processed:

1. Corydora reads the file content and builds a structured prompt.
2. The prompt is sent to `POST /v1/messages` with `max_tokens: 4096`.
3. The API response is parsed as a JSON payload containing either scan findings or fix instructions with `fileEdits`.
4. If `fileEdits` are present, Corydora writes the replacement content to disk.

Because the model sees one file at a time, this mode works best for focused fixes rather than large cross-file refactors.

## Example configuration

```json
{
  "runtime": {
    "provider": "anthropic-api",
    "model": "claude-sonnet-4-5"
  }
}
```

To use Opus for higher-stakes tasks:

```json
{
  "runtime": {
    "provider": "anthropic-api",
    "model": "claude-opus-4-1"
  }
}
```

## Troubleshooting

**API key missing**

```
anthropic-api-auth   ✗  ANTHROPIC_API_KEY is missing.
```

Add your key to `.corydora/.env.local`. Do not commit it to `.corydora.json`.

**Response did not include valid scan JSON**

The provider responded but Corydora could not parse a JSON object from the output. This can happen if the model hit the `max_tokens` limit mid-response or returned an error message as plain text. Check that your model supports the requested task size, and consider using a model with a higher output limit.

**Authentication errors from the API**

If you see HTTP 401 errors in the logs, verify the API key is correct and has not been revoked in the [Anthropic Console](https://console.anthropic.com/).
