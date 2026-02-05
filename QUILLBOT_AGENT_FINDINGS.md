# QuillBot Agent Integration - Investigation Findings

## Overview
QuillBot is configured in `opencode-config/opencode.json` as a primary agent with file operations and research capabilities. This document details what's needed to specify this agent in OpenCode API calls.

---

## Current Architecture

### 1. **Client-Side (Conversation Component)**
- **File**: `src/hooks/use-opencode-stream.ts`
- **Function**: `sendMessage()` 
- **Behavior**: Posts to `/api/opencode/message` with:
  ```typescript
  {
    sessionId?: string;
    projectId: string;
    message: string;
    command?: string;
  }
  ```
- **No agent specification** currently passed from client

### 2. **Server-Side API Route**
- **File**: `src/app/api/opencode/message/route.ts`
- **Current workflow**:
  1. Creates/retrieves session via `client.session.create()`
  2. Sends prompt via `client.session.promptAsync()` with message text
  3. Subscribes to events and streams responses

### 3. **OpenCode Client**
- **File**: `src/lib/opencode-client.ts`
- **Usage**: Creates SDK client with only `baseUrl`, `directory`, and optional auth headers
- **No agent configuration** passed to client initialization

---

## SDK API Capabilities

### Session Creation (`client.session.create()`)
**Current parameters**:
```typescript
{
  directory?: string;
  parentID?: string;
  title?: string;
  permission?: PermissionRuleset;
}
```
**Finding**: Agent NOT specifiable at session creation level.

### Prompt Async (`client.session.promptAsync()`)
**Available parameters** (from SDK v2):
```typescript
{
  sessionID: string;
  directory?: string;
  messageID?: string;
  model?: { providerID: string; modelID: string };
  agent?: string;                    // ✅ AGENT SPECIFICATION HERE
  noReply?: boolean;
  tools?: { [key: string]: boolean };
  system?: string;
  variant?: string;
  parts?: Array<TextPartInput | FilePartInput | AgentPartInput | SubtaskPartInput>;
}
```

**KEY FINDING**: The `agent` parameter in `promptAsync()` accepts a **string agent name**.

### Command (`client.session.command()`)
**Also supports**:
```typescript
{
  sessionID: string;
  directory?: string;
  messageID?: string;
  agent?: string;                    // ✅ AGENT SPECIFICATION HERE
  model?: string;
  arguments?: string;
  command?: string;
  variant?: string;
  parts?: Array<...>;
}
```

---

## What's Needed for QuillBot Integration

### 1. **Update API Request Body**
**File**: `src/hooks/use-opencode-stream.ts`

Add `agent` parameter to request:
```typescript
const response = await fetch("/api/opencode/message", {
  method: "POST",
  body: JSON.stringify({
    sessionId: sessionId || undefined,
    projectId,
    message: command ? `${command} ${message}` : message,
    command,
    agent: "quillbot",  // ✅ NEW
  }),
  signal: abortController.signal,
});
```

### 2. **Update API Route Handler**
**File**: `src/app/api/opencode/message/route.ts`

**Change A**: Update `RequestBody` interface
```typescript
interface RequestBody {
  sessionId?: string;
  projectId: string;
  message: string;
  command?: string;
  agent?: string;  // ✅ NEW
}
```

**Change B**: Pass agent to `promptAsync()`
```typescript
const promptPromise = (async () => {
  try {
    await client.session.promptAsync({
      sessionID: targetSessionId,
      directory: project.directoryPath,
      agent: body.agent || "quillbot",  // ✅ PASS AGENT HERE
      parts: [
        {
          type: "text",
          text: message,
        },
      ],
    });
  } catch (error) {
    // ... error handling
    if (isSessionNotFoundError(error)) {
      // ... recreate session
      await client.session.promptAsync({
        sessionID: targetSessionId,
        directory: project.directoryPath,
        agent: body.agent || "quillbot",  // ✅ PASS AGENT HERE TOO
        parts: [
          {
            type: "text",
            text: message,
          },
        ],
      });
    }
  }
})();
```

### 3. **Update OpenCode Hook Options**
**File**: `src/hooks/use-opencode-stream.ts`

Add `agent` to `SendMessageOptions`:
```typescript
interface SendMessageOptions {
  message: string;
  command?: string;
  agent?: string;  // ✅ NEW - Optional, defaults to "quillbot"
}
```

And in `sendMessage()` function:
```typescript
const sendMessage = useCallback(
  async (
    messageOptions: SendMessageOptions,
  ): Promise<Result<{ sessionId: string; content: string }>> => {
    const { message, command, agent } = messageOptions;  // ✅ DESTRUCTURE AGENT
    
    // ... existing code ...
    
    const response = await fetch("/api/opencode/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionId || undefined,
        projectId,
        message: command ? `${command} ${message}` : message,
        command,
        agent: agent || "quillbot",  // ✅ PASS AGENT WITH DEFAULT
      }),
      signal: abortController.signal,
    });
```

### 4. **Update Conversation Panel** (Optional)
**File**: `src/components/conversation/conversation-panel.tsx`

If you want to allow agents to be selected:
```typescript
const handleSendMessage = (content: string) => {
  onSendMessage(content);  // Could pass agent here too
};
```

---

## Integration Summary

### Minimal Change Path (Default to QuillBot)
1. Update `RequestBody` interface in API route
2. Modify both `promptAsync()` calls to include `agent: body.agent || "quillbot"`
3. Update `SendMessageOptions` interface
4. Extract agent from options in hook

### Full Change Path (Agent Selection)
Do the above PLUS:
1. Add UI selector for agent choice
2. Pass selected agent through component props
3. Include agent in all API requests

---

## Agent Configuration Verification

The QuillBot agent is already configured in `opencode-config/opencode.json`:
```json
{
  "agent": {
    "quillbot": {
      "description": "QuillBot - Content authoring agent with file operations and research capabilities",
      "mode": "primary",
      "model": "github-copilot/gpt-5.2",
      "tools": {
        "read": true,
        "write": true,
        "edit": true,
        "apply_patch": true,
        "question": true,
        "websearch": true,
        "webfetch": true,
        "bash": false,
        "lsp": false
      },
      "permission": {
        "edit": "allow",
        "bash": "deny"
      }
    }
  }
}
```

When `agent: "quillbot"` is specified in API calls, OpenCode will use this configuration.

---

## Files to Modify

| File | Change Type | Reason |
|------|-------------|--------|
| `src/hooks/use-opencode-stream.ts` | Add agent param to request | Pass agent name to API |
| `src/app/api/opencode/message/route.ts` | Add agent to body & promptAsync | Forward agent to SDK |
| *(Optional)* `src/components/conversation/conversation-panel.tsx` | Add agent selector | Allow user to choose agent |

---

## Testing Considerations

1. **With agent specified**: Verify OpenCode uses QuillBot restrictions (no bash, no delegates)
2. **Without agent specified**: Should default to "quillbot" and work identically
3. **Fallback behavior**: If agent name doesn't exist, OpenCode SDK will error appropriately
4. **Session recreation**: Agent is passed on both initial prompt and retry after session recreation

---

## Documentation

For other developers, consider documenting:
- When/why QuillBot is the primary agent
- How to add other agents (same config pattern in opencode.json)
- Agent selection flow in conversation component

---

## Additional API Route: Analyze Brief

### Found: `src/app/api/opencode/analyze-brief/route.ts`

This route also calls `promptAsync()` for content analysis:
```typescript
await client.session.promptAsync({
  sessionID: sessionId,
  directory: project.directoryPath,
  model: {
    providerID: "github-copilot",
    modelID: "claude-haiku-4.5",
  },
  parts: [{ type: "text", text: analysisPrompt }],
});
```

**Note**: This route uses a different model (claude-haiku-4.5) for lightweight analysis.

**Change needed**: Add agent parameter here too (if QuillBot should be used, or allow override):
```typescript
await client.session.promptAsync({
  sessionID: sessionId,
  directory: project.directoryPath,
  model: {
    providerID: "github-copilot",
    modelID: "claude-haiku-4.5",
  },
  agent: "quillbot",  // ✅ ADD THIS
  parts: [{ type: "text", text: analysisPrompt }],
});
```

**Decision point**: 
- Should analysis always use QuillBot agent? 
- Or should it have its own agent config?
- Currently it's using a lighter model (haiku) for speed

---

## Updated Files to Modify

| File | Change Type | Reason |
|------|-------------|--------|
| `src/hooks/use-opencode-stream.ts` | Add agent param to request | Pass agent name to API |
| `src/app/api/opencode/message/route.ts` | Add agent to body & 2x promptAsync calls | Main conversation agent |
| `src/app/api/opencode/analyze-brief/route.ts` | Add agent to promptAsync call | Brief analysis agent (decision: same or different?) |
| *(Optional)* `src/components/conversation/conversation-panel.tsx` | Add agent selector | Allow user to choose agent |

