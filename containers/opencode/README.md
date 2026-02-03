# OpenCode Container

This project uses a prebuilt OpenCode image by default (see
`docker-compose.yml`). If you later decide to build a custom image, this
folder is the place for a Dockerfile and build assets.

Runtime mounts used by the compose stack:

- `./opencode-config` -> `/app/.config/opencode`
- `./.opencode` -> `/app/.opencode` (read-only, custom commands)
- `./AGENTS.md` -> `/app/AGENTS.md` (read-only)
- `./data` -> `/app/data`
