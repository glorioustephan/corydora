---
title: AWS Bedrock
---

# AWS Bedrock

The `bedrock` provider calls Amazon Bedrock using `@aws-sdk/client-bedrock-runtime`. It integrates with the standard AWS credential chain, making it a natural fit for teams that already operate within AWS infrastructure.

## Prerequisites

- AWS account with Bedrock access enabled in your target region
- Model access granted for your chosen model in the [Bedrock console](https://console.aws.amazon.com/bedrock/)
- `AWS_REGION` (or `AWS_DEFAULT_REGION`) set in your environment
- At least one form of AWS credentials configured

## Authentication

`bedrock` uses the standard AWS credential chain via the SDK. Set `AWS_REGION` plus any one of the following credential sources:

**Named profile**

```sh
AWS_REGION=us-east-1
AWS_PROFILE=my-profile
```

**Static credentials**

```sh
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

**Web Identity (IRSA / EKS Pod Identity)**

```sh
AWS_REGION=us-east-1
AWS_WEB_IDENTITY_TOKEN_FILE=/var/run/secrets/eks.amazonaws.com/serviceaccount/token
AWS_ROLE_ARN=arn:aws:iam::123456789012:role/my-role
```

Add these to `.corydora/.env.local` for project-local configuration. Do not commit credentials to `.corydora.json`.

`corydora doctor` reports this check as `bedrock-auth`. When region and credentials are detected:

```
bedrock-auth   ✓  AWS region and credentials were detected.
```

If either is missing:

```
bedrock-auth   ?  AWS_REGION and credentials must be configured for Bedrock.
```

Note: Corydora reports `unknown` rather than `missing` for Bedrock because it cannot verify actual access to Bedrock without making an API call.

## Models

| Model                                       | Notes                                   |
| ------------------------------------------- | --------------------------------------- |
| `anthropic.claude-3-7-sonnet-20250219-v1:0` | Default. Claude 3.7 Sonnet via Bedrock. |

Any model ID available in your AWS region and account can be used. Specify the full Bedrock model ID in the `model` field.

## Execution mode

`bedrock` uses **single-file-json** execution via the `ConverseCommand` from `@aws-sdk/client-bedrock-runtime`. For each file being processed:

1. Corydora reads the file content and builds a structured prompt.
2. A `ConverseCommand` is sent with the prompt as a user message and `maxTokens` taken from `runtime.maxOutputTokens` (default `8192`).
3. The response `output.message.content` text is extracted and parsed as a JSON payload containing scan findings or fix instructions with `fileEdits`.
4. If `fileEdits` are present, Corydora writes the replacement content to disk.

The `ConverseCommand` is a unified API that works across all models available in Bedrock, so switching model IDs does not require any provider-level configuration changes.

## Example configuration

```json
{
  "runtime": {
    "provider": "bedrock",
    "model": "anthropic.claude-3-7-sonnet-20250219-v1:0"
  }
}
```

## Troubleshooting

**Region or credentials not detected**

```
bedrock-auth   ?  AWS_REGION and credentials must be configured for Bedrock.
```

Ensure `AWS_REGION` is set and that at least one of `AWS_PROFILE`, `AWS_ACCESS_KEY_ID`, or `AWS_WEB_IDENTITY_TOKEN_FILE` is present.

**AccessDeniedException from the API**

The IAM principal does not have `bedrock:InvokeModel` permission, or model access has not been granted for the model in the Bedrock console. Check both IAM policies and the Model Access page in your region.

**ResourceNotFoundException or model not found**

The model ID is not available in the configured region. Verify that the model is enabled in the [Bedrock Model Access console](https://console.aws.amazon.com/bedrock/) for your target region.

**Response did not include valid scan JSON**

The response was received but Corydora could not parse a JSON object from the output. This can happen if the model returns a refusal or the response was truncated at the configured `runtime.maxOutputTokens` limit. Check the run logs for the raw response text.
