# Provider Setup

Corydora ships runtime adapters for:

- `claude-cli`
- `codex-cli`
- `gemini-cli`
- `anthropic-api`
- `openai-api`
- `google-api`
- `bedrock`
- `ollama`

## CLI-backed providers

- `claude-cli`: requires the `claude` binary and an authenticated Claude Code installation.
- `codex-cli`: requires the `codex` binary and local Codex auth/config.
- `gemini-cli`: requires the `gemini` binary plus CLI auth or Google env credentials.

## API-backed providers

- `anthropic-api`: set `ANTHROPIC_API_KEY`.
- `openai-api`: set `OPENAI_API_KEY`.
- `google-api`: set `GOOGLE_API_KEY` or `GEMINI_API_KEY`.
- `bedrock`: set `AWS_REGION` and standard AWS credentials.
- `ollama`: ensure Ollama is running locally and `OLLAMA_HOST` is reachable.

Put project-local secrets in `.corydora/.env.local`.
