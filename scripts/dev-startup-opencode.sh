#!/bin/bash
clear
printf "\033[0;34m╔════════════════════════════════════════╗\033[0m\n"
printf "\033[0;34m║     OpenCode Server (Port 9090)        ║\033[0m\n"
printf "\033[0;34m╚════════════════════════════════════════╝\033[0m\n\n"

# Project root
PROJECT_ROOT="/home/graham/github/QuillBot"
DEV_CONFIG_DIR="$PROJECT_ROOT/dev/app/.config"
DEV_DATA_DIR="$PROJECT_ROOT/dev/app/.local/share"

# Ensure dev directories exist
mkdir -p "$DEV_CONFIG_DIR"
mkdir -p "$DEV_DATA_DIR"

# Copy config from opencode-config/.config/* to dev/app/.config/ (recursive)
echo "📋 Copying OpenCode configuration..."
rsync -a --delete "$PROJECT_ROOT/opencode-config/.config/" "$DEV_CONFIG_DIR/"
echo "✓ Configuration copied to $DEV_CONFIG_DIR"
echo ""

# Change to projects directory
cd "$PROJECT_ROOT/dev/app/data/projects"

# Set environment variables
export OPENCODE_API_URL=http://localhost:9090
export XDG_DATA_HOME="$DEV_DATA_DIR"
export XDG_CONFIG_HOME="$DEV_CONFIG_DIR"
export OPENCODE_ENABLE_EXA=1

# Load environment variables from .env.opencode.local (takes precedence)
if [ -f "$PROJECT_ROOT/.env.opencode.local" ]; then
  set -a
  source "$PROJECT_ROOT/.env.opencode.local"
  set +a
  echo "✓ Loaded OpenCode environment from .env.opencode.local"
else
  echo "⚠ Warning: .env.opencode.local not found"
  echo "  Copy .env.opencode.example to .env.opencode.local and fill in your values"
  exit 1
fi

# Echo environment variables for verification
echo ""
echo "🔧 Environment Variables:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  OPENCODE_API_URL:            $OPENCODE_API_URL"
echo "  OPENCODE_SERVER_USERNAME:    $OPENCODE_SERVER_USERNAME"
echo "  OPENCODE_SERVER_PASSWORD:    ${OPENCODE_SERVER_PASSWORD:0:10}...${OPENCODE_SERVER_PASSWORD: -4}"
echo "  XDG_CONFIG_HOME:             $XDG_CONFIG_HOME"
echo "  XDG_DATA_HOME:               $XDG_DATA_HOME"
echo "  OPENCODE_ENABLE_EXA:         $OPENCODE_ENABLE_EXA"
echo "  AZURE_RESOURCE_NAME:         $AZURE_RESOURCE_NAME"
echo "  AZURE_API_KEY:               ${AZURE_API_KEY:0:10}...${AZURE_API_KEY: -4}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verify config files exist
if [ -f "$XDG_CONFIG_HOME/opencode/opencode.json" ]; then
  echo "✓ Config verified: $XDG_CONFIG_HOME/opencode/opencode.json"
else
  echo "⚠ Warning: opencode.json not found at expected location"
fi

if [ -f "$XDG_CONFIG_HOME/opencode/agents/quillbot.md" ]; then
  echo "✓ Agent verified: $XDG_CONFIG_HOME/opencode/agents/quillbot.md"
else
  echo "⚠ Warning: quillbot.md agent not found at expected location"
fi

echo ""
echo "🚀 Starting OpenCode server..."
echo ""

opencode serve --port 9090 --hostname 0.0.0.0 --log-level DEBUG --print-logs
