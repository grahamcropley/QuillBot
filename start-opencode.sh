#!/bin/bash

# OpenCode Server Startup Script
# Starts the OpenCode server with QuillBot configuration and projects directory

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory (root of project)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration paths
CONFIG_DIR="${SCRIPT_DIR}/opencode-config"
PROJECTS_DIR="${SCRIPT_DIR}/data/projects"
AUTH_FILE="${CONFIG_DIR}/auth.json"
CONFIG_FILE="${CONFIG_DIR}/opencode.json"

# Colors/formatting functions
log_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

log_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠ ${1}${NC}"
}

log_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

# Banner
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           OpenCode Server - QuillBot Edition               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Validate configuration files exist
log_info "Validating configuration..."

if [ ! -f "$AUTH_FILE" ]; then
    log_error "auth.json not found at ${AUTH_FILE}"
    log_warn "Please copy your auth.json file to ${CONFIG_DIR}/"
    exit 1
fi
log_success "auth.json found"

if [ ! -f "$CONFIG_FILE" ]; then
    log_error "opencode.json not found at ${CONFIG_FILE}"
    exit 1
fi
log_success "opencode.json found"

# Validate projects directory exists
if [ ! -d "$PROJECTS_DIR" ]; then
    log_warn "Projects directory not found at ${PROJECTS_DIR}"
    log_info "Creating projects directory..."
    mkdir -p "$PROJECTS_DIR"
    log_success "Created ${PROJECTS_DIR}"
fi
log_success "Projects directory ready at ${PROJECTS_DIR}"

# Validate command configs exist
log_info "Checking command configurations..."
REQUIRED_COMMANDS=("write-content" "edit-content" "review-content" "analyze-readability" "export-document")
MISSING_COMMANDS=()

for cmd in "${REQUIRED_COMMANDS[@]}"; do
    if [ ! -f "${CONFIG_DIR}/commands/${cmd}.json" ]; then
        MISSING_COMMANDS+=("$cmd")
    fi
done

if [ ${#MISSING_COMMANDS[@]} -gt 0 ]; then
    log_warn "Missing command configurations: ${MISSING_COMMANDS[*]}"
else
    log_success "All 5 command configurations found"
fi

echo ""
log_info "Configuration Summary:"
echo "  Config Directory:     ${CONFIG_DIR}"
echo "  Projects Directory:   ${PROJECTS_DIR}"
echo "  Auth File:            ${AUTH_FILE}"
echo "  Config File:          ${CONFIG_FILE}"
echo ""

# Display startup info
log_info "Starting OpenCode server..."
echo ""
echo -e "${BLUE}Server Configuration:${NC}"
grep -A 5 '"server"' "$CONFIG_FILE" | grep -E '(port|host|environment)' | sed 's/^/  /'
echo ""

# OpenCode uses XDG_CONFIG_HOME for configuration
# Set it to use project-specific config directory
export XDG_CONFIG_HOME="$SCRIPT_DIR/opencode-config"

# OpenCode expects config at $XDG_CONFIG_HOME/opencode/
OPENCODE_XDG_DIR="${XDG_CONFIG_HOME}/opencode"
mkdir -p "$OPENCODE_XDG_DIR"

# Symlink the config files to the XDG location if not already present
[ ! -e "$OPENCODE_XDG_DIR/auth.json" ] && ln -sf "$AUTH_FILE" "$OPENCODE_XDG_DIR/auth.json" && log_success "Linked auth.json"
[ ! -e "$OPENCODE_XDG_DIR/opencode.json" ] && ln -sf "$CONFIG_FILE" "$OPENCODE_XDG_DIR/opencode.json" && log_success "Linked opencode.json"
[ ! -e "$OPENCODE_XDG_DIR/commands" ] && ln -sf "${CONFIG_DIR}/commands" "$OPENCODE_XDG_DIR/commands" && log_success "Linked commands"

log_success "Launching OpenCode server..."
echo ""

cd "$PROJECTS_DIR"
opencode serve --port 9090 --hostname 0.0.0.0 --log-level INFO --print-logs
