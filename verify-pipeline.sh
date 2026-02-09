#!/bin/bash
# Verify the 3-phase pipeline is correctly configured

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ ${1}${NC}"; }
log_success() { echo -e "${GREEN}✓ ${1}${NC}"; }
log_warn() { echo -e "${YELLOW}⚠ ${1}${NC}"; }
log_error() { echo -e "${RED}✗ ${1}${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Agent-Chat Pipeline Configuration Verification        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

ERRORS=0

log_info "Checking vendored tarballs..."
for tarball in agent-chat-react-*.tgz agent-chat-server-core-*.tgz agent-chat-server-next-*.tgz; do
  if [ -f "$tarball" ]; then
    size=$(stat -f%z "$tarball" 2>/dev/null || stat -c%s "$tarball" 2>/dev/null)
    log_success "Found: $tarball (${size} bytes)"
  else
    log_error "Missing: $tarball"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""
log_info "Checking package.json references..."
if grep -q '"@agent-chat/react": "file:./agent-chat-react' package.json; then
  log_success "package.json uses file:./ paths"
else
  log_error "package.json doesn't use file:./ paths"
  ERRORS=$((ERRORS + 1))
fi

echo ""
log_info "Checking .dockerignore configuration..."
if grep -q '!agent-chat-\*\.tgz' .dockerignore; then
  log_success ".dockerignore includes tarballs"
else
  log_error ".dockerignore doesn't include tarballs (!agent-chat-*.tgz)"
  ERRORS=$((ERRORS + 1))
fi

echo ""
log_info "Checking Dockerfile..."
if grep -q 'COPY agent-chat-\*\.tgz' containers/web/Dockerfile; then
  log_success "Dockerfile copies tarballs"
else
  log_error "Dockerfile doesn't copy tarballs"
  ERRORS=$((ERRORS + 1))
fi

echo ""
log_info "Checking docker-compose.yml..."
if grep -q 'context: \.' docker-compose.yml && grep -q 'dockerfile: containers/web/Dockerfile' docker-compose.yml; then
  log_success "docker-compose uses correct context and dockerfile"
else
  log_error "docker-compose configuration incorrect"
  ERRORS=$((ERRORS + 1))
fi

echo ""
log_info "Checking GitHub Actions workflow..."
if grep -q 'context: \.' .github/workflows/azure-container-apps.yml && grep -q 'file: containers/web/Dockerfile' .github/workflows/azure-container-apps.yml; then
  log_success "GitHub Actions uses correct context and dockerfile"
else
  log_error "GitHub Actions configuration incorrect"
  ERRORS=$((ERRORS + 1))
fi

echo ""
log_info "Checking git tracking..."
for file in agent-chat-*.tgz .dockerignore containers/web/Dockerfile; do
  if git ls-files --error-unmatch "$file" > /dev/null 2>&1; then
    log_success "Git tracks: $file"
  else
    log_error "Not tracked by git: $file"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""
log_info "Checking npm packages..."
if npm ls @agent-chat/react @agent-chat/server-core @agent-chat/server-next > /dev/null 2>&1; then
  log_success "All @agent-chat packages installed"
else
  log_error "Some @agent-chat packages missing (run: npm install)"
  ERRORS=$((ERRORS + 1))
fi

echo ""
if [ -f ".agent-chat-versions" ]; then
  log_info "Version manifest:"
  while IFS='|' read -r filename hash size; do
    if [ ! "$filename" = "# AgentChat Package Versions" ] && [ ! -z "$filename" ]; then
      echo "  - $filename"
    fi
  done < .agent-chat-versions
else
  log_warn "No .agent-chat-versions file (run: ./update-agent-chat.sh)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ]; then
  log_success "All checks passed! 3-phase pipeline is correctly configured."
  echo ""
  echo "Phases:"
  echo "  1. Local dev:    npm run dev"
  echo "  2. Docker local: docker compose up --build"
  echo "  3. GitHub → Azure: Push to main branch"
  echo ""
  exit 0
else
  log_error "Found $ERRORS error(s). Pipeline may not work correctly."
  echo ""
  echo "See AGENT_CHAT_PACKAGES.md for troubleshooting."
  echo ""
  exit 1
fi
