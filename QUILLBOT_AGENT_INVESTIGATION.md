# QuillBot Agent Integration Investigation Report

**Date:** Feb 5, 2026  
**Status:** ✅ Complete - No changes made (analysis only)  
**Objective:** Identify what's needed to use QuillBot agent in OpenCode API calls

---

## Executive Summary

The **QuillBot agent** has been configured in `opencode-config/opencode.json` with restricted tool access (no bash, no delegation). To use this agent in API interactions with OpenCode, the application must pass the `agent: "quillbot"` parameter to the OpenCode SDK's `promptAsync()` method when sending prompts.

**Key Finding:** The agent parameter must be specified **per-prompt**, not at session creation time.

---

## What Was Investigated

### 1. Agent Configuration ✅
- **Status:** Already created and configured
- **Location:** `/opencode-config/opencode.json`
- **Agent Name:** `quillbot`
- **Capabilities:**
  - ✅ File operations (read, write, edit, patch)
  - ✅ Research (question, websearch, webfetch)
  - ❌ System commands (bash - denied)
  - ❌ Delegation (tasks, todos - not available)
  - ❌ Language services (LSP - disabled)

### 2. SDK Support for Agent Specification ✅
- **SDK:** `@opencode-ai/sdk/v2`
- **Method:** `client.session.promptAsync()`
- **Parameter:** `agent?: string`
- **Finding:** Agent parameter is fully supported in SDK

### 3. Current Application Architecture 🔍
- **Main conversation API:** `/api/opencode/message`
- **Analysis API:** `/api/opencode/analyze-brief`
- **Hook:** `useOpenCodeStream`
- **Issue:** Agent parameter not currently passed in any calls

### 4. Data Flow 📊
```
User sends message in Conversation Panel
    ↓
Hook (useOpenCodeStream) calls /api/opencode/message
    ↓
API Route creates/retrieves session
    ↓
API Route calls client.session.promptAsync()
    ↓
OpenCode SDK sends to server
    ↓
OpenCode reads opencode-config/opencode.json
    ↓
OpenCode applies QuillBot restrictions
```

---

## Files Requiring Modifications

### 1. `src/hooks/use-opencode-stream.ts`
**Changes needed:** 2

```typescript
// Change 1: Update SendMessageOptions interface (line ~43)
interface SendMessageOptions {
  message: string;
  command?: string;
  agent?: string;  // ← ADD
}

// Change 2: Extract and pass agent in fetch (line ~210)
const { message, command, agent } = messageOptions;  // ← ADD agent
// ... in fetch body ...
body: JSON.stringify({
  sessionId: sessionId || undefined,
  projectId,
  message: command ? `${command} ${message}` : message,
  command,
  agent: agent || "quillbot",  // ← ADD
}),
```

### 2. `src/app/api/opencode/message/route.ts`
**Changes needed:** 3

```typescript
// Change 1: Update RequestBody interface (line ~22)
interface RequestBody {
  sessionId?: string;
  projectId: string;
  message: string;
  command?: string;
  agent?: string;  // ← ADD
}

// Change 2 & 3: Pass agent to both promptAsync calls
// At line ~176 (initial prompt)
await client.session.promptAsync({
  sessionID: targetSessionId,
  directory: project.directoryPath,
  agent: body.agent || "quillbot",  // ← ADD
  parts: [
    {
      type: "text",
      text: message,
    },
  ],
});

// At line ~195 (retry after session recreation)
await client.session.promptAsync({
  sessionID: targetSessionId,
  directory: project.directoryPath,
  agent: body.agent || "quillbot",  // ← ADD
  parts: [
    {
      type: "text",
      text: message,
    },
  ],
});
```

### 3. `src/app/api/opencode/analyze-brief/route.ts`
**Changes needed:** 1

```typescript
// Change: Pass agent to promptAsync call (line ~175)
await client.session.promptAsync({
  sessionID: sessionId,
  directory: project.directoryPath,
  model: {
    providerID: "github-copilot",
    modelID: "claude-haiku-4.5",
  },
  agent: "quillbot",  // ← ADD
  parts: [{ type: "text", text: analysisPrompt }],
});
```

---

## Technical Analysis

### SDK Method Signatures

#### ❌ `client.session.create()`
```typescript
// Agent NOT supported here
parameters?: {
  directory?: string;
  parentID?: string;
  title?: string;
  permission?: PermissionRuleset;
}
```
**Finding:** Agent must be specified per-prompt, not at session creation.

#### ✅ `client.session.promptAsync()`
```typescript
// Agent IS supported here
parameters: {
  sessionID: string;
  directory?: string;
  messageID?: string;
  model?: { providerID: string; modelID: string };
  agent?: string;  // ← THIS IS NEW
  noReply?: boolean;
  tools?: { [key: string]: boolean };
  system?: string;
  variant?: string;
  parts?: Array<...>;
}
```
**Finding:** This is where agent specification happens.

#### ✅ `client.session.command()`
```typescript
// Agent also supported here
parameters: {
  sessionID: string;
  directory?: string;
  messageID?: string;
  agent?: string;  // ← ALSO HERE
  model?: string;
  arguments?: string;
  command?: string;
  variant?: string;
  parts?: Array<...>;
}
```

### Configuration Verification

The agent is properly configured in `opencode-config/opencode.json`:

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

When `agent: "quillbot"` is specified in API calls, OpenCode will:
1. Load this configuration
2. Apply all tool restrictions
3. Enforce bash denial
4. Prevent delegation/task tools
5. Allow only configured tools

---

## Implementation Strategy

### Phase 1: Minimal Integration (Recommended)
**Effort:** ~15 minutes | **Risk:** Low

Always use QuillBot with default fallback:
- Add optional `agent` parameter to interfaces
- Default to `"quillbot"` in all promptAsync calls
- Allows future enhancement without breaking changes

### Phase 2: Agent Selection (Optional)
**Effort:** ~45 minutes | **Risk:** Low

Add UI to choose agents:
- Create agent dropdown in conversation panel
- Pass selected agent through hook
- Store agent preference per session

### Phase 3: Multiple Agent Configs (Future)
**Effort:** ~30 minutes | **Risk:** Very Low

Add other agents for different purposes:
- Analyzer agent (lightweight model)
- Reviewer agent (read-only, no changes)
- Researcher agent (web-only, no file changes)

---

## Testing Plan

### Unit Tests
```typescript
// Test that agent is extracted and passed correctly
it('should pass agent parameter to API', async () => {
  const { sendMessage } = useOpenCodeStream({ projectId });
  await sendMessage({ message: 'test', agent: 'quillbot' });
  // Verify fetch was called with agent: 'quillbot'
});

// Test default agent
it('should default to quillbot agent', async () => {
  const { sendMessage } = useOpenCodeStream({ projectId });
  await sendMessage({ message: 'test' });
  // Verify fetch was called with agent: 'quillbot'
});
```

### Integration Tests
```typescript
// Test QuillBot restricts bash
it('should not allow bash commands with QuillBot', () => {
  // Send message asking for bash
  // Verify OpenCode returns permission denied
});

// Test QuillBot allows file operations
it('should allow file operations with QuillBot', () => {
  // Send message asking to write file
  // Verify file is created
});

// Test session recreation preserves agent
it('should use agent on session retry', () => {
  // Kill session
  // Send another message
  // Verify agent is still specified
});
```

---

## Decision Points

### Q1: Should agent be optional or mandatory?
**Recommendation:** Optional with default to "quillbot"
- Allows backward compatibility
- Enables future agent selection UI
- Fallback prevents errors if omitted

### Q2: Should analyze-brief use same agent?
**Recommendation:** Yes, use "quillbot"
- Consistency across features
- QuillBot already supports file operations needed
- If you need different agent later, update then

### Q3: Should this be configurable per user/session?
**Recommendation:** Keep simple for now
- All users use QuillBot
- Add per-session config later if needed
- Current design supports it (optional parameter)

---

## Architecture Diagram

```
┌─────────────────────────────────────┐
│   Conversation Panel Component       │
│                                     │
│  (User sends message)               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   useOpenCodeStream Hook            │
│                                     │
│  sendMessage({                      │
│    message: "...",                  │
│    agent: "quillbot"                │
│  })                                 │
└──────────────┬──────────────────────┘
               │ POST /api/opencode/message
               │ { message, agent, ... }
               ▼
┌─────────────────────────────────────┐
│   API Route Handler                 │
│                                     │
│  POST /api/opencode/message         │
│                                     │
│  client.session.promptAsync({       │
│    agent: body.agent || "quillbot"  │
│  })                                 │
└──────────────┬──────────────────────┘
               │
               ▼ SDK Call
┌─────────────────────────────────────┐
│   OpenCode Server                   │
│                                     │
│  1. Check opencode-config/...json   │
│  2. Load agent.quillbot config      │
│  3. Apply restrictions              │
│  4. Execute with limits             │
└─────────────────────────────────────┘
```

---

## Edge Cases Handled

1. **Agent parameter missing**
   - Default: `agent || "quillbot"`
   - Impact: Works seamlessly

2. **Unknown agent name**
   - Default: OpenCode SDK errors appropriately
   - Impact: Clear error message to user

3. **Agent name with special characters**
   - Constraint: Agent names are kebab-case (e.g., "my-agent")
   - Impact: String validation works naturally

4. **Multiple prompts in same session**
   - Each call specifies agent independently
   - Impact: Agent can theoretically change per-message (if UI added)

5. **Session recreation due to timeout**
   - Agent re-specified in retry path
   - Impact: Behavior consistent across retries

---

## Performance Implications

- **No impact:** Agent parameter is just a string reference
- **Configuration load:** OpenCode loads agent config once per session
- **Tool restrictions:** Enforced server-side, no client overhead
- **Network payload:** Minimal (adds ~20 bytes to request)

---

## Documentation Updates Needed

1. **Code Comments**
   ```typescript
   // Specify QuillBot agent to enforce content authoring restrictions
   // (no bash, no delegation, limited to file & research tools)
   agent: body.agent || "quillbot"
   ```

2. **API Documentation**
   - `/api/opencode/message` now accepts optional `agent` parameter
   - Defaults to "quillbot" if omitted

3. **AGENTS.md**
   - Document QuillBot agent purpose and restrictions
   - Link to agent configuration in opencode.json

4. **Code Comments in Hook**
   ```typescript
   // Pass agent to ensure tool restrictions are enforced
   const { message, command, agent } = messageOptions;
   ```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Agent not found | Low | Medium | Clear error message from SDK |
| Type mismatch | Low | Low | TypeScript catches it |
| Backward compatibility | Low | Low | Optional param with default |
| Performance | Very Low | Low | String parameter only |

**Overall Risk Level:** ⭐ Very Low

---

## Rollback Plan

If something goes wrong:

1. **Remove agent parameter from all calls**
2. **Keep interface changes** (no harm in having unused field)
3. **OpenCode defaults to session-wide agent**
4. **Full functionality maintained**

---

## Summary Checklist

**Pre-Implementation:**
- ✅ Agent configured in opencode-config/opencode.json
- ✅ SDK supports agent parameter
- ✅ Application architecture analyzed
- ✅ All API routes identified
- ✅ Test plan created
- ✅ Documentation gaps identified

**Implementation (when ready):**
- ☐ Update SendMessageOptions interface
- ☐ Update RequestBody interface  
- ☐ Add agent to hook fetch call
- ☐ Add agent to first promptAsync call
- ☐ Add agent to second promptAsync call (retry)
- ☐ Add agent to analyze-brief promptAsync call
- ☐ Test with agent parameter
- ☐ Test with agent omitted (default)
- ☐ Update code comments
- ☐ Update documentation

**Post-Implementation:**
- ☐ Monitor error logs
- ☐ Verify QuillBot restrictions work
- ☐ Test file operations
- ☐ Test bash denial
- ☐ Plan Phase 2 (agent selection UI)

---

## Conclusion

**Ready to implement:** ✅ Yes

The QuillBot agent is properly configured and the OpenCode SDK fully supports agent specification via the `agent` parameter in `promptAsync()` calls. Implementation requires minimal, low-risk changes to 3 files. All necessary information has been gathered and documented.

Next step: Implement changes when ready, following the provided code modifications guide.

