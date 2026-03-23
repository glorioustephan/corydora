---
title: Google AI API
---

# Google AI API

The `google-api` provider calls the Google Generative Language API (Gemini) directly over HTTP. It does not require the Gemini CLI to be installed — only an API key.

## Prerequisites

- A [Google AI Studio API key](https://aistudio.google.com/app/apikey) (`GOOGLE_API_KEY` or `GEMINI_API_KEY`)
- No additional binaries required

## Authentication

Set either `GOOGLE_API_KEY` or `GEMINI_API_KEY` in your environment or in `.corydora/.env.local`. Both variable names are accepted — whichever is present will be used:

```sh
GOOGLE_API_KEY=AIza...
```

or:

```sh
GEMINI_API_KEY=AIza...
```

`corydora doctor` reports this check as `google-api-auth`:

```
google-api-auth   ✓  Google API credentials detected.
```

If neither key is set:

```
google-api-auth   ✗  GOOGLE_API_KEY or GEMINI_API_KEY is missing.
```

## Models

| Model              | Notes                                     |
| ------------------ | ----------------------------------------- |
| `gemini-2.5-pro`   | Default. Best reasoning and code quality. |
| `gemini-2.5-flash` | Faster and more cost-efficient.           |

Pass any valid Gemini model ID in the `model` field — Corydora includes it in the request URL.

## Execution mode

`google-api` uses **single-file-json** execution. For each file being processed:

1. Corydora reads the file content and builds a structured prompt.
2. A `POST` request is sent to `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent?key=<key>`.
3. The response `candidates[0].content.parts` text is extracted and parsed as a JSON payload containing scan findings or fix instructions with `fileEdits`.
4. If `fileEdits` are present, Corydora writes the replacement content to disk.

## Example configuration

```json
{
  "runtime": {
    "provider": "google-api",
    "model": "gemini-2.5-pro"
  }
}
```

To use Flash for faster, lower-cost runs:

```json
{
  "runtime": {
    "provider": "google-api",
    "model": "gemini-2.5-flash"
  }
}
```

## Troubleshooting

**API key missing**

```
google-api-auth   ✗  GOOGLE_API_KEY or GEMINI_API_KEY is missing.
```

Add one of the accepted keys to `.corydora/.env.local`. Do not commit it to `.corydora.json`.

**HTTP 400 or 403 from the API**

Verify that the model ID is valid and that the API key has access to the Generative Language API. Some keys scoped to specific Google Cloud projects may not have access to all models.

**Response did not include valid scan JSON**

The provider responded but Corydora could not parse a JSON object from the output. Check the run logs for the raw API response. A blocked request (safety filter) will produce a response with empty `candidates`, which Corydora will surface as an empty output string.

**Quota exceeded**

If you see HTTP 429 errors, you have exhausted your daily quota for the API key tier. Reduce `maxConcurrentScans` in your `.corydora.json` `scan` config or upgrade your quota in the Google Cloud Console.
