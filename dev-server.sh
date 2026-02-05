#!/bin/bash

# QuillBot Development Server Manager
# Unified script for starting, stopping, and monitoring the development environment
# 
# Usage:
#   ./dev-server.sh start    - Start OpenCode + Next.js in detached tmux session
#   ./dev-server.sh stop     - Stop all services
#   ./dev-server.sh status   - Check if services are running
#   ./dev-server.sh attach   - Attach to the tmux session

set -e

# Configuration
SESSION_NAME="quillbot-dev"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCODE_PORT=9090
NEXTJS_PORT=3000

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}ℹ ${1}${NC}"; }
log_success() { echo -e "${GREEN}✓ ${1}${NC}"; }
log_warn() { echo -e "${YELLOW}⚠ ${1}${NC}"; }
log_error() { echo -e "${RED}✗ ${1}${NC}"; }

# Helper: Check if port is listening
is_port_listening() {
    local port=$1
    nc -z localhost "$port" 2>/dev/null && return 0 || return 1
}

# Helper: Check if process is running by name
is_process_running() {
    local pattern=$1
    pgrep -f "$pattern" > /dev/null 2>&1 && return 0 || return 1
}

# Command: START
cmd_start() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║           QuillBot Development Server (Starting)            ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Check if session already exists
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        log_warn "Session '$SESSION_NAME' already exists"
        log_info "Use './dev-server.sh attach' to connect"
        return 0
    fi

    # Create new detached tmux session
    tmux new-session -d -s "$SESSION_NAME" -n "QuillBot"
    tmux split-window -h -t "$SESSION_NAME"

    # Left pane: OpenCode server
    tmux select-pane -t "$SESSION_NAME:0.0"
    tmux send-keys -t "$SESSION_NAME:0.0" "cd '$SCRIPT_DIR' && clear" C-m
    tmux send-keys -t "$SESSION_NAME:0.0" "echo -e '${BLUE}╔════════════════════════════════════════╗${NC}'" C-m
    tmux send-keys -t "$SESSION_NAME:0.0" "echo -e '${BLUE}║    OpenCode Server (Port 9090)        ║${NC}'" C-m
    tmux send-keys -t "$SESSION_NAME:0.0" "echo -e '${BLUE}╚════════════════════════════════════════╝${NC}'" C-m
    tmux send-keys -t "$SESSION_NAME:0.0" "echo ''" C-m
    
    # Run OpenCode with config
    tmux send-keys -t "$SESSION_NAME:0.0" "export XDG_CONFIG_HOME='$SCRIPT_DIR/opencode-config' && cd '$SCRIPT_DIR/data/projects' && opencode serve --port 9090 --hostname 0.0.0.0 --log-level INFO --print-logs" C-m

    # Right pane: Next.js dev server
    tmux select-pane -t "$SESSION_NAME:0.1"
    tmux send-keys -t "$SESSION_NAME:0.1" "cd '$SCRIPT_DIR' && clear" C-m
    tmux send-keys -t "$SESSION_NAME:0.1" "echo -e '${GREEN}╔════════════════════════════════════════╗${NC}'" C-m
    tmux send-keys -t "$SESSION_NAME:0.1" "echo -e '${GREEN}║   Next.js Dev Server (Port 3000)      ║${NC}'" C-m
    tmux send-keys -t "$SESSION_NAME:0.1" "echo -e '${GREEN}╚════════════════════════════════════════╝${NC}'" C-m
    tmux send-keys -t "$SESSION_NAME:0.1" "echo ''" C-m
    tmux send-keys -t "$SESSION_NAME:0.1" "sleep 3 && npm run dev" C-m

    # Set pane titles
    tmux set -t "$SESSION_NAME" pane-border-status top 2>/dev/null || true
    tmux set -t "$SESSION_NAME" pane-border-format "#{pane_index}: #{pane_title}" 2>/dev/null || true
    tmux select-pane -t "$SESSION_NAME:0.0" -T "OpenCode (9090)"
    tmux select-pane -t "$SESSION_NAME:0.1" -T "Next.js (3000)"

    log_success "Development environment started (detached)"
    echo ""
    echo -e "${CYAN}Session: ${SESSION_NAME}${NC}"
    echo -e "${CYAN}Web UI:${NC}       http://localhost:3000"
    echo -e "${CYAN}OpenCode API:${NC}  http://localhost:9090"
    echo ""
    echo -e "${CYAN}Useful commands:${NC}"
    echo "  ./dev-server.sh attach   - Attach to session"
    echo "  ./dev-server.sh status   - Check services"
    echo "  ./dev-server.sh stop     - Stop all servers"
    echo ""
    echo -e "${CYAN}tmux shortcuts:${NC}"
    echo "  Ctrl+b then ←/→          - Switch panes"
    echo "  Ctrl+b then z            - Zoom pane"
    echo "  Ctrl+b then d            - Detach session"
    echo ""
}

# Command: STOP
cmd_stop() {
    echo ""
    log_info "Stopping development environment..."
    
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        tmux kill-session -t "$SESSION_NAME"
        log_success "Session stopped"
    else
        log_warn "Session not running"
    fi
    echo ""
}

# Command: STATUS
cmd_status() {
    echo ""
    echo -e "${BLUE}Development Environment Status${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Check tmux session
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        log_success "tmux session '$SESSION_NAME' is running"
    else
        log_error "tmux session '$SESSION_NAME' is NOT running"
        echo ""
        return 1
    fi
    
    # Check OpenCode
    echo ""
    echo -e "${CYAN}OpenCode Server (Port $OPENCODE_PORT):${NC}"
    if is_port_listening $OPENCODE_PORT; then
        log_success "Port $OPENCODE_PORT is listening"
    else
        log_error "Port $OPENCODE_PORT is NOT listening"
    fi
    
    # Check Next.js
    echo ""
    echo -e "${CYAN}Next.js Dev Server (Port $NEXTJS_PORT):${NC}"
    if is_port_listening $NEXTJS_PORT; then
        log_success "Port $NEXTJS_PORT is listening"
    else
        log_error "Port $NEXTJS_PORT is NOT listening"
    fi
    
    echo ""
}

# Command: ATTACH
cmd_attach() {
    if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        log_error "Session '$SESSION_NAME' is not running"
        log_info "Start it with: ./dev-server.sh start"
        exit 1
    fi
    
    tmux attach-session -t "$SESSION_NAME"
}

# Main dispatcher
case "${1:-}" in
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    status)
        cmd_status
        ;;
    attach)
        cmd_attach
        ;;
    *)
        echo ""
        echo -e "${BLUE}QuillBot Development Server Manager${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Usage: ./dev-server.sh <command>"
        echo ""
        echo "Commands:"
        echo "  ${GREEN}start${NC}   - Start OpenCode + Next.js (detached tmux session)"
        echo "  ${GREEN}stop${NC}    - Stop all services"
        echo "  ${GREEN}status${NC}  - Check if services are running"
        echo "  ${GREEN}attach${NC}  - Attach to tmux session"
        echo ""
        exit 1
        ;;
esac
