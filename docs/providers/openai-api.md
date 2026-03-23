---
title: OpenAI API
---

# OpenAI API

The `openai-api` provider calls the OpenAI Responses API using the `openai` Node.js client. It requires only an API key — no additional binaries or tools.

## Prerequisites

- An [OpenAI API key](https://platform.openai.com/api-keys)
- No additional binaries required

## Authentication

Set `OPENAI_API_KEY` in your environment or in `.corydora/.env.local`:

```sh
OPENAI_API_KEY=sk-...
```

`corydora doctor` reports this check as `openai-api-auth`:

```
openai-api-auth   ✓  OPENAI_API_KEY is present.
```

If the key is missing:

```
openai-api-auth   ✗  OPENAI_API_KEY is missing.
```

## Models

| Model     | Notes                                                         |
| --------- | ------------------------------------------------------------- |
| `gpt-5`   | Default.                                                      |
| `gpt-4.1` | Previous generation. Useful if you need gpt-4.1 specifically. |

Pass any valid OpenAI model ID in the `model` field — Corydora forwards it directly to the API.

## Execution mode

`openai-api` uses **single-file-json** execution. For each file being processed:

1. Corydora reads the file content and builds a structured prompt.
2. The prompt is sent to the OpenAI Responses API as `input`.
3. The `output_text` field of the response is parsed as a JSON payload containing scan findings or fix instructions with `fileEdits`.
4. If `fileEdits` are present, Corydora writes the replacement content to disk.

Because the model sees one file at a time, this mode works best for focused, self-contained fixes.

## Example configuration

```json
{
  "runtime": {
    "provider": "openai-api",
    "model": "gpt-5"
  }
}
```

## Troubleshooting

**API key missing**

```
openai-api-auth   ✗  OPENAI_API_KEY is missing.
```

Add your key to `.corydora/.env.local`. Do not commit it to `.corydora.json`.

**Response did not include valid scan JSON**

The provider responded but Corydora could not parse a JSON object from the output. This typically means the model returned an error or refusal as plain text, or the response was truncated. Check the run logs for the raw response text.

**Authentication errors from the API**

HTTP 401 errors indicate an invalid or expired key. Verify the key in your [OpenAI platform dashboard](https://platform.openai.com/api-keys) and confirm it has the necessary permissions.

**Rate limits**

If you see HTTP 429 errors, you have hit the rate limit for your OpenAI tier. Reduce `maxConcurrentScans` in your `.corydora.json` `scan` config, or upgrade your OpenAI usage tier.
