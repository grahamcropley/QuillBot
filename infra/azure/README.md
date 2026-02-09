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

Optional (API keys for OpenCode providers):

- `OPENCODE_API_KEY` (if your OpenCode server expects auth)
- `OPENROUTER_API_KEY` (for OpenRouter provider)
- `OPENAI_API_KEY` (for OpenAI provider)
- `MINIMAX_API_KEY` (for Minimax provider)
- `ZAI_CODING_PLAN_API_KEY` (for ZAI Coding Plan provider)

**Note**: GitHub Copilot authentication is configured via `opencode-config/github-copilot/hosts.json` (uploaded to Azure Files).

## GitHub Actions Variables

Set these repository variables:

- `AZURE_LOCATION` (e.g. `eastus`)
- `AZURE_RESOURCE_GROUP`
- `AZURE_ACR_NAME` (globally unique)
- `AZURE_APP_NAME`
- `AZURE_ENV_NAME`
- `AZURE_LOG_ANALYTICS_NAME`
- `AZURE_STORAGE_ACCOUNT_NAME` (globally unique, lowercase)

Authentication (for Easy Auth with Entra ID):

- `ENTRA_CLIENT_ID` - App registration client ID (e.g. `ce005502-03f5-4ae4-8220-15bfa2534634`)
- `ENTRA_TENANT_ID` - Azure AD tenant ID (e.g. `2e905e36-dc9a-4abd-b156-82dffe6b3944`)

Optional overrides:

- `DATA_SHARE_NAME` (default: `quillbot-data`)
- `CONFIG_SHARE_NAME` (default: `opencode-config`)
- `WEB_IMAGE_NAME` (default: `quillbot-web`)
- `OPENCODE_IMAGE_NAME` (default: `quillbot-opencode`)
- `OPENCODE_VERSION` (default: `latest`)

## Config Upload

After the first deploy, upload OpenCode config files to the Azure Files share
named by `CONFIG_SHARE_NAME`:

```bash
# Upload opencode.json
az storage file upload \
  --account-name <storage-account> \
  --share-name <config-share> \
  --source opencode-config/opencode.json \
  --path opencode.json

# Upload commands directory
az storage directory create \
  --account-name <storage-account> \
  --share-name <config-share> \
  --name commands

for file in opencode-config/commands/*.md; do
  az storage file upload \
    --account-name <storage-account> \
    --share-name <config-share> \
    --source "$file" \
    --path "commands/$(basename "$file")"
done

# Upload GitHub Copilot auth
az storage directory create \
  --account-name <storage-account> \
  --share-name <config-share> \
  --name github-copilot

az storage file upload \
  --account-name <storage-account> \
  --share-name <config-share> \
  --source opencode-config/github-copilot/hosts.json \
  --path github-copilot/hosts.json
```

**Important**: Do NOT upload `auth.json` (deprecated). Provider API keys are now configured via GitHub Secrets and passed as environment variables.

## Provider Keys

OpenCode provider credentials are configured via GitHub Actions secrets (see above) and passed as environment variables to the container. This is more secure than storing them in files.

If you need to update provider keys:

1. Update the corresponding GitHub Actions secret
2. Redeploy the application (push to main or trigger workflow manually)

## Authentication (Easy Auth)

Authentication is configured automatically by the GitHub Actions workflow using
the `ENTRA_CLIENT_ID` and `ENTRA_TENANT_ID` variables. The workflow runs
`az containerapp auth microsoft update` after deployment to configure Easy Auth.

### Current Configuration

- **App Registration**: `quillbot-sso`
- **Client ID**: `ce005502-03f5-4ae4-8220-15bfa2534634`
- **Tenant ID**: `2e905e36-dc9a-4abd-b156-82dffe6b3944`

### Required GitHub Variables

Set these in your repository settings (Settings > Secrets and variables > Actions > Variables):

- `ENTRA_CLIENT_ID`: `ce005502-03f5-4ae4-8220-15bfa2534634`
- `ENTRA_TENANT_ID`: `2e905e36-dc9a-4abd-b156-82dffe6b3944`

### Manual Setup (if needed)

If the workflow variables aren't set, you can configure auth manually:

1. Navigate to **Container Apps > quillbot > Settings > Authentication**
2. Click **Add identity provider**
3. Select **Microsoft**
4. Choose **Pick an existing app registration in this directory**
5. Select **quillbot-sso**
6. Leave other settings as default
7. Click **Add**

### How It Works

Azure Easy Auth acts as a reverse proxy that:

1. Intercepts all requests before they reach your app
2. Redirects unauthenticated users to Microsoft login
3. After successful auth, injects user identity via HTTP headers:
   - `X-MS-CLIENT-PRINCIPAL-NAME` - User's email/UPN
   - `X-MS-CLIENT-PRINCIPAL-ID` - User's Entra ID object ID
   - `X-MS-CLIENT-PRINCIPAL` - Base64-encoded JSON with all claims

The app reads these headers in `src/lib/auth.ts` via `getEasyAuthUser()`.

### Why Portal-Managed?

- **Simpler**: No client secrets to manage in CI/CD
- **Secure**: Azure handles token validation, session management
- **Flexible**: Easy to modify without redeploying
- **Limitation**: Auth config is lost if Container App is deleted
