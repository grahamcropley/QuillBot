#!/bin/bash
clear
printf "\033[0;34m╔════════════════════════════════════════╗\033[0m\n"
printf "\033[0;34m║     OpenCode Server (Port 9090)        ║\033[0m\n"
printf "\033[0;34m╚════════════════════════════════════════╝\033[0m\n\n"

cd /home/graham/github/QuillBot/data/projects
export OPENCODE_API_URL=http://localhost:9090
export XDG_DATA_HOME=/home/graham/github/QuillBot/opencode-config/.local/share
export XDG_CONFIG_HOME=/home/graham/github/QuillBot/opencode-config
export OPENCODE_ENABLE_EXA=1

# Load environment variables from .env.local (takes precedence)
if [ -f "/home/graham/github/QuillBot/.env.local" ]; then
  export $(grep -v '^#' /home/graham/github/QuillBot/.env.local | xargs)
fi

# Load environment variables from .env (fallback)
if [ -f "/home/graham/github/QuillBot/.env" ]; then
  export $(grep -v '^#' /home/graham/github/QuillBot/.env | xargs)
fi

opencode serve --port 9090 --hostname 0.0.0.0 --log-level DEBUG --print-logs
