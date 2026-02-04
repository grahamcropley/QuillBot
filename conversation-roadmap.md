# Conversation Roadmap

This note outlines stream events and UI behaviors the conversation client should support.

## Core message flow

- Text content
  - Source: stream parts where part.type = "text" and not synthetic
  - Render: assistant message bubble
  - Streaming: append deltas; split on tool usage if needed

- Questions
  - Source: event.type = "question"
  - Render: dedicated Question UI component
  - Persistence: mark answered state and store answers

## Tooling and activities

- Tool calls
  - Source: part.type = "tool"
  - Render: activity bubble
  - Show: tool name, status, input summary (url/file/command/paths/text), output or error

- File edits
  - Source: event.type = "file.edited"
  - Render: activity bubble with file path

- Reasoning/steps
  - Source: part.type = "reasoning", "step-start", "step-finish"
  - Render: activity bubble (optional/compact)

- Permissions
  - Source: activityType = "permission.asked" / "permission.replied"
  - Render: activity bubble with prompt + reply

- Todo updates
  - Source: activityType = "todo.updated"
  - Render: activity bubble with a compact diff summary
  - Suggested display:
    - Count: total / completed / in-progress / pending
    - Optional list of top 3 items (by most recent change)

- Command execution
  - Source: activityType = "command.executed" or "tui.command.execute"
  - Render: activity bubble with command and status

- MCP events
  - Source: activityType = "mcp.tools.changed", "mcp.browser.open.failed"
  - Render: activity bubble

## Status handling

- Session status
  - Source: event.type = "status" and "done"
  - Render: status line (non-message)

- Errors
  - Source: event.type = "error"
  - Render: status line + error bubble when relevant

## Persistence requirements

- Persist messages with parts + activities so timeline survives refresh
- Persist question answered state + selected answers
- Avoid duplicate message IDs when streaming segments are stored

## Open questions

- When to collapse or hide low-value activity types
- Whether to add user toggles for activity visibility
- How to summarize large tool outputs (truncate + expand)
