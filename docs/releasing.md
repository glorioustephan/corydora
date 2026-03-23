# Releasing Corydora

Corydora is set up for **npm trusted publishing** from GitHub Actions.

## Current release flow

1. Merge changes to `main`.
2. Ensure `pnpm check` is green locally or in CI.
3. Create and push a semver tag like `v0.1.0`.
4. GitHub Actions runs `.github/workflows/publish.yml`.
5. The workflow installs dependencies, runs `typecheck`, `test`, and `build`, verifies the tag
   matches `package.json`, upgrades npm to a trusted-publishing-compatible version, and publishes
   to npm.

## First-time setup

1. Create the GitHub repo for Corydora.
2. Confirm `package.json.repository`, `homepage`, and `bugs` match the real repo URL.
3. In npm package settings, configure a trusted publisher:
   - Provider: GitHub Actions
   - Repository: the Corydora repo
   - Workflow filename: `publish.yml`
   - Environment name: `npm` if you use protected environments
4. Add the optional `npm` environment in GitHub if you want approval gates for publishing.
5. Keep the publish job on a GitHub-hosted runner. npm trusted publishing does not support
   self-hosted runners today.

## Why trusted publishing

- No long-lived `NPM_TOKEN` secret is required for publish.
- npm provenance is generated automatically when the workflow publishes through OIDC.
- The publish job uses Node `22.14.0` because npm trusted publishing requires Node `22.14.0` or
  newer.
- The workflow upgrades npm to `^11.5.1` because trusted publishing requires npm `11.5.1` or newer.
- The workflow can use GitHub-hosted runners only, which matches npm’s current trusted publishing
  requirement.

## Manual fallback

If you need a one-off local publish before trusted publishing is configured:

```bash
pnpm install
pnpm check
pnpm pack:preview
npm publish
```

That is only a bootstrap path. The intended long-term publish path is the GitHub Actions workflow.
