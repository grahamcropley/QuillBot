# OpenCode Tool Usage Guide

> Comprehensive documentation for implementing tool handling in web applications connected to OpenCode server.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Streaming Modes](#streaming-modes)
4. [Event Types](#event-types)
5. [Tool Handling Patterns](#tool-handling-patterns)
6. [The Question Tool](#the-question-tool)
7. [Implementation Guide](#implementation-guide)
8. [Code Examples](#code-examples)
9. [Best Practices](#best-practices)

---

## Overview

OpenCode provides a server-side AI coding agent that communicates with clients via REST API and Server-Sent Events (SSE). Tools are mechanisms that allow the AI to interact with the user (like asking questions) or the environment (like reading/writing files).

### Key Concepts

- **Session**: A conversation context with the AI. Sessions persist across messages.
- **Message**: A single exchange (user prompt or assistant response).
- **Part**: A component of a message (text, tool call, reasoning, etc.).
- **Event**: Real-time updates streamed via SSE.
- **Tool**: An action the AI can take (read, write, question, etc.).

---

## Architecture

### Communication Flow

```
┌─────────────────────┐
│   Web Application   │
│   (Next.js/React)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐         ┌─────────────────────┐
│   API Routes        │◄───────►│   OpenCode Server   │
│   (Proxy Layer)     │   SSE   │   (localhost:9090)  │
└──────────┬──────────┘         └─────────────────────┘
           │
           ▼
┌─────────────────────┐
│   React Components  │
│   (UI/State)        │
└─────────────────────┘
```

### Component Responsibilities

| Layer               | Purpose                                                 |
| ------------------- | ------------------------------------------------------- |
| **OpenCode Server** | AI agent, tool execution, session management            |
| **API Routes**      | Proxy requests, transform SSE to client-friendly format |
| **Hooks**           | Manage streaming state, handle callbacks                |
| **Components**      | Render messages, tool UIs, handle user interactions     |
| **Store**           | Persist conversation state, manage message history      |

---

## Streaming Modes

OpenCode supports two primary streaming approaches:

### 1. Synchronous Prompt (Wait for Response)

```typescript
// POST /session/:id/message
// Returns complete response when AI finishes
const result = await client.session.prompt({
  sessionID: "ses_123",
  parts: [{ type: "text", text: "Hello!" }],
});
```

**When to use**: Simple requests, non-interactive flows.

### 2. Async Prompt with SSE Events

```typescript
// POST /session/:id/prompt_async - Returns immediately (204)
// GET /event - Subscribe to real-time updates
await client.session.promptAsync({
  sessionID: "ses_123",
  parts: [{ type: "text", text: "Create a file" }],
});

// Subscribe to events
const events = await client.event.subscribe();
for await (const event of events.stream) {
  // Handle real-time updates
}
```

**When to use**: Long-running tasks, real-time UI updates, tool interactions.

### Hybrid Approach (Recommended for Tools)

For web applications, use a hybrid approach:

1. Send message via sync endpoint
2. Stream response parts as SSE to client
3. Handle tool events (like `question.asked`) via event subscription

---

## Event Types

OpenCode emits these event types via SSE (`GET /event`):

### Session Events

| Event               | Description                |
| ------------------- | -------------------------- |
| `session.created`   | New session started        |
| `session.updated`   | Session state changed      |
| `session.completed` | AI finished responding     |
| `session.error`     | Error occurred             |
| `session.compacted` | Session history compressed |

### Message Events

| Event             | Description                                  |
| ----------------- | -------------------------------------------- |
| `message.created` | New message in session                       |
| `message.updated` | Message content changed                      |
| `part.updated`    | Individual part updated (for streaming text) |

### Question Events (Tool-Specific)

| Event               | Description                      |
| ------------------- | -------------------------------- |
| `question.asked`    | AI is asking user a question     |
| `question.replied`  | User answered the question       |
| `question.rejected` | User rejected/cancelled question |

### Other Events

| Event                  | Description                 |
| ---------------------- | --------------------------- |
| `file.edited`          | File was modified           |
| `file.watcher.updated` | File system change detected |
| `todo.updated`         | Todo list changed           |

---

## Tool Handling Patterns

### Tool Part Structure

When the AI uses a tool, it appears as a `part` in the message:

```typescript
interface ToolPart {
  type: "tool";
  name: string; // Tool name: "read", "write", "question", etc.
  input: unknown; // Tool-specific input parameters
  state: "pending" | "running" | "completed" | "error";
  output?: unknown; // Tool result (when completed)
}
```

### Common Tools

| Tool       | Purpose               | Input                                                    |
| ---------- | --------------------- | -------------------------------------------------------- |
| `read`     | Read file contents    | `{ path: string, limit?: number }`                       |
| `write`    | Write/create file     | `{ path: string, content: string }`                      |
| `edit`     | Edit file             | `{ path: string, oldString: string, newString: string }` |
| `grep`     | Search file contents  | `{ pattern: string, include?: string }`                  |
| `glob`     | Find files by pattern | `{ pattern: string }`                                    |
| `bash`     | Run shell command     | `{ command: string }`                                    |
| `question` | Ask user a question   | `{ questions: QuestionInfo[] }`                          |

### Tool Lifecycle

1. **Pending**: Tool call detected in message parts
2. **Running**: Tool is executing (show status indicator)
3. **Completed**: Tool finished (may have output)
4. **Error**: Tool failed

---

## The Question Tool

The `question` tool is unique - it requires user interaction before the AI can continue.

### Question Data Structure

```typescript
interface QuestionOption {
  label: string; // Short label for the option
  description: string; // Longer explanation
}

interface QuestionInfo {
  question: string; // The full question text
  header: string; // Short header (max 30 chars)
  options: QuestionOption[]; // Available choices
  multiple?: boolean; // Allow multiple selections
  custom?: boolean; // Allow custom text input (default: true)
}

interface QuestionRequest {
  id: string; // Request ID for replying
  sessionID: string; // Session context
  questions: QuestionInfo[]; // Array of questions
  tool?: {
    messageID: string; // Parent message ID
    callID: string; // Tool call ID
  };
}
```

### Question Flow

```
┌──────────────────┐
│ AI sends message │
│ with tool part   │
│ type: "question" │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Parse question   │
│ data from input  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Render question  │
│ UI to user       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ User selects     │
│ answer(s)        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ POST /question/  │
│ {requestID}/reply│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ AI continues     │
│ with answer      │
└──────────────────┘
```

### Answering Questions

```typescript
// SDK method
await client.question.reply({
  requestID: "req_abc123",
  directory: "/path/to/project",
  answers: [
    ["Option 1"],           // Single selection
    ["Choice A", "Choice B"] // Multiple selection
  ]
});

// REST API
POST /question/{requestID}/reply
{
  "answers": [["Selected Option"]]
}
```

### Rejecting Questions

If the user wants to cancel:

```typescript
await client.question.reject({
  requestID: "req_abc123",
  directory: "/path/to/project",
});
```

---

## Implementation Guide

### Step 1: Set Up Event Subscription (Optional but Recommended)

For real-time updates, maintain a persistent SSE connection:

```typescript
// lib/opencode-events.ts
import { createOpencodeClient } from "@opencode-ai/sdk/v2/client";

export async function subscribeToEvents(
  onEvent: (event: Event) => void,
  signal?: AbortSignal,
) {
  const client = createOpencodeClient({
    baseUrl: process.env.OPENCODE_API_URL || "http://localhost:9090",
  });

  const events = await client.event.subscribe();

  for await (const event of events.stream) {
    if (signal?.aborted) break;
    onEvent(event);
  }
}
```

### Step 2: Create API Route for Messages

Transform OpenCode responses into a streaming format for the client:

```typescript
// app/api/opencode/message/route.ts
import { NextRequest } from "next/server";
import { getOpencodeClient } from "@/lib/opencode-client";

export async function POST(request: NextRequest) {
  const { sessionId, projectId, message } = await request.json();

  const client = getOpencodeClient(projectDirectory);

  // Create encoder for SSE
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Send initial status
        sendEvent({ type: "status", content: "Connecting..." });

        // Send prompt to OpenCode
        const result = await client.session.prompt({
          sessionID: sessionId,
          parts: [{ type: "text", text: message }],
        });

        // Process response parts
        for (const part of result.data?.parts || []) {
          switch (part.type) {
            case "text":
              sendEvent({ type: "content", content: part.text });
              break;

            case "tool":
              await handleToolPart(part, sendEvent, sessionId);
              break;

            case "reasoning":
              sendEvent({ type: "status", content: "Thinking..." });
              break;
          }
        }

        sendEvent({ type: "done", sessionId });
        controller.close();
      } catch (error) {
        sendEvent({ type: "error", error: String(error) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function handleToolPart(
  part: ToolPart,
  sendEvent: (data: object) => void,
  sessionId: string,
) {
  const toolName = part.name;
  const toolInput = part.input;

  switch (toolName) {
    case "question":
      // Transform question data for client
      const questionData = {
        requestId: toolInput.id || part.callID,
        sessionId,
        questions: toolInput.questions,
        answered: false,
      };
      sendEvent({ type: "question", questionData });
      break;

    case "write":
      sendEvent({
        type: "status",
        content: `Creating ${toolInput.path}`,
      });
      break;

    case "read":
      sendEvent({
        type: "status",
        content: `Reading ${toolInput.path}`,
      });
      break;

    // Add more tool handlers as needed
  }
}
```

### Step 3: Create Client-Side Hook

```typescript
// hooks/use-opencode-stream.ts
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { QuestionData, StreamChunk } from "@/types";

interface UseOpenCodeStreamOptions {
  projectId: string;
  onChunk?: (content: string) => void;
  onStatus?: (status: string) => void;
  onQuestion?: (question: QuestionData) => void;
  onComplete?: (content: string, sessionId: string) => void;
  onError?: (error: Error) => void;
}

export function useOpenCodeStream(options: UseOpenCodeStreamOptions) {
  const { projectId, onChunk, onStatus, onQuestion, onComplete, onError } =
    options;

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (message: string) => {
      setIsStreaming(true);
      setStreamingContent("");
      setStatusMessage("");

      let accumulated = "";

      try {
        const response = await fetch("/api/opencode/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            projectId,
            message,
          }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

          for (const line of lines) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);

              switch (parsed.type) {
                case "content":
                  accumulated += parsed.content;
                  setStreamingContent(accumulated);
                  onChunk?.(parsed.content);
                  break;

                case "status":
                  setStatusMessage(parsed.content);
                  onStatus?.(parsed.content);
                  break;

                case "question":
                  onQuestion?.(parsed.questionData);
                  break;

                case "error":
                  throw new Error(parsed.error);

                case "done":
                  if (parsed.sessionId) setSessionId(parsed.sessionId);
                  setStatusMessage("");
                  onComplete?.(accumulated, parsed.sessionId);
                  break;
              }
            } catch (parseError) {
              console.warn("Failed to parse SSE data:", data);
            }
          }
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(err);
      } finally {
        setIsStreaming(false);
      }
    },
    [projectId, sessionId, onChunk, onStatus, onQuestion, onComplete, onError],
  );

  return {
    sendMessage,
    isStreaming,
    streamingContent,
    statusMessage,
    sessionId,
  };
}
```

### Step 4: Create Question API Route

```typescript
// app/api/opencode/question/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getOpencodeClient } from "@/lib/opencode-client";

interface QuestionReplyRequest {
  projectId: string;
  requestId: string;
  answers: string[][];
}

export async function POST(request: NextRequest) {
  const body: QuestionReplyRequest = await request.json();
  const { projectId, requestId, answers } = body;

  const client = getOpencodeClient(projectDirectory);

  try {
    await client.question.reply({
      requestID: requestId,
      directory: projectDirectory,
      answers,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to submit answer:", error);
    return NextResponse.json(
      { error: "Failed to submit answer" },
      { status: 500 },
    );
  }
}
```

### Step 5: Create Question UI Component

```typescript
// components/conversation/question-prompt.tsx
"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { QuestionData, QuestionInfo } from "@/types";

interface QuestionPromptProps {
  questionData: QuestionData;
  onSubmit: (answers: string[][]) => void;
}

export function QuestionPrompt({ questionData, onSubmit }: QuestionPromptProps) {
  const [answers, setAnswers] = useState<string[][]>(
    questionData.questions.map(() => [])
  );

  const isAnswered = questionData.answered;
  const isValid = answers.every(a => a.length > 0);

  const handleOptionToggle = (questionIndex: number, label: string) => {
    const question = questionData.questions[questionIndex];

    setAnswers(prev => {
      const next = [...prev];

      if (question.multiple) {
        // Toggle selection for multiple choice
        if (next[questionIndex].includes(label)) {
          next[questionIndex] = next[questionIndex].filter(l => l !== label);
        } else {
          next[questionIndex] = [...next[questionIndex], label];
        }
      } else {
        // Single selection
        next[questionIndex] = [label];
      }

      return next;
    });
  };

  const handleSubmit = () => {
    onSubmit(answers);
  };

  return (
    <Card className={isAnswered ? "bg-gray-50" : ""}>
      <CardHeader>
        <span className="text-blue-600 font-semibold">
          {isAnswered ? "Answered" : "Action Required"}
        </span>
      </CardHeader>

      <CardContent className="space-y-6">
        {questionData.questions.map((question, qIndex) => (
          <QuestionBlock
            key={question.question}
            question={question}
            selectedAnswers={answers[qIndex]}
            onToggle={(label) => handleOptionToggle(qIndex, label)}
            disabled={isAnswered}
          />
        ))}
      </CardContent>

      {!isAnswered && (
        <CardFooter>
          <Button onClick={handleSubmit} disabled={!isValid}>
            Submit Answer
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

interface QuestionBlockProps {
  question: QuestionInfo;
  selectedAnswers: string[];
  onToggle: (label: string) => void;
  disabled?: boolean;
}

function QuestionBlock({
  question,
  selectedAnswers,
  onToggle,
  disabled
}: QuestionBlockProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-medium">{question.header}</h3>
        <p className="text-gray-500">{question.question}</p>
      </div>

      <div className="space-y-2">
        {question.options.map(option => {
          const isSelected = selectedAnswers.includes(option.label);

          return (
            <div
              key={option.label}
              onClick={() => !disabled && onToggle(option.label)}
              className={`
                p-3 rounded-lg border cursor-pointer
                ${isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200"}
                ${disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-50"}
              `}
            >
              <span className="font-medium">{option.label}</span>
              {option.description && (
                <p className="text-gray-500 text-sm">{option.description}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Step 6: Integrate Into Conversation Panel

```typescript
// components/conversation/conversation-panel.tsx
"use client";

import { QuestionPrompt } from "./question-prompt";
import type { Message } from "@/types";

interface ConversationPanelProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  onAnswerQuestion: (questionId: string, answers: string[][]) => void;
  isLoading?: boolean;
  statusMessage?: string;
}

export function ConversationPanel({
  messages,
  onSendMessage,
  onAnswerQuestion,
  isLoading,
  statusMessage
}: ConversationPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(message => (
          <MessageBubble
            key={message.id}
            message={message}
            onAnswerQuestion={onAnswerQuestion}
          />
        ))}

        {/* Status indicator during loading */}
        {isLoading && statusMessage && (
          <div className="flex items-center gap-2 text-gray-600">
            <span className="animate-pulse">...</span>
            {statusMessage}
          </div>
        )}
      </div>

      {/* Input form */}
      <MessageInput onSubmit={onSendMessage} disabled={isLoading} />
    </div>
  );
}

function MessageBubble({
  message,
  onAnswerQuestion
}: {
  message: Message;
  onAnswerQuestion: (id: string, answers: string[][]) => void;
}) {
  // Render question as interactive card
  if (message.role === "question" && message.questionData) {
    return (
      <QuestionPrompt
        questionData={message.questionData}
        onSubmit={(answers) => onAnswerQuestion(message.id, answers)}
      />
    );
  }

  // Regular message bubble
  return (
    <div className={message.role === "user" ? "text-right" : "text-left"}>
      <div className="inline-block px-4 py-2 rounded-lg bg-gray-100">
        {message.content}
      </div>
    </div>
  );
}
```

---

## Code Examples

### Complete Page Implementation

```typescript
// app/project/[id]/page.tsx
"use client";

import { useEffect, useCallback } from "react";
import { useProjectStore } from "@/stores/project-store";
import { useOpenCodeStream } from "@/hooks/use-opencode-stream";
import { ConversationPanel } from "@/components/conversation";
import type { QuestionData } from "@/types";

export default function ProjectPage({ params }: { params: { id: string } }) {
  const {
    getCurrentProject,
    addMessage,
    addQuestion,
    answerQuestion,
    setOpenCodeBusy
  } = useProjectStore();

  const project = getCurrentProject();

  const handleQuestion = useCallback((questionData: QuestionData) => {
    addQuestion(questionData);
  }, [addQuestion]);

  const handleComplete = useCallback((content: string, sessionId: string) => {
    if (content.trim()) {
      addMessage("assistant", content);
    }
    setOpenCodeBusy(false);
  }, [addMessage, setOpenCodeBusy]);

  const {
    sendMessage,
    isStreaming,
    statusMessage
  } = useOpenCodeStream({
    projectId: params.id,
    onQuestion: handleQuestion,
    onComplete: handleComplete,
    onError: (err) => console.error(err)
  });

  const handleSendMessage = useCallback(async (content: string) => {
    addMessage("user", content);
    setOpenCodeBusy(true);
    await sendMessage(content);
  }, [addMessage, setOpenCodeBusy, sendMessage]);

  const handleAnswerQuestion = useCallback(async (
    questionId: string,
    answers: string[][]
  ) => {
    await answerQuestion(questionId, answers);
  }, [answerQuestion]);

  if (!project) return <div>Loading...</div>;

  return (
    <ConversationPanel
      messages={project.messages}
      onSendMessage={handleSendMessage}
      onAnswerQuestion={handleAnswerQuestion}
      isLoading={isStreaming}
      statusMessage={statusMessage}
    />
  );
}
```

---

## Best Practices

### 1. Handle All Tool Types

Even if you only need the question tool, build infrastructure for all tools:

```typescript
function handleToolPart(part: ToolPart) {
  switch (part.name) {
    case "question":
      return handleQuestion(part);
    case "write":
      return handleWrite(part);
    case "read":
      return handleRead(part);
    default:
      return handleUnknownTool(part);
  }
}
```

### 2. Show Tool Status

Keep users informed about what the AI is doing:

```typescript
const toolStatusMap = {
  write: (input) => `Creating ${input.path}`,
  edit: (input) => `Editing ${input.path}`,
  read: (input) => `Reading ${input.path}`,
  grep: () => "Searching files...",
  bash: (input) => `Running: ${input.command.slice(0, 50)}...`,
  question: () => "Waiting for your input...",
};
```

### 3. Persist Question State

Store question data and answers for session recovery:

```typescript
interface Message {
  id: string;
  role: "user" | "assistant" | "question";
  content: string;
  questionData?: QuestionData; // Store full question context
  timestamp: Date;
}
```

### 4. Handle Question Timeouts

If a user doesn't answer, provide escape hatches:

```typescript
// Add reject/skip functionality
async function handleRejectQuestion(requestId: string) {
  await fetch(`/api/opencode/question/${requestId}/reject`, {
    method: "POST",
  });
}
```

### 5. Validate Answers Before Submitting

```typescript
function validateAnswers(
  questions: QuestionInfo[],
  answers: string[][],
): boolean {
  return questions.every((q, i) => {
    const answer = answers[i];
    if (answer.length === 0) return false;
    if (!q.multiple && answer.length > 1) return false;
    return true;
  });
}
```

### 6. Type Safety

Define comprehensive types:

```typescript
// types/index.ts
export type MessageRole = "user" | "assistant" | "system" | "question";

export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionInfo {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
}

export interface QuestionData {
  requestId: string;
  sessionId: string;
  questions: QuestionInfo[];
  answers?: string[][];
  answered?: boolean;
}

export interface StreamChunk {
  type: "content" | "status" | "done" | "error" | "question";
  content?: string;
  error?: string;
  sessionId?: string;
  questionData?: QuestionData;
}
```

---

## Troubleshooting

### Question Not Appearing

1. Check console logs for question data
2. Verify `onQuestion` callback is registered
3. Check message role is set to "question"
4. Verify store's `addQuestion` is updating state

### Answer Not Submitting

1. Verify `requestId` matches the original question
2. Check `answers` format: `string[][]` (array of arrays)
3. Ensure directory path is correct
4. Check network tab for API errors

### SSE Stream Closing Early

1. Check `Connection: keep-alive` header
2. Verify server isn't timing out
3. Add heartbeat events if needed
4. Handle reconnection in client

---

## Summary

Implementing tool handling in OpenCode requires:

1. **Streaming infrastructure** to receive real-time updates
2. **Part-by-part processing** to handle different message types
3. **Tool-specific handlers** for each tool the AI might use
4. **User interface components** for interactive tools like `question`
5. **State management** to persist conversation and tool state
6. **API routes** to proxy and transform OpenCode responses

The question tool is unique in requiring user interaction - design your UI to make this seamless and ensure proper error handling for edge cases.
