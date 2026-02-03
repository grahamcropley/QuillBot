# Draft: OpenCode API Integration Refactoring

## Requirements (confirmed)

- Rewrite OpenCode API integration for real-time streaming
- Backend APIs must be robust and complete
- Use SSE streaming for all real-time updates
- Messages, questions, tools, and status reflected in real-time in frontend
- Handle all async operations properly

## Research Findings

### SDK Capabilities Discovered

**The SDK has REAL SSE streaming support** (critical finding):

1. **`client.event.subscribe()`** - Returns `ServerSentEventsResult<EventSubscribeResponses>` which is an async generator for SSE events
2. **Event Types** - Full typed event system with:
   - `message.updated` - Message state changes
   - `message.part.updated` - Real-time part streaming (text, tool, reasoning, etc.)
   - `session.status` - Session state (idle, busy, retry)
   - `question.asked` / `question.replied` - Question handling
   - `session.error` - Error events
   - `todo.updated` - Todo list updates
   - etc.

3. **Part Types** - Rich part types already defined:
   - `TextPart` - Text content with delta streaming
   - `ToolPart` - Tool calls with state (pending, running, completed, error)
   - `ReasoningPart` - Thinking/reasoning content
   - `FilePart` - File attachments
   - `AgentPart` - Agent delegation

4. **Session Methods**:
   - `session.prompt()` - Synchronous prompt (current usage - blocks until complete)
   - `session.promptAsync()` - Async prompt (returns immediately, use events for updates)
   - `session.abort()` - Cancel active session

### Current Implementation Issues (confirmed)

1. **Not using event subscription** - Current code uses `session.prompt()` which waits for full response
2. **Fake streaming** - SSE is simulated by chunking the final result
3. **No abort capability** - `session.abort()` is available but not used
4. **Question detection is fragile** - Parsing tool inputs instead of using `question.asked` events
5. **Missing tool state tracking** - SDK provides pending/running/completed states but not used
6. **No reconnection logic** - SDK has retry options but not configured

### Recommended Architecture

**Backend Pattern**:

1. Use `session.promptAsync()` to initiate the prompt (returns immediately)
2. Use `client.event.subscribe()` to stream events
3. Forward events to frontend via SSE
4. Handle `session.abort()` on client disconnect

**Event Flow**:

```
Frontend (SSE client)
    ↓ POST /api/opencode/message (initial request)
Backend creates SSE stream
    ↓ session.promptAsync()
Backend subscribes to client.event.subscribe()
    ↓ Events stream from OpenCode
Backend forwards events via SSE
    ↓
Frontend receives typed events in real-time
```

## Technical Decisions

- Use SDK's native SSE streaming via `event.subscribe()`
- Use `promptAsync()` instead of `prompt()` for non-blocking
- Use existing SDK event types (no custom types needed)
- Forward SDK events directly to frontend with minimal transformation

## Decisions Made (with defaults applied)

1. **Backpressure handling**: Buffer up to 100 events; drop oldest if buffer full (reasonable default for web clients)
2. **Session scope filtering**: Filter events by `sessionID` in the event payload - SDK events include sessionID
3. **Connection lifecycle**: **Per-message connection** - simpler implementation, aligns with current architecture. Can evolve to persistent later.
4. **Question flow**: Question answers trigger continuation via existing session - no new stream needed (SDK handles via `question.reply`)
5. **Error recovery**: **Manual retry with UI indicator** - show error state, user clicks to retry. Simpler UX, avoids infinite loops.
6. **Test strategy**: **Integration tests** - mock OpenCode SDK responses, test hooks and API routes together. Uses existing Vitest setup.

## Scope Boundaries

### INCLUDE

- Backend API route refactoring (`/api/opencode/message`, `/api/opencode/question`)
- Frontend streaming hook (`use-opencode-stream.ts`)
- Types alignment with SDK types
- Status/tool display components
- Abort capability
- Error handling improvements

### EXCLUDE (to clarify)

- Project storage changes
- Authentication/authorization changes
- UI layout changes
- Document sync (file watching)
- Export functionality
