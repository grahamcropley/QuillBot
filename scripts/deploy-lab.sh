#!/bin/bash

# Deploy QuillBot stack to docker.lan
#
# Usage:
#   ./scripts/deploy-lab.sh          - Full deploy (sync config + build + up)
#   ./scripts/deploy-lab.sh up       - Just bring the stack up (no sync/build)
#   ./scripts/deploy-lab.sh down     - Tear down the stack
#   ./scripts/deploy-lab.sh logs     - Tail container logs
#   ./scripts/deploy-lab.sh status   - Show running containers

set -euo pipefail

REMOTE_HOST="docker.lan"
REMOTE_BASE="/var/opt/quillbot"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}ℹ ${1}${NC}"; }
log_success() { echo -e "${GREEN}✓ ${1}${NC}"; }
log_error()   { echo -e "${RED}✗ ${1}${NC}"; }

export DOCKER_HOST="ssh://$REMOTE_HOST"

ensure_remote_dirs() {
  log_info "Ensuring remote directories exist..."
  ssh "$REMOTE_HOST" "mkdir -p $REMOTE_BASE/{data,opencode-config,opencode-state}"
  log_success "Remote directories ready"
}

sync_config() {
  log_info "Syncing opencode config to $REMOTE_HOST:$REMOTE_BASE/opencode-config/"
  rsync -avz --delete \
    "$PROJECT_ROOT/opencode-config/.config/opencode/" \
    "$REMOTE_HOST:$REMOTE_BASE/opencode-config/"
  log_success "Config synced"
}

load_env() {
  log_info "Loading lab environment variables..."
  
  local env_files=(
    "$PROJECT_ROOT/.env.opencode.lab"
    "$PROJECT_ROOT/.env.web.lab"
  )
  
  for env_file in "${env_files[@]}"; do
    if [ -f "$env_file" ]; then
      log_info "  - $(basename "$env_file")"
      while IFS= read -r line || [ -n "$line" ]; do
        line="${line%%#*}"
        line="${line#"${line%%[![:space:]]*}"}"
        line="${line%"${line##*[![:space:]]}"}"
        if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
          export "$line"
        fi
      done < "$env_file"
    else
      log_error "Missing: $env_file"
      exit 1
    fi
  done
  
  log_success "Environment loaded"
}

cmd_deploy() {
  echo ""
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║          Deploying QuillBot to docker.lan                  ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  load_env
  ensure_remote_dirs
  sync_config

   log_info "Building and starting containers on $REMOTE_HOST..."
   docker compose -f "$COMPOSE_FILE" --env-file "$PROJECT_ROOT/.env.opencode.lab" --env-file "$PROJECT_ROOT/.env.web.lab" up --build -d

  echo ""
  log_success "Deployment complete"
  echo ""
  echo -e "${CYAN}Services:${NC}"
  echo "  Web UI:       http://quillbot-lab.cropley.info"
  echo "  OpenCode API: http://$REMOTE_HOST:9090"
  echo ""
  echo -e "${CYAN}Commands:${NC}"
  echo "  ./scripts/deploy-lab.sh logs     - Tail logs"
  echo "  ./scripts/deploy-lab.sh status   - Container status"
  echo "  ./scripts/deploy-lab.sh down     - Tear down"
  echo ""
}

cmd_up() {
   load_env
   log_info "Starting stack on $REMOTE_HOST..."
   docker compose -f "$COMPOSE_FILE" --env-file "$PROJECT_ROOT/.env.opencode.lab" --env-file "$PROJECT_ROOT/.env.web.lab" up -d
   log_success "Stack started"
}

cmd_down() {
   log_info "Tearing down stack on $REMOTE_HOST..."
   docker compose -f "$COMPOSE_FILE" --env-file "$PROJECT_ROOT/.env.opencode.lab" --env-file "$PROJECT_ROOT/.env.web.lab" down
   log_success "Stack stopped"
}

cmd_logs() {
   docker compose -f "$COMPOSE_FILE" --env-file "$PROJECT_ROOT/.env.opencode.lab" --env-file "$PROJECT_ROOT/.env.web.lab" logs -f
}

cmd_status() {
   docker compose -f "$COMPOSE_FILE" --env-file "$PROJECT_ROOT/.env.opencode.lab" --env-file "$PROJECT_ROOT/.env.web.lab" ps
}

case "${1:-}" in
  up)
    cmd_up
    ;;
  down)
    cmd_down
    ;;
  logs)
    cmd_logs
    ;;
  status)
    cmd_status
    ;;
  ""|deploy)
    cmd_deploy
    ;;
  *)
    echo ""
    echo -e "${BLUE}QuillBot Lab Deployment${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Usage: ./scripts/deploy-lab.sh [command]"
    echo ""
    echo "Commands:"
    echo "  ${GREEN}deploy${NC}  - Full deploy: sync config, build, start (default)"
    echo "  ${GREEN}up${NC}      - Start stack without rebuilding"
    echo "  ${GREEN}down${NC}    - Tear down stack"
    echo "  ${GREEN}logs${NC}    - Tail container logs"
    echo "  ${GREEN}status${NC}  - Show container status"
    echo ""
    exit 1
    ;;
esac
