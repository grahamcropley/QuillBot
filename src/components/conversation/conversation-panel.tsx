"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type FormEvent,
} from "react";
import { Send, User, Bot, AlertCircle, RefreshCw } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { clsx } from "clsx";
import { QuestionPrompt } from "./question-prompt";
import { StatusLine, parseStatusMessage } from "./status-line";
import type { Message, TextSelection } from "@/types";

interface ConversationPanelProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  onAnswerQuestion?: (questionId: string, answers: string[][]) => void;
  onRetryMessage?: (message: Message) => void;
  isLoading?: boolean;
  statusMessage?: string;
  textSelection?: TextSelection | null;
  onClearSelection?: () => void;
}

interface MessageBubbleProps {
  message: Message;
  onAnswerQuestion?: (questionId: string, answers: string[][]) => void;
  onRetry?: (message: Message) => void;
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function MessageBubble({
  message,
  onAnswerQuestion,
  onRetry,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const hasError = message.error;
  const activityItems = getActivityItems(message);

  if (message.role === "question" && message.questionData) {
    return (
      <div className="flex flex-col items-start w-full">
        <QuestionPrompt
          questionData={message.questionData}
          onSubmit={(answers) => onAnswerQuestion?.(message.id, answers)}
        />
        <span className="text-xs text-gray-400 dark:text-gray-600 mt-1 ml-4">
          {formatTime(message.timestamp)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={clsx("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div
        className={clsx(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-blue-600 dark:bg-blue-600"
            : "bg-gray-600 dark:bg-gray-700",
          hasError && "bg-red-600 dark:bg-red-600",
        )}
      >
        {hasError ? (
          <AlertCircle className="w-4 h-4 text-white" />
        ) : isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>
      <div
        className={clsx(
          "flex flex-col w-full",
          isUser ? "items-end" : "items-start",
        )}
      >
        {!isUser && activityItems.length > 0 && (
          <div className="w-full space-y-2 mb-2">
            {activityItems.map((item) => (
              <ActivitySection key={item.key} item={item} />
            ))}
          </div>
        )}
        <div
          className={clsx(
            "px-4 py-2 rounded-2xl",
            hasError
              ? "bg-red-50 dark:bg-red-950 border-2 border-red-300 dark:border-red-800 text-red-900 dark:text-red-100 rounded-br-md"
              : isUser
                ? "bg-blue-600 dark:bg-blue-600 text-white rounded-br-md"
                : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md",
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
          {hasError && message.errorMessage && (
            <div className="mt-2 pt-2 border-t border-red-300 dark:border-red-800 flex items-start gap-2">
              <p className="text-sm text-red-700 dark:text-red-200 flex-1">
                Error: {message.errorMessage}
              </p>
              {onRetry && (
                <button
                  onClick={() => onRetry(message)}
                  className="flex-shrink-0 p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors"
                  title="Retry sending this message"
                >
                  <RefreshCw className="w-4 h-4 text-red-700 dark:text-red-200" />
                </button>
              )}
            </div>
          )}
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-600 mt-1">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

type ActivityItem = {
  key: string;
  title: string;
  content?: string;
  status?: "pending" | "running" | "completed" | "error";
  kind:
    | "thinking"
    | "tool"
    | "delegating"
    | "system"
    | "mcp"
    | "command"
    | "retry"
    | "compaction"
    | "step"
    | "file"
    | "permission"
    | "todo"
    | "other";
};

function getActivityItems(message: Message): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const part of message.parts ?? []) {
    if (part.type === "reasoning") {
      items.push({
        key: part.id,
        title: "Thinking",
        content: part.text,
        kind: "thinking",
      });
      continue;
    }

    if (part.type === "text" && part.synthetic) {
      items.push({
        key: part.id,
        title: "System instructions",
        content: part.text,
        kind: "system",
      });
      continue;
    }

    if (part.type === "tool") {
      const status = part.state.status;
      const input = JSON.stringify(part.state.input ?? {}, null, 2);
      const output =
        part.state.status === "completed" ? part.state.output : undefined;
      const error =
        part.state.status === "error" ? part.state.error : undefined;
      const body = output || error || input;

      items.push({
        key: part.id,
        title: `Running tool: ${part.tool}`,
        content: body,
        status,
        kind: "tool",
      });
      continue;
    }

    if (part.type === "subtask") {
      items.push({
        key: part.id,
        title: `Delegating: ${part.description}`,
        content: part.prompt,
        kind: "delegating",
      });
      continue;
    }

    if (part.type === "agent") {
      items.push({
        key: part.id,
        title: `Using agent: ${part.name}`,
        content: part.source?.value,
        kind: "delegating",
      });
      continue;
    }

    if (part.type === "retry") {
      items.push({
        key: part.id,
        title: `Retrying (attempt ${part.attempt})`,
        content: part.error?.data?.message,
        kind: "retry",
      });
      continue;
    }

    if (part.type === "compaction") {
      items.push({
        key: part.id,
        title: "Compaction",
        content: part.auto ? "Auto compaction enabled" : "Manual compaction",
        kind: "compaction",
      });
      continue;
    }

    if (part.type === "step-start") {
      items.push({
        key: part.id,
        title: "Step started",
        content: part.snapshot,
        kind: "step",
      });
      continue;
    }

    if (part.type === "step-finish") {
      const tokens = `Tokens: input ${part.tokens.input}, output ${part.tokens.output}`;
      items.push({
        key: part.id,
        title: `Step finished (${part.reason})`,
        content: tokens,
        kind: "step",
      });
      continue;
    }

    if (part.type === "file") {
      const fileLabel = part.filename ?? part.url;
      items.push({
        key: part.id,
        title: "File",
        content: fileLabel,
        kind: "file",
      });
      continue;
    }

    if (part.type === "patch") {
      items.push({
        key: part.id,
        title: "Patch applied",
        content: part.files.join("\n"),
        kind: "file",
      });
    }
  }

  for (const activity of message.activities ?? []) {
    switch (activity.activityType) {
      case "tui.prompt.append":
        items.push({
          key: `${activity.activityType}-${items.length}`,
          title: "Prompt augmented",
          content: String(activity.data.text ?? ""),
          kind: "system",
        });
        break;
      case "tui.command.execute":
        items.push({
          key: `${activity.activityType}-${items.length}`,
          title: "Command executed",
          content: String(activity.data.command ?? ""),
          kind: "command",
        });
        break;
      case "command.executed":
        items.push({
          key: `${activity.activityType}-${items.length}`,
          title: `Command executed: ${String(activity.data.name ?? "")}`,
          content: String(activity.data.arguments ?? ""),
          kind: "command",
        });
        break;
      case "mcp.tools.changed":
        items.push({
          key: `${activity.activityType}-${items.length}`,
          title: "MCP tools updated",
          content: String(activity.data.server ?? ""),
          kind: "mcp",
        });
        break;
      case "mcp.browser.open.failed":
        items.push({
          key: `${activity.activityType}-${items.length}`,
          title: "MCP browser open failed",
          content: String(activity.data.url ?? ""),
          kind: "mcp",
        });
        break;
      case "permission.asked":
        items.push({
          key: `${activity.activityType}-${items.length}`,
          title: "Permission requested",
          content: String(activity.data.permission ?? ""),
          kind: "permission",
        });
        break;
      case "permission.replied":
        items.push({
          key: `${activity.activityType}-${items.length}`,
          title: "Permission response",
          content: String(activity.data.response ?? ""),
          kind: "permission",
        });
        break;
      case "todo.updated":
        items.push({
          key: `${activity.activityType}-${items.length}`,
          title: "Todo list updated",
          content: JSON.stringify(activity.data.todos ?? [], null, 2),
          kind: "todo",
        });
        break;
      case "tui.toast.show":
        items.push({
          key: `${activity.activityType}-${items.length}`,
          title: "Server notice",
          content: String(activity.data.message ?? ""),
          kind: "other",
        });
        break;
      default:
        items.push({
          key: `${activity.activityType}-${items.length}`,
          title: "Activity",
          content: JSON.stringify(activity.data ?? {}, null, 2),
          kind: "other",
        });
    }
  }

  return items;
}

function ActivitySection({ item }: { item: ActivityItem }) {
  const statusLabel = item.status ? ` (${item.status})` : "";
  return (
    <details className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
        {item.title}
        {statusLabel}
      </summary>
      {item.content && (
        <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-400">
          {item.content}
        </pre>
      )}
    </details>
  );
}

export function ConversationPanel({
  messages,
  onSendMessage,
  onAnswerQuestion,
  onRetryMessage,
  isLoading,
  statusMessage,
  textSelection,
  onClearSelection,
}: ConversationPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasUnansweredQuestion = useMemo(() => {
    return messages.some(
      (m) =>
        m.role === "question" && m.questionData && !m.questionData.answered,
    );
  }, [messages]);

  const parsedStatus = useMemo(() => {
    if (hasUnansweredQuestion && !isLoading) {
      return {
        status: "waiting-for-answer" as const,
        message: "Waiting for your response...",
      };
    }
    if (!statusMessage) {
      return { status: "idle" as const, message: "" };
    }
    return parseStatusMessage(statusMessage);
  }, [statusMessage, hasUnansweredQuestion, isLoading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, statusMessage]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim() || isLoading) return;

      let messageContent = inputValue.trim();

      if (textSelection) {
        const selectionContext = `[Lines ${textSelection.startLine}-${textSelection.endLine}] Selected: "${textSelection.text}"\n\n`;
        messageContent = selectionContext + messageContent;
        onClearSelection?.();
      }

      onSendMessage(messageContent);
      setInputValue("");
    },
    [inputValue, isLoading, textSelection, onSendMessage, onClearSelection],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as unknown as FormEvent);
      }
    },
    [handleSubmit],
  );

  const showStatusLine = true;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600">
            <p>Start the conversation...</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onAnswerQuestion={onAnswerQuestion}
              onRetry={onRetryMessage}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {showStatusLine && (
        <div className="mx-4 mb-2">
          <StatusLine
            status={parsedStatus.status}
            message={parsedStatus.message}
            toolName={parsedStatus.toolName}
          />
        </div>
      )}

      {textSelection && (
        <div className="mx-4 mb-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm">
          <div className="flex items-center justify-between">
            <span className="text-yellow-800 dark:text-yellow-200">
              Selection: &ldquo;{textSelection.text.slice(0, 50)}
              {textSelection.text.length > 50 ? "..." : ""}&rdquo;
            </span>
            <button
              onClick={onClearSelection}
              className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-gray-200 dark:border-gray-800"
      >
        <div className="flex w-full gap-2">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              hasUnansweredQuestion
                ? "Please answer the question above first..."
                : "Type your message... (Shift+Enter for new line)"
            }
            className="min-h-[44px] max-h-[120px] w-full flex-1 resize-none"
            disabled={isLoading || hasUnansweredQuestion}
          />
          <Button
            type="submit"
            disabled={!inputValue.trim() || isLoading || hasUnansweredQuestion}
            isLoading={isLoading}
            className="flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
