#!/bin/bash

# QuillBot Development Server Manager
# Unified script for starting, stopping, and monitoring the development environment
# 
# Usage:
#   ./dev-server.sh start           - Start OpenCode + Next.js in separate tmux sessions
#   ./dev-server.sh stop            - Stop all services
#   ./dev-server.sh status          - Check if services are running
#   ./dev-server.sh attach opencode - Attach to OpenCode tmux session
#   ./dev-server.sh attach web      - Attach to Next.js tmux session

set -e

# Configuration
OPENCODE_SESSION="quillbot-opencode"
NEXTJS_SESSION="quillbot-web"
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

    # Start OpenCode session if not already running
    if ! tmux has-session -t "$OPENCODE_SESSION" 2>/dev/null; then
        tmux new-session -d -s "$OPENCODE_SESSION" -n "OpenCode"
        tmux send-keys -t "$OPENCODE_SESSION" "cd '$SCRIPT_DIR' && clear" C-m
        tmux send-keys -t "$OPENCODE_SESSION" "echo -e '${BLUE}╔════════════════════════════════════════╗${NC}'" C-m
        tmux send-keys -t "$OPENCODE_SESSION" "echo -e '${BLUE}║    OpenCode Server (Port 9090)        ║${NC}'" C-m
        tmux send-keys -t "$OPENCODE_SESSION" "echo -e '${BLUE}╚════════════════════════════════════════╝${NC}'" C-m
        tmux send-keys -t "$OPENCODE_SESSION" "echo ''" C-m
        tmux send-keys -t "$OPENCODE_SESSION" "export XDG_CONFIG_HOME='$SCRIPT_DIR/opencode-config' && cd '$SCRIPT_DIR/data/projects' && opencode serve --port 9090 --hostname 0.0.0.0 --log-level INFO --print-logs" C-m
        log_success "OpenCode session started"
    else
        log_warn "OpenCode session already running"
    fi

    # Start Next.js session if not already running
    if ! tmux has-session -t "$NEXTJS_SESSION" 2>/dev/null; then
        sleep 1
        tmux new-session -d -s "$NEXTJS_SESSION" -n "Web"
        tmux send-keys -t "$NEXTJS_SESSION" "cd '$SCRIPT_DIR' && clear" C-m
        tmux send-keys -t "$NEXTJS_SESSION" "echo -e '${GREEN}╔════════════════════════════════════════╗${NC}'" C-m
        tmux send-keys -t "$NEXTJS_SESSION" "echo -e '${GREEN}║   Next.js Dev Server (Port 3000)      ║${NC}'" C-m
        tmux send-keys -t "$NEXTJS_SESSION" "echo -e '${GREEN}╚════════════════════════════════════════╝${NC}'" C-m
        tmux send-keys -t "$NEXTJS_SESSION" "echo ''" C-m
        tmux send-keys -t "$NEXTJS_SESSION" "sleep 2 && npm run dev" C-m
        log_success "Next.js session started"
    else
        log_warn "Next.js session already running"
    fi

    echo ""
    echo -e "${CYAN}Sessions:${NC}"
    echo -e "  OpenCode:   ${OPENCODE_SESSION}"
    echo -e "  Next.js:    ${NEXTJS_SESSION}"
    echo ""
    echo -e "${CYAN}URLs:${NC}"
    echo "  Web UI:       http://localhost:3000"
    echo "  OpenCode API: http://localhost:9090"
    echo ""
    echo -e "${CYAN}Attach to sessions:${NC}"
    echo "  ./dev-server.sh attach opencode"
    echo "  ./dev-server.sh attach web"
    echo ""
    echo -e "${CYAN}Other commands:${NC}"
    echo "  ./dev-server.sh status   - Check services"
    echo "  ./dev-server.sh stop     - Stop all servers"
    echo ""
}

# Command: STOP
cmd_stop() {
    echo ""
    log_info "Stopping development environment..."
    
    if tmux has-session -t "$OPENCODE_SESSION" 2>/dev/null; then
        tmux kill-session -t "$OPENCODE_SESSION"
        log_success "OpenCode session stopped"
    fi
    
    if tmux has-session -t "$NEXTJS_SESSION" 2>/dev/null; then
        tmux kill-session -t "$NEXTJS_SESSION"
        log_success "Next.js session stopped"
    fi
    
    if ! tmux has-session -t "$OPENCODE_SESSION" 2>/dev/null && ! tmux has-session -t "$NEXTJS_SESSION" 2>/dev/null; then
        log_success "All services stopped"
    fi
    echo ""
}

# Command: STATUS
cmd_status() {
    echo ""
    echo -e "${BLUE}Development Environment Status${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    echo ""
    echo -e "${CYAN}OpenCode Session:${NC}"
    if tmux has-session -t "$OPENCODE_SESSION" 2>/dev/null; then
        log_success "Session running"
        if is_port_listening $OPENCODE_PORT; then
            log_success "Port $OPENCODE_PORT listening"
        else
            log_warn "Port $OPENCODE_PORT not listening yet"
        fi
    else
        log_error "Session NOT running"
    fi
    
    echo ""
    echo -e "${CYAN}Next.js Session:${NC}"
    if tmux has-session -t "$NEXTJS_SESSION" 2>/dev/null; then
        log_success "Session running"
        if is_port_listening $NEXTJS_PORT; then
            log_success "Port $NEXTJS_PORT listening"
        else
            log_warn "Port $NEXTJS_PORT not listening yet"
        fi
    else
        log_error "Session NOT running"
    fi
    
    echo ""
}

# Command: ATTACH
cmd_attach() {
    local target_session="${1:-}"
    
    if [ -z "$target_session" ]; then
        log_error "Please specify which session to attach to"
        echo ""
        echo "Usage: ./dev-server.sh attach <opencode|web>"
        echo ""
        exit 1
    fi
    
    case "$target_session" in
        opencode)
            if ! tmux has-session -t "$OPENCODE_SESSION" 2>/dev/null; then
                log_error "OpenCode session is not running"
                log_info "Start it with: ./dev-server.sh start"
                exit 1
            fi
            tmux attach-session -t "$OPENCODE_SESSION"
            ;;
        web)
            if ! tmux has-session -t "$NEXTJS_SESSION" 2>/dev/null; then
                log_error "Next.js session is not running"
                log_info "Start it with: ./dev-server.sh start"
                exit 1
            fi
            tmux attach-session -t "$NEXTJS_SESSION"
            ;;
        *)
            log_error "Unknown session: $target_session"
            echo ""
            echo "Usage: ./dev-server.sh attach <opencode|web>"
            echo ""
            exit 1
            ;;
    esac
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
        cmd_attach "$2"
        ;;
    *)
        echo ""
        echo -e "${BLUE}QuillBot Development Server Manager${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Usage: ./dev-server.sh <command> [options]"
        echo ""
        echo "Commands:"
        echo "  ${GREEN}start${NC}                  - Start OpenCode + Next.js (separate full-screen sessions)"
        echo "  ${GREEN}stop${NC}                   - Stop all services"
        echo "  ${GREEN}status${NC}                 - Check if services are running"
        echo "  ${GREEN}attach opencode${NC}        - Attach to OpenCode session"
        echo "  ${GREEN}attach web${NC}             - Attach to Next.js session"
        echo ""
        exit 1
        ;;
esac
