# @agent-chat/react

Reusable React chat component for AgentChat-compatible backends.

## Install

```bash
pnpm add @agent-chat/react
```

Peer dependencies:

- `react`
- `react-dom`

Runtime dependencies include markdown and class utilities and are installed automatically.

## Host App Requirements

The host app must provide:

- Tailwind CSS v4
- `@tailwindcss/typography`
- API endpoints compatible with AgentChat backend contract

### Tailwind setup

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
@source "../node_modules/@agent-chat/react/dist/**/*.mjs";
```

## Usage

```tsx
import { AgentChat } from "@agent-chat/react";

export function ChatPanel({ sessionId }: { sessionId: string }) {
  return (
    <div className="h-[600px] rounded-xl border border-zinc-200">
      <AgentChat
        sessionId={sessionId}
        backendUrl="https://your-app.example.com"
        placeholder="Ask anything..."
      />
    </div>
  );
}
```

`backendUrl` should point at the app that exposes the AgentChat API routes.

## Additional Context

Host apps can attach extra context (text selections, file contents, images) alongside user messages.

### Props

| Prop             | Type            | Description                                               |
| ---------------- | --------------- | --------------------------------------------------------- |
| `contextItems`   | `ContextItem[]` | Context items to attach to the next message.              |
| `onClearContext` | `() => void`    | Callback after message is sent (use to clear your state). |

### Types

```typescript
interface ContextItem {
  id: string;
  type: "text-selection" | "image" | "file" | string;
  label: string;
  content: string;
}

interface Message {
  // ... existing fields ...
  displayContent?: string; // The user-typed text only (without context)
  contextItemCount?: number; // Number of context items that were attached
}
```

### Usage Example

```tsx
import { useState } from "react";
import { AgentChat } from "@agent-chat/react";
import type { ContextItem } from "@agent-chat/react";

interface DocumentViewerProps {
  sessionId: string;
  docContent: React.ReactNode;
}

export function DocumentViewer({ sessionId, docContent }: DocumentViewerProps) {
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);

  const handleTextSelection = () => {
    const selection = window.getSelection()?.toString();
    if (!selection) return;

    setContextItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: "text-selection",
        label: "Text Selection",
        content: selection,
      },
    ]);
  };

  return (
    <div className="flex h-screen">
      <div
        className="flex-1 p-8 overflow-y-auto"
        onMouseUp={handleTextSelection}
      >
        {docContent}
      </div>
      <div className="w-96 border-l border-zinc-200">
        <AgentChat
          sessionId={sessionId}
          contextItems={contextItems}
          onClearContext={() => setContextItems([])}
        />
      </div>
    </div>
  );
}
```

### Behavior

- **Automatic Clearing**: `onClearContext` is called immediately after a message is successfully sent, allowing the host app to reset the pending context state.
- **Input Preview**: When context items are present, a status bar appears above the chat input showing the count of items that will be sent.
- **Message Display**: User message bubbles display only the typed text (`displayContent`). A badge shows "+ N items" if context was attached.
- **Persistence**: Context is appended to the prompt on the server side and survives page refreshes or reconnections.
