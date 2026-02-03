# OpenCode Config (Local)

Place isolated OpenCode config files here for container use.

Typical files:

- auth.json
- config.json

This folder is bind-mounted into the OpenCode container at
`/app/.config/opencode` via `docker-compose.yml`.
