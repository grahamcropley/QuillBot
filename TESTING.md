# QuillBot OpenCode Integration - Testing Guide

## Server Status ✅

Both servers are running and healthy:

- **OpenCode Server**: `http://localhost:9090` (PID: 26860)
- **Next.js Dev Server**: `http://localhost:3000` (PID: 26958)

## What Was Fixed

### 1. Client-Side URL Configuration

**Problem**: Frontend was calling `http://localhost:9090/api/opencode/message` directly, which returned HTML instead of JSON.

**Fix**: Modified `src/lib/config.ts` to use relative URLs in the browser:

```typescript
export function getApiEndpoint(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // Client-side: use relative URLs (goes to Next.js API routes)
  if (typeof window !== "undefined") {
    return cleanPath; // Returns: /api/opencode/message
  }

  // Server-side: use full OpenCode URL
  const base = openCodeConfig.apiUrl.replace(/\/$/, "");
  return `${base}${cleanPath}`; // Returns: http://localhost:9090/...
}
```

### 2. OpenCode SDK Base URL

**Fix**: SDK now uses `http://localhost:9090` without `/api/v1` suffix (SDK adds this automatically)

### 3. TypeScript Union Type Handling

**Fix**: Added explicit type guards for OpenCode SDK's `{data: T} | {error: E}` response types

### 4. Command API Bypass

**Fix**: Using `prompt()` instead of `command()` for now (custom `/write-content` command not configured yet)

---

## Testing Instructions

### 1. Test API via Command Line

```bash
# Test basic message
curl -X POST http://localhost:3000/api/opencode/message \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test-cli","message":"Say hello"}'

# Expected response:
# {"sessionId":"ses_...","content":"Hello! How can I help?","done":true}
```

### 2. Test in Browser

Open your browser and navigate to:

```
http://localhost:3000
```

**Expected Flow**:

1. See "No projects yet" landing page
2. Click "New Project" button
3. Fill out the form:
   - Name: "My First Blog Post"
   - Content Type: Blog Post
   - Target Length: 500 words
   - Style: Professional
   - Brief: "Write about the benefits of TypeScript"
4. Click "Create Project"
5. See project page with conversation interface
6. Initial message should auto-send (if configured)
7. Type follow-up messages and see AI responses

### 3. Check Browser Console

Open Developer Tools (F12) and check the Console tab:

**✅ Should see**:

- Normal React/Next.js hydration messages
- Successful fetch responses with JSON data

**❌ Should NOT see**:

- "Unexpected token '<', '<!doctype'..."
- "Failed to parse JSON"
- CORS errors
- Network errors to http://localhost:9090

### 4. Test Network Tab

In Developer Tools → Network tab:

**Check `/api/opencode/message` request**:

- Request URL: `http://localhost:3000/api/opencode/message` (NOT 9090!)
- Method: POST
- Status: 200
- Response Headers: `Content-Type: application/json`
- Response Body: Valid JSON with `sessionId`, `content`, `done`

---

## Quick API Test

Run this in your browser console on http://localhost:3000:

```javascript
fetch("/api/opencode/message", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    projectId: "browser-test",
    message: "Write a haiku about coding",
  }),
})
  .then((r) => r.json())
  .then((data) => console.log("✓ Success:", data))
  .catch((err) => console.error("✗ Error:", err));
```

**Expected output**:

```
✓ Success: {
  sessionId: "ses_...",
  content: "Code flows like water...",
  done: true
}
```

---

## Troubleshooting

### Issue: Still getting HTML errors

**Check**:

1. Clear browser cache (Ctrl+F5)
2. Check Network tab - is request going to `:3000` or `:9090`?
3. Restart Next.js dev server:
   ```bash
   pkill -f next-server
   cd /home/graham/github/QuillBot
   npm run dev
   ```

### Issue: "Failed to fetch" or connection refused

**Check**:

1. Verify Next.js is running: `curl http://localhost:3000`
2. Verify OpenCode is running: `curl http://localhost:9090/api/v1/path`
3. Check processes: `ps aux | grep -E "(next|opencode)"`

### Issue: Empty or error responses

**Check server logs**:

```bash
# Next.js logs
tail -f /tmp/nextjs-dev.log

# OpenCode logs
tail -f /tmp/opencode-serve.log
```

---

## Architecture Overview

```
Browser
  ↓
  → GET http://localhost:3000 (Next.js UI)
  → POST /api/opencode/message (relative URL)
     ↓
     Next.js API Route (/src/app/api/opencode/message/route.ts)
     ↓
     → POST http://localhost:9090/api/v1/session/prompt (OpenCode SDK)
        ↓
        OpenCode Server (Generates AI content)
        ↓
     ← JSON Response
     ↓
  ← JSON Response to Browser
```

**Key points**:

- Browser NEVER talks directly to OpenCode (port 9090)
- All frontend requests use relative URLs (`/api/...`)
- Next.js API routes proxy to OpenCode server
- OpenCode SDK handles authentication and formatting

---

## Next Steps

Once basic integration is working:

1. **Test Project Creation**: Create a new project in the UI
2. **Test Conversation**: Send multiple messages back and forth
3. **Implement Streaming**: Add Server-Sent Events for real-time updates
4. **Add Document Preview**: Live markdown preview with file watching
5. **Implement Text Selection**: Select preview text to add context
6. **Configure Custom Command**: Set up `/write-content` command in OpenCode config

---

## Files Modified

- `src/lib/config.ts` - Fixed `getApiEndpoint()` for client/server URLs
- `src/lib/opencode-client.ts` - Fixed SDK base URL (no `/api/v1`)
- `src/app/api/opencode/message/route.ts` - Type fixes, using `prompt()` API

---

## Current Limitations

1. **No streaming yet**: Responses are returned complete (not real-time)
2. **No `/write-content` command**: Using generic prompts instead
3. **Auto-send not verified**: Need to test if initial message sends on project creation
4. **No document sync**: Preview/editing features not implemented yet

---

## Success Criteria

✅ Browser can create projects
✅ Browser can send messages via `/api/opencode/message`
✅ API returns valid JSON (not HTML)
✅ OpenCode generates content successfully
✅ No console errors about parsing JSON
✅ Network tab shows requests to `:3000` not `:9090`

**The integration is now ready for end-to-end UI testing!**
