# @agent-chat/server-core

Framework-agnostic server core for AgentChat.

This package provides:

- OpenCode SDK client setup
- in-memory session/message/question store
- session pub/sub for SSE fan-out
- OpenCode event subscription and state synchronization

It is intended to be consumed by framework adapters such as `@agent-chat/server-next`.

## Install

```bash
pnpm add @agent-chat/server-core
```

## Environment

- `OPENCODE_API_URL` (optional): defaults to `http://localhost:9090`
- `OPENCODE_SERVER_USERNAME` (optional): HTTP Basic Auth username
- `OPENCODE_SERVER_PASSWORD` (optional): HTTP Basic Auth password

When both `OPENCODE_SERVER_USERNAME` and `OPENCODE_SERVER_PASSWORD` are set, the client will automatically add HTTP Basic Authentication headers to all requests.

## Basic usage (adapter authors)

```ts
import {
  opencode,
  ensureEventListener,
  trackSession,
  subscribe,
  getMessages,
  getSessionStatus,
} from "@agent-chat/server-core";
```

Most apps should consume this package indirectly through `@agent-chat/server-next`.
