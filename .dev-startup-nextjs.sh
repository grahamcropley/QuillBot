#!/bin/bash
cd /home/graham/github/QuillBot
clear
printf "\033[0;32m╔════════════════════════════════════════╗\033[0m\n"
printf "\033[0;32m║   Next.js Dev Server (Port 3000)      ║\033[0m\n"
printf "\033[0;32m╚════════════════════════════════════════╝\033[0m\n\n"
sleep 2
exec npm run dev
