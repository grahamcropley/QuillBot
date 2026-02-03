# Azure Deployment

This setup deploys the WebUI + OpenCode as **two containers in one Azure
Container App** for simple internal networking (`OPENCODE_API_URL` is
`http://localhost:9090`). Both containers share Azure Files for `/app/data`,
and OpenCode mounts `/app/.config/opencode` for isolated auth/config.

Note: both containers scale together. If you need independent scaling, split
them into separate Container Apps.

Default resource sizing (cheapest dev profile):

- web: 0.25 CPU / 0.5Gi
- opencode: 0.5 CPU / 1Gi
- scale: minReplicas=0, maxReplicas=1 (scale to zero)

Expect cold starts with scale-to-zero. If that's a problem, set minReplicas=1.

## GitHub Actions Secrets

Required:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

Optional:

- `OPENCODE_API_KEY` (if your OpenCode server expects auth)

## GitHub Actions Variables

Set these repository variables:

- `AZURE_LOCATION` (e.g. `eastus`)
- `AZURE_RESOURCE_GROUP`
- `AZURE_ACR_NAME` (globally unique)
- `AZURE_APP_NAME`
- `AZURE_ENV_NAME`
- `AZURE_LOG_ANALYTICS_NAME`
- `AZURE_STORAGE_ACCOUNT_NAME` (globally unique, lowercase)

Optional overrides:

- `DATA_SHARE_NAME` (default: `quillbot-data`)
- `CONFIG_SHARE_NAME` (default: `opencode-config`)
- `WEB_IMAGE_NAME` (default: `quillbot-web`)
- `OPENCODE_IMAGE_NAME` (default: `quillbot-opencode`)
- `OPENCODE_BASE_IMAGE` (default: `ghcr.io/ohmyopencode/opencode:latest`)

## Config Upload (auth.json)

After the first deploy, upload OpenCode config files to the Azure Files share
named by `CONFIG_SHARE_NAME`:

```bash
az storage file upload \
  --account-name <storage-account> \
  --share-name <config-share> \
  --source auth.json
```

Repeat for `config.json` if you use it.

## Provider Keys

OpenCode still needs provider credentials (Anthropic/OpenAI/etc.). Add them as
container app env vars in Azure (or extend the workflow to set them).
