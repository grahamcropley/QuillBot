#!/bin/bash
cd /home/graham/github/QuillBot
clear
printf "\033[0;32m╔════════════════════════════════════════╗\033[0m\n"
printf "\033[0;32m║    Next.js Dev Server (Port 3000)      ║\033[0m\n"
printf "\033[0;32m╚════════════════════════════════════════╝\033[0m\n\n"
if [ -f "/home/graham/github/QuillBot/.env.local" ]; then
  export $(grep -v '^#' /home/graham/github/QuillBot/.env.local | xargs)
fi
sleep 2
exec npm run dev
