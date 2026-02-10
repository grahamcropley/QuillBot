#!/bin/bash
# Verify pnpm workspace + AgentChat package integration

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}i ${1}${NC}"; }
log_success() { echo -e "${GREEN}OK ${1}${NC}"; }
log_warn() { echo -e "${YELLOW}! ${1}${NC}"; }
log_error() { echo -e "${RED}X ${1}${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ERRORS=0

echo ""
echo -e "${BLUE}Workspace Verification${NC}"
echo "----------------------------------------"

log_info "Checking workspace config..."
if [ -f "pnpm-workspace.yaml" ]; then
  log_success "pnpm-workspace.yaml exists"
else
  log_error "pnpm-workspace.yaml missing"
  ERRORS=$((ERRORS + 1))
fi

if [ -d "packages/react" ] && [ -d "packages/server-core" ] && [ -d "packages/server-next" ]; then
  log_success "AgentChat packages exist under packages/*"
else
  log_error "Missing one or more AgentChat workspace packages"
  ERRORS=$((ERRORS + 1))
fi

echo ""
log_info "Checking dependency wiring..."
if grep -q '"@agent-chat/react": "workspace:\*"' package.json \
  && grep -q '"@agent-chat/server-core": "workspace:\*"' package.json \
  && grep -q '"@agent-chat/server-next": "workspace:\*"' package.json; then
  log_success "Root package.json uses workspace:* dependencies"
else
  log_error "Root package.json still has non-workspace @agent-chat dependency entries"
  ERRORS=$((ERRORS + 1))
fi

if grep -q '"@agent-chat/server-core": "workspace:\*"' packages/server-next/package.json; then
  log_success "server-next depends on server-core via workspace:*"
else
  log_error "server-next package dependency is not workspace:*"
  ERRORS=$((ERRORS + 1))
fi

echo ""
log_info "Checking lockfile and package manager..."
if [ -f "pnpm-lock.yaml" ]; then
  log_success "pnpm-lock.yaml exists"
else
  log_error "pnpm-lock.yaml missing (run: pnpm install)"
  ERRORS=$((ERRORS + 1))
fi

if [ -f "package-lock.json" ]; then
  log_error "package-lock.json still present"
  ERRORS=$((ERRORS + 1))
else
  log_success "package-lock.json removed"
fi

if grep -q '"packageManager": "pnpm@' package.json; then
  log_success "packageManager is pinned to pnpm"
else
  log_error "packageManager field missing pnpm pin"
  ERRORS=$((ERRORS + 1))
fi

echo ""
log_info "Checking install resolution..."
if pnpm ls @agent-chat/react @agent-chat/server-core @agent-chat/server-next >/dev/null 2>&1; then
  log_success "Workspace packages resolve correctly"
else
  log_error "Workspace packages are not resolvable (run: pnpm install)"
  ERRORS=$((ERRORS + 1))
fi

echo ""
if [ $ERRORS -eq 0 ]; then
  log_success "All checks passed"
  echo ""
  echo "Pipeline:"
  echo "  1. Local dev:    pnpm dev"
  echo "  2. Docker local: docker compose up --build"
  echo "  3. CI deploy:    push to main"
  exit 0
else
  log_error "Found $ERRORS error(s)."
  echo ""
  echo "See AGENT_CHAT_PACKAGES.md for setup details."
  exit 1
fi
