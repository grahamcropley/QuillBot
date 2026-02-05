# Conversation Bubble Improvements

## Thinking Bubble Enhancement

**Issue**: Some models fire `reasoning` part events without any text content, creating empty "Thinking" bubbles.

**Current Behavior**:

- Any `part.type === "reasoning"` creates a "Thinking" activity bubble
- Appears in the message bubble area regardless of content

**Desired Behavior**:

- **No content**: Show "Thinking..." in the status indicator (where "Busy", "Waiting on input", etc. appear)
- **Has content**: Show as expandable "Thinking" bubble that streams text into the body
  - Default state: collapsed
  - Click to expand: reveals streaming reasoning content
  - Text updates incrementally as deltas arrive

**Implementation Notes**:

- Check `part.text` existence before creating bubble
- If empty/missing → route to status line instead
- If present → create collapsible bubble with streaming text body
- May need to handle transition: empty → populated (status line → bubble promotion)

**Files to Modify**:

- `src/components/conversation/conversation-panel.tsx` (line 412-419)
- `src/components/conversation/status-line.tsx` (add reasoning status)
- `src/app/project/[id]/page.tsx` (status message handling)
