# Agent-Chat Package Management

This document explains how the QuillBot project manages its dependency on the private `@agent-chat/*` packages.

## Overview

QuillBot depends on three private packages from the [AgentChat-ReactComponent](https://github.com/grahamcropley/AgentChat-ReactComponent) repository:

- `@agent-chat/react` - React UI components
- `@agent-chat/server-core` - Framework-agnostic state management
- `@agent-chat/server-next` - Next.js integration layer

These packages are **not published to npm**. Instead, they are vendored as `.tgz` tarballs in the repository root.

## Why Vendored Tarballs?

**Alternatives considered:**

- ✗ **npm registry** - Requires publishing to public/private registry
- ✗ **GitHub Packages** - Requires PAT/token management in CI
- ✗ **Git dependencies** - npm installs from source (slow, requires build)
- ✗ **Git submodules** - Adds complexity to workflow
- ✓ **Vendored tarballs** - Simple, works everywhere, ~110KB total

**Trade-offs:**

- ✓ Zero external dependencies - works offline
- ✓ Consistent across all environments (dev/docker/CI)
- ✓ Explicit versioning in git history
- ✗ Manual update process required
- ✗ Binary files in git (mitigated by small size)

## 3-Phase Pipeline

### Phase 1: Local Development

**Setup:**

```bash
npm install
npm run dev
```

**How it works:**

- `package.json` references `"@agent-chat/react": "file:./agent-chat-react-0.1.0.tgz"`
- npm extracts tarballs during install
- Standard Next.js dev workflow

### Phase 2: Docker (Local Network)

**Setup:**

```bash
docker compose up --build
```

**How it works:**

- Docker build context = repo root (includes tarballs)
- `.dockerignore` has `!agent-chat-*.tgz` to explicitly include them
- `Dockerfile` copies tarballs before `npm ci`:
  ```dockerfile
  COPY agent-chat-*.tgz ./
  RUN npm ci
  ```

### Phase 3: GitHub Actions → Azure

**Trigger:** Push to `main` branch

**How it works:**

- `docker/build-push-action` uses `context: .` (repo root)
- Same Dockerfile as Phase 2
- Tarballs are committed to git, so they're in the build context
- CI builds and pushes to Azure Container Registry

## Updating Agent-Chat Packages

### Automatic Update (Recommended)

```bash
./update-agent-chat.sh
```

**What it does:**

1. Auto-discovers the AgentChat repo (searches `../AgentChat`, `~/github/AgentChat`, etc.)
2. Runs `npm run make:packages` to build and pack all packages
3. Copies tarballs to QuillBot repo root
4. Runs `npm install` to update `package-lock.json`
5. Generates `.agent-chat-versions` with SHA256 checksums

**Output:**

- `agent-chat-*.tgz` (updated tarballs)
- `package-lock.json` (updated lockfile)
- `.agent-chat-versions` (version manifest)

### Manual Update (Advanced)

If the AgentChat repo is in a non-standard location:

```bash
./update-agent-chat.sh /custom/path/to/AgentChat
```

### After Updating

1. **Review changes:**

   ```bash
   git diff package-lock.json
   cat .agent-chat-versions
   ```

2. **Test locally:**

   ```bash
   npm run dev
   npm run typecheck
   npm test
   ```

3. **Test Docker:**

   ```bash
   docker compose up --build
   ```

4. **Commit:**
   ```bash
   git add agent-chat-*.tgz package-lock.json .agent-chat-versions
   git commit -m "chore: update agent-chat packages to X.Y.Z"
   ```

## Version Tracking

The `.agent-chat-versions` file tracks:

- Filename
- SHA256 checksum
- File size in bytes
- Timestamp and source path

**Example:**

```
# AgentChat Package Versions
# Generated: 2026-02-08 22:25:00 UTC
# Source: /home/graham/github/AgentChat

agent-chat-react-0.1.0.tgz|a1b2c3...|94724
agent-chat-server-core-0.1.0.tgz|d4e5f6...|9512
agent-chat-server-next-0.1.0.tgz|g7h8i9...|9796
```

This allows you to:

- Verify tarball integrity
- Track when packages were updated
- Compare versions across branches

## Troubleshooting

### Error: "Cannot find module '@agent-chat/react'"

**Cause:** Tarballs not installed

**Fix:**

```bash
rm -rf node_modules package-lock.json
npm install
```

### Error: "ENOENT: no such file 'agent-chat-\*.tgz'" (Docker)

**Cause:** Tarballs not in build context or excluded by `.dockerignore`

**Fix:**

1. Verify tarballs exist: `ls agent-chat-*.tgz`
2. Check `.dockerignore` has `!agent-chat-*.tgz`
3. Rebuild: `docker compose build --no-cache`

### Error: GitHub Actions build fails

**Cause:** Tarballs not committed to git

**Fix:**

```bash
git add agent-chat-*.tgz
git commit --amend --no-edit
git push --force-with-lease
```

### Update script can't find AgentChat repo

**Cause:** Repo in non-standard location

**Fix:**

```bash
./update-agent-chat.sh /path/to/AgentChat
```

## Development Workflow Best Practices

1. **Updating packages:**
   - Make changes in AgentChat repo
   - Run `./update-agent-chat.sh` in QuillBot repo
   - Test all 3 phases before committing

2. **Breaking changes:**
   - Update AgentChat packages
   - Fix any TypeScript errors in QuillBot
   - Update tests
   - Document changes in commit message

3. **CI debugging:**
   - GitHub Actions logs show Docker build output
   - Look for "COPY agent-chat-\*.tgz" and "RUN npm ci" steps
   - Verify no ENOENT errors

## Files Reference

| File                                         | Purpose                                 | Git Tracked |
| -------------------------------------------- | --------------------------------------- | ----------- |
| `agent-chat-*.tgz`                           | Vendored packages                       | ✓ Yes       |
| `.agent-chat-versions`                       | Version manifest                        | ✓ Yes       |
| `update-agent-chat.sh`                       | Update automation                       | ✓ Yes       |
| `.dockerignore`                              | Includes tarballs (`!agent-chat-*.tgz`) | ✓ Yes       |
| `containers/web/Dockerfile`                  | Copies tarballs before `npm ci`         | ✓ Yes       |
| `docker-compose.yml`                         | Uses `context: .` to include tarballs   | ✓ Yes       |
| `.github/workflows/azure-container-apps.yml` | Uses `context: .`                       | ✓ Yes       |

## Future Improvements

If the vendored tarball approach becomes unwieldy:

1. **GitHub Packages** - Publish to GitHub npm registry
2. **Git submodule** - Reference AgentChat directly
3. **Monorepo merge** - Move packages into this repo

For now, the vendored approach is simple and works reliably across all 3 phases.
