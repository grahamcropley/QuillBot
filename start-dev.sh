#!/bin/bash

# QuillBot Development Environment Startup Script
# Starts OpenCode server and Next.js dev server in a tmux session with split panes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory (root of project)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# tmux session name
SESSION_NAME="quillbot-dev"

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

log_step() {
    echo -e "${CYAN}▶ ${1}${NC}"
}

# Banner
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           QuillBot Development Environment                 ║${NC}"
echo -e "${BLUE}║            OpenCode + Next.js via tmux                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    log_error "tmux is not installed"
    log_info "Install with: sudo apt install tmux (Ubuntu/Debian) or brew install tmux (macOS)"
    exit 1
fi
log_success "tmux is installed"

# Check if session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    log_warn "tmux session '$SESSION_NAME' already exists"
    echo ""
    echo "Options:"
    echo "  1) Attach to existing session (recommended)"
    echo "  2) Kill existing session and create new one"
    echo "  3) Cancel"
    echo ""
    read -p "Choose [1-3]: " choice
    
    case $choice in
        1)
            log_info "Attaching to existing session..."
            tmux attach-session -t "$SESSION_NAME"
            exit 0
            ;;
        2)
            log_info "Killing existing session..."
            tmux kill-session -t "$SESSION_NAME"
            log_success "Session killed"
            ;;
        3)
            log_info "Cancelled"
            exit 0
            ;;
        *)
            log_error "Invalid choice"
            exit 1
            ;;
    esac
fi

# Validate environment
log_step "Validating environment..."

# Check Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed"
    exit 1
fi
NODE_VERSION=$(node --version)
log_success "Node.js ${NODE_VERSION}"

# Check npm
if ! command -v npm &> /dev/null; then
    log_error "npm is not installed"
    exit 1
fi
log_success "npm $(npm --version)"

# Check OpenCode
if ! command -v opencode &> /dev/null; then
    log_error "opencode CLI is not installed"
    log_info "Visit: https://github.com/ohmyopencode/opencode"
    exit 1
fi
log_success "opencode CLI installed"

# Check if node_modules exists
if [ ! -d "${SCRIPT_DIR}/node_modules" ]; then
    log_warn "node_modules not found. Installing dependencies..."
    cd "$SCRIPT_DIR"
    npm install
    log_success "Dependencies installed"
fi
log_success "Dependencies ready"

# Check OpenCode configuration
CONFIG_DIR="${SCRIPT_DIR}/opencode-config"
AUTH_FILE="${CONFIG_DIR}/auth.json"
CONFIG_FILE="${CONFIG_DIR}/opencode.json"

if [ ! -f "$AUTH_FILE" ]; then
    log_warn "OpenCode auth.json not found at ${AUTH_FILE}"
    log_info "OpenCode server may fail to start without authentication"
fi

if [ ! -f "$CONFIG_FILE" ]; then
    log_warn "OpenCode opencode.json not found at ${CONFIG_FILE}"
    log_info "OpenCode server will use default configuration"
fi

echo ""
log_step "Creating tmux session '${SESSION_NAME}'..."

# Create new tmux session (detached)
tmux new-session -d -s "$SESSION_NAME" -n "QuillBot"

# Split window horizontally (two panes side by side)
tmux split-window -h -t "$SESSION_NAME"

# Configure left pane (OpenCode Server)
tmux select-pane -t "$SESSION_NAME:0.0"
tmux send-keys -t "$SESSION_NAME:0.0" "cd '$SCRIPT_DIR'" C-m
tmux send-keys -t "$SESSION_NAME:0.0" "clear" C-m
tmux send-keys -t "$SESSION_NAME:0.0" "echo -e '${BLUE}╔════════════════════════════════════════╗${NC}'" C-m
tmux send-keys -t "$SESSION_NAME:0.0" "echo -e '${BLUE}║       OpenCode Server (Port 9090)      ║${NC}'" C-m
tmux send-keys -t "$SESSION_NAME:0.0" "echo -e '${BLUE}╚════════════════════════════════════════╝${NC}'" C-m
tmux send-keys -t "$SESSION_NAME:0.0" "echo ''" C-m
tmux send-keys -t "$SESSION_NAME:0.0" "./start-opencode.sh" C-m

# Configure right pane (Next.js Dev Server)
tmux select-pane -t "$SESSION_NAME:0.1"
tmux send-keys -t "$SESSION_NAME:0.1" "cd '$SCRIPT_DIR'" C-m
tmux send-keys -t "$SESSION_NAME:0.1" "clear" C-m
tmux send-keys -t "$SESSION_NAME:0.1" "echo -e '${GREEN}╔════════════════════════════════════════╗${NC}'" C-m
tmux send-keys -t "$SESSION_NAME:0.1" "echo -e '${GREEN}║      Next.js Dev Server (Port 3000)    ║${NC}'" C-m
tmux send-keys -t "$SESSION_NAME:0.1" "echo -e '${GREEN}╚════════════════════════════════════════╝${NC}'" C-m
tmux send-keys -t "$SESSION_NAME:0.1" "echo ''" C-m
tmux send-keys -t "$SESSION_NAME:0.1" "sleep 3 && npm run dev" C-m

# Set pane titles (if supported)
tmux set -t "$SESSION_NAME" pane-border-status top
tmux set -t "$SESSION_NAME" pane-border-format "#{pane_index}: #{pane_title}"
tmux select-pane -t "$SESSION_NAME:0.0" -T "OpenCode Server"
tmux select-pane -t "$SESSION_NAME:0.1" -T "Next.js Dev"

# Select left pane (OpenCode) by default
tmux select-pane -t "$SESSION_NAME:0.0"

echo ""
log_success "tmux session created successfully!"
echo ""
echo -e "${CYAN}Session Layout:${NC}"
echo "  ┌─────────────────────────┬─────────────────────────┐"
echo "  │   OpenCode Server       │   Next.js Dev Server    │"
echo "  │   (Port 9090)           │   (Port 3000)           │"
echo "  │   [Pane 0]              │   [Pane 1]              │"
echo "  └─────────────────────────┴─────────────────────────┘"
echo ""
echo -e "${CYAN}Useful tmux commands:${NC}"
echo "  ${GREEN}Ctrl+b ${NC}then ${GREEN}←/→${NC}       Switch between panes"
echo "  ${GREEN}Ctrl+b ${NC}then ${GREEN}z${NC}         Zoom current pane (toggle fullscreen)"
echo "  ${GREEN}Ctrl+b ${NC}then ${GREEN}[${NC}         Enter scroll mode (q to exit)"
echo "  ${GREEN}Ctrl+b ${NC}then ${GREEN}d${NC}         Detach from session (keeps running)"
echo "  ${GREEN}tmux attach -t $SESSION_NAME${NC}  Reattach to session"
echo "  ${GREEN}tmux kill-session -t $SESSION_NAME${NC}  Stop all servers"
echo ""
echo -e "${CYAN}Application URLs:${NC}"
echo "  ${BLUE}Web UI:${NC}          http://localhost:3000"
echo "  ${BLUE}OpenCode API:${NC}    http://localhost:9090"
echo ""
log_info "Attaching to session in 2 seconds..."
sleep 2

# Attach to the session
tmux attach-session -t "$SESSION_NAME"
