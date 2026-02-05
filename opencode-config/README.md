# OpenCode Config (Local)

Place isolated OpenCode config files here for container use.

Typical files:

- `auth.json` - Provider authentication credentials
- `opencode.json` - OpenCode configuration, including models, tools, permissions, and agents

This folder is bind-mounted into the OpenCode container at
`/app/.config/opencode` via `docker-compose.yml`.

## Agents

### QuillBot Agent

The **QuillBot** agent is configured as a primary agent specialized for content authoring workflows.

**Capabilities:**

- ✅ File operations: read, write, edit, apply_patch
- ✅ Research: question, websearch, webfetch
- ❌ System commands: bash (denied)
- ❌ Task delegation: delegate, todo (not available)
- ❌ Language Server: lsp (disabled)

**Model:** `github-copilot/gpt-5.2`

**Configuration:** Defined in `opencode.json` under `agent.quillbot`

This agent is designed to assist with the QuillBot content creation platform, focusing on:

- Creating and editing markdown content
- Researching and gathering information via web search
- Modifying existing documents with patches
- Keeping all changes within the project's file system
