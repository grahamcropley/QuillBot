# Deployment Checklist

## Prerequisites

### 1. Set GitHub Actions Secrets

Navigate to **Settings > Secrets and variables > Actions > Secrets** and add:

**Required:**

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

**Provider API Keys** (add the ones you use):

- `OPENROUTER_API_KEY`
- `OPENAI_API_KEY`
- `MINIMAX_API_KEY`
- `ZAI_CODING_PLAN_API_KEY`
- `COPILOT_OAUTH_TOKEN` - GitHub Copilot OAuth token (starts with `gho_`)

### 2. Upload OpenCode Config to Azure Files

The GitHub Actions workflow automatically generates and uploads config during deployment.

**What gets uploaded automatically:**

- `opencode.json` - Main configuration
- `commands/*.md` - Custom command definitions
- `github-copilot/hosts.json` - Generated from `COPILOT_OAUTH_TOKEN` secret

**Manual upload (if needed):**

```bash
# Run the automated script
chmod +x scripts/upload-config-to-azure.sh
./scripts/upload-config-to-azure.sh quillbotstoragedev opencode-config
```

**Note**: The `github-copilot/hosts.json` file is generated at deployment time from the `GITHUB_COPILOT_TOKEN` secret and should NOT be committed to the repository.

### 3. Verify Config Structure

After upload, the Azure Files share should look like:

```
opencode-config/ (Azure Files Share)
├── opencode.json
├── commands/
│   ├── write-content.md
│   ├── rewrite-content.md
│   └── review-content.md
└── github-copilot/
    └── hosts.json
```

## Verification Steps

### Local Docker Compose Test

```bash
# Create .env file with API keys
cp .env.example .env
# Edit .env and fill in API keys

# Start containers
docker compose up --build

# Test:
# 1. Open http://localhost:3000
# 2. Create new project
# 3. Submit brief via form
# 4. Verify draft.md is created in project directory
# 5. Check docker logs for OpenCode command execution
```

### Azure Deployment Test

```bash
# Push to main to trigger deployment
git push origin main

# Wait for GitHub Actions to complete

# Test deployed app:
# 1. Navigate to Azure Container App URL
# 2. Sign in with Microsoft account
# 3. Create new project
# 4. Submit brief via form
# 5. Verify draft.md appears in File Explorer
# 6. Check Azure Container App logs for errors

# Check logs
az containerapp logs show \
  --name quillbot \
  --resource-group quillbot-dev \
  --container opencode \
  --tail 100
```

## Troubleshooting

### Issue: 404 when accessing draft.md

**Cause**: OpenCode can't find command definitions

**Check**:

1. Azure Files share `opencode-config` has correct structure
2. Container logs show: `No such file or directory: /app/.config/opencode/commands/write-content.md`
3. Environment variables are set correctly

**Fix**: Re-upload config files (see step 2 above)

### Issue: OpenCode session created but no files generated

**Cause**: Command executed but failed silently

**Check**:

1. OpenCode container logs: `docker logs <container-id>` or Azure logs
2. API key environment variables are set
3. GitHub Copilot auth is configured

**Fix**:

- Verify all secrets are set in GitHub Actions (including `COPILOT_OAUTH_TOKEN`)
- Check deployment logs to ensure `hosts.json` was generated and uploaded
- Redeploy after fixing secrets

### Issue: Authentication errors

**Cause**: Provider API keys missing or invalid

**Check**:

1. GitHub Actions secrets are set
2. Environment variables passed to container
3. OpenCode logs show auth errors

**Fix**: Update GitHub Actions secrets and redeploy

## Migration Notes

### Changes from Previous Setup

**Old structure** (broken):

```
opencode-config/
├── auth.json              ← Custom file (not OpenCode standard)
└── opencode/              ← Symlinks (broken in containers)
    ├── auth.json -> ../auth.json
    ├── opencode.json -> ../opencode.json
    └── commands -> ../commands
```

**New structure** (correct):

```
opencode-config/
├── opencode.json          ← Main config (flat)
├── commands/              ← Command definitions (flat)
│   └── *.md
└── github-copilot/        ← Standard location
    └── hosts.json         ← OAuth tokens
```

**Environment variables** (new):

- `OPENROUTER_API_KEY`
- `OPENAI_API_KEY`
- `MINIMAX_API_KEY`
- `ZAI_CODING_PLAN_API_KEY`

### Why This Change?

1. **Symlinks don't work in containers** - Absolute paths from host don't exist in container
2. **auth.json is non-standard** - OpenCode doesn't natively support it
3. **Environment variables are more secure** - No secrets in filesystem
4. **Follows XDG spec** - OpenCode expects `$XDG_CONFIG_HOME/opencode/` structure
5. **GitHub Copilot auth standardized** - Uses official location `github-copilot/hosts.json`

## Post-Deployment Checklist

- [ ] GitHub Actions secrets set
- [ ] OpenCode config uploaded to Azure Files
- [ ] Local Docker Compose test passed
- [ ] Azure deployment succeeded
- [ ] Authentication (Easy Auth) working
- [ ] Can create project
- [ ] Can submit brief and get draft.md
- [ ] File Explorer shows files
- [ ] No errors in container logs
