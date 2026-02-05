#!/bin/bash

# QuillBot Development Environment Stop Script
# Gracefully stops the tmux session and all running servers

set -e

SESSION_NAME="quillbot-dev"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

log_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

log_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    log_error "tmux session '$SESSION_NAME' is not running"
    exit 1
fi

log_info "Stopping QuillBot development environment..."

tmux kill-session -t "$SESSION_NAME"

log_success "Development environment stopped"
echo ""
log_info "To restart: ./start-dev.sh"
