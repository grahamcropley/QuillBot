# OpenCode “Non-Message Activities” Cheat Sheet (SSE + Tools)

> Repo-grounded notes for this QuillBot integration. Sources: `src/app/api/opencode/message/route.ts`, `src/hooks/use-opencode-stream.ts`, `src/types/opencode-events.ts`, and captured samples `opencode-stream-sample.*`.

## SSE wire format (as used by this app)

**Response headers**

```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

**Body format**

Each event is sent as:

```text
data: {"type":"status", ...}

```

Notes:

- This client reads `data:` lines only (no `event:` field).
- Events are stamped with a monotonically increasing `seq` in the API proxy.

## App-level SSE event types

Defined in: `src/types/opencode-events.ts`

- `part` — streaming assistant content + tool parts
- `question` — interactive questions (UI must answer)
- `status` — progress/status messages
- `file.edited` — file write/edit notifications
- `activity` — non-chat activities (TUI/MCP/permission/todo/etc.)
- `error` — terminal error
- `done` — stream completed

## Tool calls (function calling)

Where it appears:

- SDK emits tool activity via repeated `message.part.updated` events.
- In this app, those are transformed into `type: "part"` events whose payload includes a `part` with `type: "tool"`.

**Lifecycle** (same `part.id` / tool call progresses over time):

`pending → running → completed | error`

**What to render**

- While `pending/running`: show tool name + input.
- On `completed`: show output.
- On `error`: show error and allow retry.

**Known gotcha (observed in sample streams)**

- The `write` tool can fail with a “read-before-write” rule (e.g., “You must read file … before overwriting it. Use the Read tool first”).
- Recovery pattern: call `read`, then retry `write`.

## Questions (non-message interrupt)

Where it appears:

- SDK emits `question.asked` events.
- App forwards these as `type: "question"`.

Reply API:

- `POST /api/opencode/question` → internally calls `client.question.reply({ requestID, directory, answers })`.

UI behavior:

- The stream may continue to send events, but the UI suppresses normal assistant text rendering while awaiting the question answer (see `src/hooks/use-opencode-stream.ts`).

## Buffering + resume

Why:

- Protects against browser SSE disconnects.

Endpoints:

- `GET /api/opencode/buffer?sessionId=...&lastEventIndex=...` returns buffered events + `isComplete`.
- `GET /api/opencode/buffer?clear=true&sessionId=...` clears buffer after completion.

## Abort

Endpoint:

- `POST /api/opencode/abort` → calls `client.session.abort({ sessionID, directory })`.

Notes:

- Use this for true server-side cancellation; browser `AbortController` alone may only stop receiving.

## Primary docs (official)

- Tools: https://opencode.ai/docs/tools
- Commands: https://opencode.ai/docs/commands
- SDK: https://opencode.ai/docs/sdk
- Config schema: https://opencode.ai/config.json
