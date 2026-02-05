#!/bin/bash
cd /home/graham/github/QuillBot
clear
printf "\033[0;34m╔════════════════════════════════════════╗\033[0m\n"
printf "\033[0;34m║     OpenCode Server (Port 9090)        ║\033[0m\n"
printf "\033[0;34m╚════════════════════════════════════════╝\033[0m\n\n"
export XDG_CONFIG_HOME=/home/graham/github/QuillBot/opencode-config
cd /home/graham/github/QuillBot/data/projects
exec opencode serve --port 9090 --hostname 0.0.0.0 --log-level INFO --print-logs
