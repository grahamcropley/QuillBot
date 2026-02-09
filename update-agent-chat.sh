#!/bin/bash
# Update vendored @agent-chat packages from local AgentChat repo
#
# Usage:
#   ./update-agent-chat.sh [path-to-agentchat-repo]
#
# If no path is provided, searches for AgentChat in common locations:
#   - ../AgentChat
#   - ~/github/AgentChat
#   - ~/projects/AgentChat

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ ${1}${NC}"; }
log_success() { echo -e "${GREEN}✓ ${1}${NC}"; }
log_warn() { echo -e "${YELLOW}⚠ ${1}${NC}"; }
log_error() { echo -e "${RED}✗ ${1}${NC}"; }

# Get the directory where this script lives (QuillBot root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUILLBOT_ROOT="$SCRIPT_DIR"

# Find AgentChat repo
AGENTCHAT_PATH="${1:-}"

if [ -z "$AGENTCHAT_PATH" ]; then
  log_info "Searching for AgentChat repo..."
  
  # Try common locations
  SEARCH_PATHS=(
    "$QUILLBOT_ROOT/../AgentChat"
    "$QUILLBOT_ROOT/../AgentChat-ReactComponent"
    "$HOME/github/AgentChat"
    "$HOME/github/AgentChat-ReactComponent"
    "$HOME/projects/AgentChat"
    "$HOME/projects/AgentChat-ReactComponent"
  )
  
  for path in "${SEARCH_PATHS[@]}"; do
    if [ -d "$path" ] && [ -f "$path/package.json" ]; then
      AGENTCHAT_PATH="$path"
      log_success "Found AgentChat at: $AGENTCHAT_PATH"
      break
    fi
  done
  
  if [ -z "$AGENTCHAT_PATH" ]; then
    log_error "Could not find AgentChat repo"
    log_info "Please provide the path explicitly:"
    log_info "  ./update-agent-chat.sh /path/to/AgentChat"
    exit 1
  fi
else
  AGENTCHAT_PATH="$(cd "$AGENTCHAT_PATH" && pwd)"
  if [ ! -f "$AGENTCHAT_PATH/package.json" ]; then
    log_error "Invalid AgentChat path: $AGENTCHAT_PATH"
    exit 1
  fi
  log_success "Using AgentChat at: $AGENTCHAT_PATH"
fi

# Verify AgentChat has the make:packages script
if ! grep -q '"make:packages"' "$AGENTCHAT_PATH/package.json"; then
  log_error "AgentChat repo doesn't have 'make:packages' script"
  exit 1
fi

echo ""
log_info "Building AgentChat packages..."
cd "$AGENTCHAT_PATH"

# Build and pack all packages
npm run make:packages

# Find the generated tarballs
TARBALLS=(
  "agent-chat-react-"*.tgz
  "agent-chat-server-core-"*.tgz
  "agent-chat-server-next-"*.tgz
)

# Verify all tarballs exist
for pattern in "${TARBALLS[@]}"; do
  # Remove pattern and get actual files
  files=($pattern)
  if [ ! -f "${files[0]}" ]; then
    log_error "Missing tarball: $pattern"
    exit 1
  fi
done

echo ""
log_info "Copying tarballs to QuillBot repo..."
cd "$QUILLBOT_ROOT"

# Copy tarballs
for pattern in agent-chat-*.tgz; do
  src="$AGENTCHAT_PATH/$pattern"
  if [ -f "$src" ]; then
    cp "$src" "$QUILLBOT_ROOT/"
    log_success "Copied: $pattern"
  fi
done

echo ""
log_info "Updating npm dependencies..."

# Install packages (this updates package-lock.json)
npm install

echo ""
log_info "Generating version manifest..."

# Create a version manifest file
VERSION_FILE="$QUILLBOT_ROOT/.agent-chat-versions"
echo "# AgentChat Package Versions" > "$VERSION_FILE"
echo "# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")" >> "$VERSION_FILE"
echo "# Source: $AGENTCHAT_PATH" >> "$VERSION_FILE"
echo "" >> "$VERSION_FILE"

for tarball in agent-chat-*.tgz; do
  if [ -f "$tarball" ]; then
    sha256=$(sha256sum "$tarball" | awk '{print $1}')
    size=$(stat -f%z "$tarball" 2>/dev/null || stat -c%s "$tarball" 2>/dev/null)
    echo "$tarball|$sha256|$size" >> "$VERSION_FILE"
  fi
done

log_success "Version manifest updated: .agent-chat-versions"

echo ""
log_success "Update complete!"
echo ""
log_info "Modified files:"
echo "  - agent-chat-*.tgz (vendored packages)"
echo "  - package-lock.json (dependency lockfile)"
echo "  - .agent-chat-versions (version tracking)"
echo ""
log_info "Next steps:"
echo "  1. Review changes: git diff"
echo "  2. Test locally: npm run dev"
echo "  3. Test Docker: docker compose up --build"
echo "  4. Commit changes: git add . && git commit -m 'chore: update agent-chat packages'"
echo ""
