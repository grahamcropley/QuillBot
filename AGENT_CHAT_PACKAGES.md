# AgentChat Workspace Packages

QuillBot consumes AgentChat as internal workspace packages under `packages/*`.

## Package Layout

- `packages/react` -> `@agent-chat/react`
- `packages/server-core` -> `@agent-chat/server-core`
- `packages/server-next` -> `@agent-chat/server-next`

## Dependency Wiring

Root `package.json` uses:

```json
{
  "dependencies": {
    "@agent-chat/react": "workspace:*",
    "@agent-chat/server-core": "workspace:*",
    "@agent-chat/server-next": "workspace:*"
  }
}
```

`packages/server-next/package.json` depends on `@agent-chat/server-core` via `workspace:*`.

## Maintenance Workflow

`packages/*` is the source of truth for AgentChat packages in this repository.

- Make package changes directly in:
  - `packages/react`
  - `packages/server-core`
  - `packages/server-next`
- Run `pnpm install` when dependency metadata changes.
- Validate with `pnpm typecheck`, `pnpm build`, and `./verify-pipeline.sh`.

## Verification

```bash
./verify-pipeline.sh
```

This checks workspace config, lockfiles, package linkage, and package resolution.

## Common Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm typecheck
pnpm test
```
