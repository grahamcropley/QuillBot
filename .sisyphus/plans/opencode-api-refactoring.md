# OpenCode API Integration Refactoring

## TL;DR

> **Quick Summary**: Refactor the OpenCode API integration to use the SDK's native SSE streaming via `client.event.subscribe()` and `session.promptAsync()`, replacing the current blocking `session.prompt()` implementation that simulates streaming.
>
> **Deliverables**:
>
> - New SSE event types aligned with SDK (`src/types/opencode-events.ts`)
> - Refactored message API route with true streaming (`src/app/api/opencode/message/route.ts`)
> - Abort capability endpoint (`src/app/api/opencode/abort/route.ts`)
> - Refactored frontend streaming hook (`src/hooks/use-opencode-stream.ts`)
> - Updated UI components for rich tool/status display
>
> **Estimated Effort**: Medium (3-5 days)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 4 → Task 5

---

## Context

### Original Request

Refactor the OpenCode API integration to:

- Provide robust backend APIs for OpenCode communication
- Use SSE streaming for all real-time updates
- Ensure messages, questions, tools, and status are reflected in real-time in the frontend
- Handle all async operations properly

### Interview Summary

**Key Discussions**:

- Current implementation uses `session.prompt()` which blocks until completion, then simulates streaming
- SDK has native SSE via `client.event.subscribe()` that returns an async generator
- `session.promptAsync()` returns immediately, allowing event-based updates
- Question detection currently parses tool inputs instead of using `question.asked` events
- Tool states (pending → running → completed/error) are not tracked

**Research Findings**:

- SDK exports all necessary event types (`EventMessagePartUpdated`, `EventQuestionAsked`, `EventSessionStatus`, etc.)
- `ToolPart` has `state: ToolState` with `status: "pending" | "running" | "completed" | "error"`
- `EventMessagePartUpdated` includes `delta?: string` for incremental text streaming
- `SessionStatus` can be `idle`, `busy`, or `retry` with attempt info
- SDK `session.abort()` can cancel active prompts

### Metis Review (Self-Applied)

**Identified Gaps** (addressed):

- Backpressure handling → Buffer 100 events, drop oldest if full
- Session filtering → Filter by sessionID in event payload (SDK events include sessionID)
- Connection lifecycle → Per-message connection (simpler, can evolve later)
- Error recovery → Manual retry with UI indicator
- Test strategy → Integration tests with mocked SDK responses

---

## Work Objectives

### Core Objective

Replace the fake streaming implementation with true real-time SSE streaming using the OpenCode SDK's native event subscription, enabling real-time display of message parts, tool states, questions, and session status.

### Concrete Deliverables

- `src/types/opencode-events.ts` - New event types aligned with SDK
- `src/app/api/opencode/message/route.ts` - Refactored with `promptAsync()` + event forwarding
- `src/app/api/opencode/abort/route.ts` - New abort endpoint
- `src/hooks/use-opencode-stream.ts` - EventSource-based streaming
- `src/stores/project-store.ts` - Updated event handlers
- `src/components/conversation/status-line.tsx` - Rich tool state display

### Definition of Done

- [ ] `bun test` passes all tests
- [ ] Messages stream in real-time (visible character by character)
- [ ] Tool states display correctly (pending → running → completed/error)
- [ ] Questions appear via `question.asked` events (not tool input parsing)
- [ ] Session status (idle/busy/retry) reflected in UI
- [ ] Abort button cancels active requests

### Must Have

- True real-time streaming via SSE (not simulated)
- Proper event type alignment with SDK types
- Tool state machine display (pending → running → completed)
- Question detection via `question.asked` event
- Abort capability
- Error display with manual retry

### Must NOT Have (Guardrails)

- **NO persistent/long-lived SSE connections** - per-message lifecycle only
- **NO automatic retry loops** - manual retry via UI only
- **NO breaking changes to existing Message/Project types** - extend, don't replace
- **NO changes to project storage or file system operations**
- **NO authentication/authorization changes**
- **NO UI layout changes** - only component internals

---

## Verification Strategy

### Test Decision

- **Infrastructure exists**: YES (Vitest configured in project)
- **User wants tests**: Integration tests with mocked SDK
- **Framework**: Vitest + React Testing Library

### Verification Approach

Each TODO includes automated verification:

1. **Type checking**: `bun run typecheck` - zero errors
2. **Unit tests**: `bun test [file]` - tests pass
3. **Integration verification**: Curl commands or Playwright for E2E

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Create SSE event types [no dependencies]
└── Task 3: Create abort endpoint [no dependencies]

Wave 2 (After Wave 1):
├── Task 2: Refactor message route [depends: 1]
└── Task 4: Refactor streaming hook [depends: 1]

Wave 3 (After Wave 2):
├── Task 5: Update store with event handlers [depends: 2, 4]
└── Task 6: Update status-line component [depends: 5]

Wave 4 (After Wave 3):
└── Task 7: Integration tests [depends: all]

Critical Path: Task 1 → Task 2 → Task 5 → Task 7
Parallel Speedup: ~35% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
| ---- | ---------- | ------ | -------------------- |
| 1    | None       | 2, 4   | 3                    |
| 2    | 1          | 5      | 4                    |
| 3    | None       | 5      | 1                    |
| 4    | 1          | 5      | 2                    |
| 5    | 2, 4, 3    | 6, 7   | None                 |
| 6    | 5          | 7      | None                 |
| 7    | All        | None   | None                 |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents                                                                      |
| ---- | ----- | --------------------------------------------------------------------------------------- |
| 1    | 1, 3  | `delegate_task(category="quick", load_skills=[], run_in_background=true)` x2            |
| 2    | 2, 4  | `delegate_task(category="unspecified-high", load_skills=[], run_in_background=true)` x2 |
| 3    | 5, 6  | Sequential - state coordination needed                                                  |
| 4    | 7     | `delegate_task(category="unspecified-high", load_skills=[], run_in_background=false)`   |

---

## TODOs

- [ ] 1. Create SSE Event Types Aligned with SDK

  **What to do**:
  - Create `src/types/opencode-events.ts` with types that mirror SDK event types
  - Export discriminated union `OpenCodeEvent` covering all relevant events
  - Include: `message.part.updated`, `question.asked`, `question.replied`, `session.status`, `session.error`, `session.idle`
  - Re-export relevant SDK types (`Part`, `ToolState`, `SessionStatus`, `QuestionRequest`)
  - Add `StreamEvent` type for SSE wire format (what we send to frontend)

  **Must NOT do**:
  - Don't modify existing `src/types/index.ts` - create separate file
  - Don't duplicate SDK types - re-export them
  - Don't include TUI events or events not relevant to web client

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file creation, type definitions only, no complex logic
  - **Skills**: `[]`
    - No special skills needed for TypeScript type definitions
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Domain is types, not UI

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 3)
  - **Blocks**: Tasks 2, 4
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References** (existing code to follow):
  - `src/types/index.ts:74-91` - Existing type patterns (Result type, StreamChunk interface)

  **API/Type References** (contracts to implement against):
  - `node_modules/@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts:195-210` - `TextPart` structure with delta support
  - `node_modules/@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts:284-347` - `ToolState` discriminated union (pending/running/completed/error)
  - `node_modules/@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts:336-347` - `ToolPart` with state field
  - `node_modules/@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts:419-425` - `EventMessagePartUpdated` with delta
  - `node_modules/@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts:460-476` - `SessionStatus` (idle/busy/retry)
  - `node_modules/@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts:515-539` - `QuestionRequest`, `QuestionAnswer`, `EventQuestionAsked`
  - `node_modules/@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts:703-709` - `EventSessionError`

  **WHY Each Reference Matters**:
  - `types.gen.d.ts:284-347` - Understand the ToolState state machine for proper tool tracking
  - `types.gen.d.ts:419-425` - The `delta` field enables true incremental streaming
  - `types.gen.d.ts:515-539` - Question types to replace fragile tool-parsing approach

  **Acceptance Criteria**:
  - [ ] File created: `src/types/opencode-events.ts`
  - [ ] Type `OpenCodeEvent` is a discriminated union of relevant events
  - [ ] Type `StreamEvent` defined for SSE wire format
  - [ ] `bun run typecheck` → PASS (0 errors)

  **Automated Verification**:

  ```bash
  # Agent runs:
  bun run typecheck 2>&1 | tail -5
  # Assert: Output contains "0 errors" or exits with code 0

  # Verify file exists and exports expected types:
  bun -e "import { OpenCodeEvent, StreamEvent } from './src/types/opencode-events'; console.log('Types imported successfully')"
  # Assert: Output is "Types imported successfully"
  ```

  **Evidence to Capture:**
  - [ ] Terminal output from typecheck command
  - [ ] Terminal output from type import verification

  **Commit**: YES
  - Message: `feat(types): add SSE event types aligned with OpenCode SDK`
  - Files: `src/types/opencode-events.ts`
  - Pre-commit: `bun run typecheck`

---

- [ ] 2. Refactor Message API Route for True SSE Streaming

  **What to do**:
  - Refactor `src/app/api/opencode/message/route.ts` to use `session.promptAsync()` instead of `session.prompt()`
  - Subscribe to events via `client.event.subscribe()` (or `client.event.list()` if subscribe unavailable)
  - Filter events by `sessionID` matching the active session
  - Forward events to frontend via SSE in real-time
  - Handle connection close by calling `session.abort()` if request is still active
  - Add proper SSE headers including `X-Accel-Buffering: no` for nginx proxy compatibility

  **Must NOT do**:
  - Don't change the request body interface (sessionId, projectId, message, command)
  - Don't remove session creation logic
  - Don't implement automatic reconnection (keep it simple)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Core API refactoring with async streaming logic, requires careful error handling
  - **Skills**: `[]`
    - No special skills needed - standard Next.js API route work
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not browser work
    - `frontend-ui-ux`: Backend API route

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1 (needs event types)

  **References**:

  **Pattern References** (existing code to follow):
  - `src/app/api/opencode/message/route.ts:1-222` - Current implementation to refactor (understand existing session creation, error handling)

  **API/Type References** (contracts to implement against):
  - `src/types/opencode-events.ts` - StreamEvent type for SSE payloads (created in Task 1)
  - `src/lib/opencode-client.ts` - `getOpencodeClient()` function and SDK client usage
  - `node_modules/@opencode-ai/sdk/dist/v2/gen/sdk.gen.d.ts` - SDK methods: `session.promptAsync()`, `event.subscribe()`

  **Documentation References**:
  - Next.js streaming: Return `new Response(stream, { headers })` with ReadableStream

  **External References**:
  - SSE format: `data: ${JSON.stringify(event)}\n\n` per event

  **WHY Each Reference Matters**:
  - Current route.ts shows session creation logic to preserve
  - SDK types show exact method signatures for promptAsync and event subscription
  - StreamEvent type ensures consistent payload structure

  **Acceptance Criteria**:
  - [ ] Route uses `session.promptAsync()` instead of `session.prompt()`
  - [ ] Events streamed via `client.event.subscribe()` or `client.event.list()`
  - [ ] Events filtered by sessionID before forwarding
  - [ ] Response headers include `X-Accel-Buffering: no`
  - [ ] Connection close triggers abort if session is busy
  - [ ] `bun run typecheck` → PASS

  **Automated Verification**:

  ```bash
  # Agent runs:
  bun run typecheck 2>&1 | tail -5
  # Assert: Output contains "0 errors" or exits with code 0

  # Verify route exports POST function:
  bun -e "import { POST } from './src/app/api/opencode/message/route'; console.log(typeof POST)"
  # Assert: Output is "function"
  ```

  **Evidence to Capture:**
  - [ ] Terminal output from typecheck command
  - [ ] Terminal output from export verification

  **Commit**: YES
  - Message: `refactor(api): use SDK event streaming for real-time message updates`
  - Files: `src/app/api/opencode/message/route.ts`
  - Pre-commit: `bun run typecheck`

---

- [ ] 3. Create Abort Endpoint

  **What to do**:
  - Create `src/app/api/opencode/abort/route.ts`
  - Accept POST with `{ sessionId: string, projectId: string }`
  - Call `client.session.abort({ sessionID })` to cancel active request
  - Return success/error response

  **Must NOT do**:
  - Don't add abort to message route (keep endpoints focused)
  - Don't implement client-side abort logic here (that's Task 4)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple API endpoint, single SDK call, minimal logic
  - **Skills**: `[]`
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - None relevant

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 5
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References** (existing code to follow):
  - `src/app/api/opencode/question/route.ts` - Similar simple API pattern with SDK call

  **API/Type References** (contracts to implement against):
  - `src/lib/opencode-client.ts` - `getOpencodeClient()` usage
  - SDK method: `session.abort({ sessionID: string })`

  **WHY Each Reference Matters**:
  - question/route.ts shows pattern for simple SDK-calling API routes
  - SDK abort method is the core functionality

  **Acceptance Criteria**:
  - [ ] File created: `src/app/api/opencode/abort/route.ts`
  - [ ] POST handler accepts sessionId and projectId
  - [ ] Calls `client.session.abort()` with correct parameters
  - [ ] Returns JSON response indicating success/failure
  - [ ] `bun run typecheck` → PASS

  **Automated Verification**:

  ```bash
  # Agent runs:
  bun run typecheck 2>&1 | tail -5
  # Assert: Output contains "0 errors" or exits with code 0

  # Verify route exports POST function:
  bun -e "import { POST } from './src/app/api/opencode/abort/route'; console.log(typeof POST)"
  # Assert: Output is "function"
  ```

  **Evidence to Capture:**
  - [ ] Terminal output from typecheck command
  - [ ] Terminal output from export verification

  **Commit**: YES
  - Message: `feat(api): add abort endpoint for canceling active OpenCode requests`
  - Files: `src/app/api/opencode/abort/route.ts`
  - Pre-commit: `bun run typecheck`

---

- [ ] 4. Refactor Frontend Streaming Hook

  **What to do**:
  - Refactor `src/hooks/use-opencode-stream.ts` to use native EventSource
  - Parse SSE events matching `StreamEvent` type from Task 1
  - Add `abort()` function that calls `/api/opencode/abort`
  - Handle event types: `part`, `question`, `status`, `error`, `done`
  - Accumulate text content from `part` events with `delta` field
  - Update state for tool parts showing status progression
  - Add proper cleanup on unmount (close EventSource, abort if streaming)

  **Must NOT do**:
  - Don't change the hook's public interface signature
  - Don't implement reconnection logic
  - Don't store tool states in hook (that's the store's job in Task 5)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex React hook refactoring with event parsing and state management
  - **Skills**: `[]`
    - Standard React/TypeScript work
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: This is logic, not UI

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1 (needs event types)

  **References**:

  **Pattern References** (existing code to follow):
  - `src/hooks/use-opencode-stream.ts:1-178` - Current hook to refactor (understand callbacks, state, interface)

  **API/Type References** (contracts to implement against):
  - `src/types/opencode-events.ts` - `StreamEvent` type for parsing SSE data (Task 1)
  - `src/types/index.ts:85-91` - `StreamChunk` type (current interface to preserve)

  **External References**:
  - EventSource API: `new EventSource(url)`, `onmessage`, `onerror`, `close()`

  **WHY Each Reference Matters**:
  - Current hook shows the public interface that must be preserved
  - StreamEvent type defines what events to expect from backend
  - EventSource is the native browser SSE API to use

  **Acceptance Criteria**:
  - [ ] Uses `EventSource` instead of fetch streaming
  - [ ] Parses events matching `StreamEvent` type
  - [ ] Exposes `abort()` function
  - [ ] Properly closes EventSource on unmount
  - [ ] Accumulates text from delta events
  - [ ] Hook signature unchanged (no breaking changes to callers)
  - [ ] `bun run typecheck` → PASS

  **Automated Verification**:

  ```bash
  # Agent runs:
  bun run typecheck 2>&1 | tail -5
  # Assert: Output contains "0 errors" or exits with code 0

  # Verify hook exports expected interface:
  bun -e "
    import { useOpenCodeStream } from './src/hooks/use-opencode-stream';
    const fn = useOpenCodeStream.toString();
    console.log(fn.includes('sendMessage') ? 'Interface preserved' : 'Interface broken');
  "
  # Assert: Output is "Interface preserved"
  ```

  **Evidence to Capture:**
  - [ ] Terminal output from typecheck command
  - [ ] Terminal output from interface verification

  **Commit**: YES
  - Message: `refactor(hooks): use EventSource for native SSE streaming`
  - Files: `src/hooks/use-opencode-stream.ts`
  - Pre-commit: `bun run typecheck`

---

- [ ] 5. Update Store with Event Handlers

  **What to do**:
  - Update `src/stores/project-store.ts` to handle new event types
  - Add `currentToolStates: Map<string, ToolState>` to track active tools
  - Add `sessionStatus: 'idle' | 'busy' | 'retry'` state
  - Add `handleStreamEvent(event: StreamEvent)` action to process events
  - Update `addQuestion` to work with `question.asked` event format
  - Add `updateToolState(partId: string, state: ToolState)` action
  - Add `setSessionStatus(status: SessionStatus)` action

  **Must NOT do**:
  - Don't break existing store interface
  - Don't remove existing actions (addMessage, addQuestion, etc.)
  - Don't change project persistence logic

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: State management refactoring, needs to maintain backwards compatibility
  - **Skills**: `[]`
    - Standard Zustand/React work
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: This is state logic, not UI

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential)
  - **Blocks**: Tasks 6, 7
  - **Blocked By**: Tasks 2, 3, 4 (needs all event sources ready)

  **References**:

  **Pattern References** (existing code to follow):
  - `src/stores/project-store.ts:1-351` - Current store structure, existing actions to preserve
  - `src/stores/project-store.ts:198-246` - `addQuestion` pattern to adapt for event-based questions

  **API/Type References** (contracts to implement against):
  - `src/types/opencode-events.ts` - `StreamEvent`, `ToolState`, `SessionStatus` types (Task 1)
  - `src/types/index.ts:18-24` - `QuestionData` interface

  **WHY Each Reference Matters**:
  - Current store shows existing pattern and interface to preserve
  - Event types define what the new handlers need to process
  - QuestionData shows how to adapt SDK question events to existing format

  **Acceptance Criteria**:
  - [ ] `sessionStatus` state added
  - [ ] `currentToolStates` state added
  - [ ] `handleStreamEvent` action processes all StreamEvent types
  - [ ] `setSessionStatus` action added
  - [ ] `updateToolState` action added
  - [ ] Existing store interface unchanged
  - [ ] `bun run typecheck` → PASS

  **Automated Verification**:

  ```bash
  # Agent runs:
  bun run typecheck 2>&1 | tail -5
  # Assert: Output contains "0 errors" or exits with code 0

  # Verify new store exports:
  bun -e "
    import { useProjectStore } from './src/stores/project-store';
    const store = useProjectStore.getState();
    const hasNew = 'sessionStatus' in store && 'handleStreamEvent' in store;
    const hasOld = 'addMessage' in store && 'selectProject' in store;
    console.log(hasNew && hasOld ? 'Store interface correct' : 'Store interface broken');
  "
  # Assert: Output is "Store interface correct"
  ```

  **Evidence to Capture:**
  - [ ] Terminal output from typecheck command
  - [ ] Terminal output from store interface verification

  **Commit**: YES
  - Message: `feat(store): add event handlers for SSE stream processing`
  - Files: `src/stores/project-store.ts`
  - Pre-commit: `bun run typecheck`

---

- [ ] 6. Update Status Line Component for Rich Tool States

  **What to do**:
  - Update `src/components/conversation/status-line.tsx` to display tool states
  - Show tool name and status (pending → running → completed/error)
  - Display session status (idle/busy/retry with attempt number)
  - Add visual indicators (spinner for running, checkmark for completed, X for error)
  - Pull state from `useProjectStore` (sessionStatus, currentToolStates)

  **Must NOT do**:
  - Don't change component layout significantly
  - Don't add new dependencies for icons (use emoji or simple text)
  - Don't implement animations (keep it simple)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple UI component update, pulling from existing store state
  - **Skills**: `["frontend-ui-ux"]`
    - Useful for component styling decisions
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not testing in this task

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after Task 5)
  - **Blocks**: Task 7
  - **Blocked By**: Task 5 (needs store state)

  **References**:

  **Pattern References** (existing code to follow):
  - `src/components/conversation/status-line.tsx` - Current component to enhance

  **API/Type References** (contracts to implement against):
  - `src/stores/project-store.ts` - `sessionStatus`, `currentToolStates` from store (Task 5)
  - `src/types/opencode-events.ts` - `ToolState` type for status display logic

  **WHY Each Reference Matters**:
  - Current status-line shows existing styling and structure
  - Store provides the state to display
  - ToolState type defines all possible statuses to handle

  **Acceptance Criteria**:
  - [ ] Displays current tool name and status
  - [ ] Shows session status (idle/busy/retry)
  - [ ] Visual distinction between tool states (pending/running/completed/error)
  - [ ] Component renders without errors
  - [ ] `bun run typecheck` → PASS

  **Automated Verification**:

  ```bash
  # Agent runs:
  bun run typecheck 2>&1 | tail -5
  # Assert: Output contains "0 errors" or exits with code 0

  # Verify component imports store:
  grep -l "useProjectStore" src/components/conversation/status-line.tsx && echo "Store imported"
  # Assert: Output includes "Store imported"
  ```

  **Evidence to Capture:**
  - [ ] Terminal output from typecheck command
  - [ ] Terminal output from import verification

  **Commit**: YES
  - Message: `feat(ui): display rich tool states and session status`
  - Files: `src/components/conversation/status-line.tsx`
  - Pre-commit: `bun run typecheck`

---

- [ ] 7. Integration Tests

  **What to do**:
  - Create `src/__tests__/opencode-integration.test.ts`
  - Mock OpenCode SDK client
  - Test message route SSE event forwarding
  - Test streaming hook event parsing
  - Test store event handlers
  - Test abort functionality
  - Verify question.asked events create question messages

  **Must NOT do**:
  - Don't test against real OpenCode server (mock only)
  - Don't test UI rendering (that's E2E territory)
  - Don't create excessive test cases (focus on critical paths)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Integration testing requires understanding multiple components
  - **Skills**: `[]`
    - Standard Vitest testing work
  - **Skills Evaluated but Omitted**:
    - `playwright`: These are unit/integration tests, not E2E

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (final)
  - **Blocks**: None (final task)
  - **Blocked By**: All previous tasks

  **References**:

  **Pattern References** (existing code to follow):
  - Look for existing `*.test.ts` files in project for test patterns

  **API/Type References** (contracts to implement against):
  - `src/app/api/opencode/message/route.ts` - Route to test (Task 2)
  - `src/hooks/use-opencode-stream.ts` - Hook to test (Task 4)
  - `src/stores/project-store.ts` - Store to test (Task 5)
  - `src/types/opencode-events.ts` - Event types for mocking (Task 1)

  **External References**:
  - Vitest mocking: `vi.mock()`, `vi.fn()`
  - React Testing Library: `renderHook()` for testing hooks

  **WHY Each Reference Matters**:
  - Need to understand what each component does to test it properly
  - Event types needed to create valid mock events

  **Acceptance Criteria**:
  - [ ] Test file created: `src/__tests__/opencode-integration.test.ts`
  - [ ] Tests mock OpenCode SDK successfully
  - [ ] Tests verify SSE event forwarding
  - [ ] Tests verify hook event parsing
  - [ ] Tests verify store event handling
  - [ ] `bun test` → All tests pass

  **Automated Verification**:

  ```bash
  # Agent runs:
  bun test src/__tests__/opencode-integration.test.ts 2>&1
  # Assert: Output shows tests passing, no failures

  # Run full test suite:
  bun test 2>&1 | tail -10
  # Assert: All tests pass
  ```

  **Evidence to Capture:**
  - [ ] Terminal output from test run showing pass/fail counts

  **Commit**: YES
  - Message: `test: add integration tests for OpenCode SSE streaming`
  - Files: `src/__tests__/opencode-integration.test.ts`
  - Pre-commit: `bun test`

---

## Commit Strategy

| After Task | Message                                                                | Files                                         | Verification        |
| ---------- | ---------------------------------------------------------------------- | --------------------------------------------- | ------------------- |
| 1          | `feat(types): add SSE event types aligned with OpenCode SDK`           | `src/types/opencode-events.ts`                | `bun run typecheck` |
| 2          | `refactor(api): use SDK event streaming for real-time message updates` | `src/app/api/opencode/message/route.ts`       | `bun run typecheck` |
| 3          | `feat(api): add abort endpoint for canceling active OpenCode requests` | `src/app/api/opencode/abort/route.ts`         | `bun run typecheck` |
| 4          | `refactor(hooks): use EventSource for native SSE streaming`            | `src/hooks/use-opencode-stream.ts`            | `bun run typecheck` |
| 5          | `feat(store): add event handlers for SSE stream processing`            | `src/stores/project-store.ts`                 | `bun run typecheck` |
| 6          | `feat(ui): display rich tool states and session status`                | `src/components/conversation/status-line.tsx` | `bun run typecheck` |
| 7          | `test: add integration tests for OpenCode SSE streaming`               | `src/__tests__/opencode-integration.test.ts`  | `bun test`          |

---

## Success Criteria

### Verification Commands

```bash
# Type checking
bun run typecheck
# Expected: 0 errors

# All tests pass
bun test
# Expected: All tests pass

# Lint passes
bun run lint
# Expected: No errors
```

### Final Checklist

- [ ] All "Must Have" present:
  - [ ] True real-time streaming via SSE
  - [ ] Proper event type alignment with SDK
  - [ ] Tool state machine display
  - [ ] Question detection via `question.asked`
  - [ ] Abort capability
  - [ ] Error display with manual retry
- [ ] All "Must NOT Have" absent:
  - [ ] No persistent connections
  - [ ] No auto-retry loops
  - [ ] No breaking changes to Message/Project types
  - [ ] No storage changes
  - [ ] No auth changes
  - [ ] No layout changes
- [ ] All tests pass
- [ ] Type checking passes
- [ ] Lint passes
