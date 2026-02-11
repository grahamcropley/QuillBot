#!/bin/bash
PROJECT_ROOT="/home/graham/github/QuillBot"

cd "$PROJECT_ROOT"
clear
printf "\033[0;32m╔════════════════════════════════════════╗\033[0m\n"
printf "\033[0;32m║    Next.js Dev Server (Port 3000)      ║\033[0m\n"
printf "\033[0;32m╚════════════════════════════════════════╝\033[0m\n\n"

if [ -f "$PROJECT_ROOT/.env.web.local" ]; then
  set -a
  source "$PROJECT_ROOT/.env.web.local"
  set +a
  echo "✓ Loaded Next.js environment from .env.web.local"
  echo ""
  echo "🔧 Key Environment Variables:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  OPENCODE_API_URL:           $OPENCODE_API_URL"
  echo "  OPENCODE_SERVER_USERNAME:   $OPENCODE_SERVER_USERNAME"
  echo "  OPENCODE_SERVER_PASSWORD:   ${OPENCODE_SERVER_PASSWORD:0:10}...${OPENCODE_SERVER_PASSWORD: -4}"
  echo "  AZURE_RESOURCE_NAME:        $AZURE_RESOURCE_NAME"
  echo "  EASY_AUTH_DEV_USER:         $EASY_AUTH_DEV_USER"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
else
  echo "⚠ Warning: .env.web.local not found"
  echo "  Copy .env.web.example to .env.web.local and fill in your values"
  exit 1
fi

sleep 2
exec pnpm dev
