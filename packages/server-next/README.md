# @agent-chat/server-next

Next.js App Router adapter for AgentChat backend APIs.

This package exposes a route-handler factory that you mount in your `app/api` tree.

## Install

```bash
pnpm add @agent-chat/server-next @agent-chat/server-core
```

## Mount handlers in Next.js

Create route files that re-export handlers from the factory.

`app/api/sessions/route.ts`

```ts
import { createAgentChatNextHandlers } from "@agent-chat/server-next";

const handlers = createAgentChatNextHandlers();

export const GET = handlers.sessions.GET;
export const POST = handlers.sessions.POST;
```

`app/api/sessions/[sessionId]/messages/route.ts`

```ts
import { createAgentChatNextHandlers } from "@agent-chat/server-next";

const handlers = createAgentChatNextHandlers();

export const GET = handlers.messages.GET;
export const POST = handlers.messages.POST;
```

`app/api/sessions/[sessionId]/events/route.ts`

```ts
import { createAgentChatNextHandlers } from "@agent-chat/server-next";

const handlers = createAgentChatNextHandlers();

export const GET = handlers.events.GET;
```

`app/api/questions/[requestId]/reply/route.ts`

```ts
import { createAgentChatNextHandlers } from "@agent-chat/server-next";

const handlers = createAgentChatNextHandlers();

export const POST = handlers.questions.reply.POST;
```

`app/api/questions/[requestId]/reject/route.ts`

```ts
import { createAgentChatNextHandlers } from "@agent-chat/server-next";

const handlers = createAgentChatNextHandlers();

export const POST = handlers.questions.reject.POST;
```

## Coexisting with your other APIs

These handlers only occupy the routes you wire. Keep your other API routes unchanged in parallel under `app/api/**`.

Example:

- `app/api/billing/route.ts` (your existing API)
- `app/api/sessions/route.ts` (AgentChat API)

No global middleware or API router replacement is required.

## Additional Context

The backend handles "Additional Context" automatically. When a host app sends context items, they arrive as `contextParts` in the `POST /api/sessions/:id/messages` request body.

### Data Flow

1. **Prompt Enrichment**: The backend appends each context item as a separate text part to the OpenCode prompt using the format: `--- {label} ---\n{content}`.
2. **Display Overrides**: To keep the chat history clean, the backend stores a "display override" for the message. This tells the frontend to display only the user-typed text, not the appended context blocks.
3. **SSE Synchronization**: Display overrides are synchronized via SSE (snapshot and messages events), ensuring the correct UI state survives page refreshes or reconnections.

No additional configuration is required. The `createAgentChatNextHandlers()` factory includes all necessary logic to process context and manage display state.
