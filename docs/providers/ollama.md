---
title: Ollama
---

# Ollama

The `ollama` provider calls a locally running [Ollama](https://ollama.com) server over HTTP. No API keys, no network calls to third-party services — all inference runs on your machine. This makes `ollama` the best choice for privacy-sensitive codebases or air-gapped environments.

## Prerequisites

- [Ollama](https://ollama.com) installed and running locally
- The model you intend to use pulled to your local Ollama instance

Install Ollama and pull a model:

```sh
# Install Ollama (macOS)
brew install ollama

# Start the Ollama server
ollama serve

# Pull the default model
ollama pull qwen2.5-coder:7b
```

Verify the server is reachable:

```sh
curl http://127.0.0.1:11434/api/tags
```

## Authentication

No authentication is required. Corydora connects to the Ollama server at the address specified by `OLLAMA_HOST`, which defaults to `http://127.0.0.1:11434`.

To use a remote or non-default Ollama instance, set `OLLAMA_HOST` in your environment or in `.corydora/.env.local`:

```sh
OLLAMA_HOST=http://192.168.1.100:11434
```

`corydora doctor` reports this check as `ollama-auth`. Because Ollama has no authentication layer, the check always passes as long as the host is configured:

```
ollama-auth   ✓  Ollama host configured at http://127.0.0.1:11434.
```

## Models

| Model               | Notes                                                    |
| ------------------- | -------------------------------------------------------- |
| `qwen2.5-coder:7b`  | Default. Strong code understanding at a manageable size. |
| `deepseek-coder-v2` | Alternative with strong multi-language support.          |

Any model available in your local Ollama instance can be used. Pass the model name exactly as it appears in `ollama list`.

Pull additional models before running:

```sh
ollama pull deepseek-coder-v2
```

## Execution mode

`ollama` uses **single-file-json** execution. For each file being processed:

1. Corydora reads the file content and builds a structured prompt.
2. A `POST` request is sent to `<OLLAMA_HOST>/api/generate` with `stream: false`.
3. The `response` field of the JSON payload is extracted and parsed as scan findings or fix instructions with `fileEdits`.
4. If `fileEdits` are present, Corydora writes the replacement content to disk.

The `stream: false` parameter ensures Corydora receives the full response as a single object.

## Example configuration

```json
{
  "runtime": {
    "provider": "ollama",
    "model": "qwen2.5-coder:7b"
  }
}
```

With a custom host:

```json
{
  "runtime": {
    "provider": "ollama",
    "model": "qwen2.5-coder:7b"
  }
}
```

```sh
# .corydora/.env.local
OLLAMA_HOST=http://192.168.1.100:11434
```

## Troubleshooting

**Ollama request failed with 404**

The specified model is not available in your local Ollama instance. Run `ollama list` to see what is installed and `ollama pull <model>` to add it.

**Ollama request failed with connection error**

The Ollama server is not running. Start it with `ollama serve`, or verify the address in `OLLAMA_HOST` is correct and reachable.

**Response did not include valid scan JSON**

The model responded but Corydora could not parse a JSON object from the output. Smaller models may not reliably follow the structured output format required by Corydora. Consider switching to `qwen2.5-coder:7b` or a larger variant if you see this consistently.

**Slow performance**

Corydora respects the `maxConcurrentScans` setting in `.corydora.json`. Reduce this value if your machine cannot handle parallel inference requests without degraded performance:

```json
{
  "scan": {
    "maxConcurrentScans": 1
  }
}
```
