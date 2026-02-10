"use client";

import { useRef, useEffect, useCallback } from "react";
import { cn } from "../../lib/cn";
import type { AgentChatProps, Message, MessagePart } from "./AgentChat.types";
import {
  ChatMessage,
  ChatInput,
  QuestionModal,
  TodoListModal,
} from "./components";
import { TodoModalProvider, useTodoModal } from "./context/TodoModalContext";
import { useChat } from "./hooks/useChat";

function isActivityPart(part: MessagePart): boolean {
  return (
    part.type === "tool" ||
    part.type === "step-start" ||
    part.type === "step-finish"
  );
}

function isVisiblePart(part: MessagePart): boolean {
  if (isActivityPart(part)) return true;
  if (part.type === "text" || part.type === "reasoning") {
    return !!part.text?.trim();
  }
  return false;
}

function isActivityOnlyMessage(message: Message): boolean {
  const hasQa =
    message.pseudo && message.qaAnswers && message.qaAnswers.length > 0;
  if (message.role !== "assistant" || hasQa) return false;

  const visibleParts = message.parts.filter((part) => isVisiblePart(part));
  return (
    visibleParts.length > 0 &&
    visibleParts.every((part) => isActivityPart(part))
  );
}

interface ActivityBoundarySection {
  isActivity: boolean;
  parts: MessagePart[];
}

interface RenderMessageItem {
  key: string;
  message: Message;
}

function splitPartsByActivityBoundary(
  parts: MessagePart[],
): ActivityBoundarySection[] {
  const sections: ActivityBoundarySection[] = [];

  for (const part of parts) {
    const isActivity = isActivityPart(part);
    const prev = sections[sections.length - 1];

    if (!prev || prev.isActivity !== isActivity) {
      sections.push({ isActivity, parts: [part] });
      continue;
    }

    prev.parts.push(part);
  }

  return sections;
}

function splitMessageForRender(message: Message): Message[] {
  const hasQa =
    message.pseudo && message.qaAnswers && message.qaAnswers.length > 0;
  if (message.role !== "assistant" || hasQa) return [message];

  const visibleParts = message.parts.filter((part) => isVisiblePart(part));
  const hasActivity = visibleParts.some((part) => isActivityPart(part));
  const hasNonActivity = visibleParts.some((part) => !isActivityPart(part));
  if (!hasActivity || !hasNonActivity) return [message];

  const sections = splitPartsByActivityBoundary(visibleParts);
  return sections.map((section, index) => ({
    ...message,
    parts: section.parts,
    error: index === sections.length - 1 ? message.error : undefined,
  }));
}

function buildRenderMessageItems(messages: Message[]): RenderMessageItem[] {
  const items: RenderMessageItem[] = [];

  for (const message of messages) {
    const split = splitMessageForRender(message);
    if (split.length === 1) {
      items.push({ key: message.id, message: split[0] });
      continue;
    }

    split.forEach((segment, index) => {
      items.push({ key: `${message.id}::segment-${index}`, message: segment });
    });
  }

  return items;
}

function AgentChatContent({
  sessionId,
  backendUrl = "",
  placeholder,
  className,
  directory,
  onMessagesChange,
  onStatusChange,
  contextItems,
  onClearContext,
}: AgentChatProps) {
  const {
    messages,
    status,
    isLoading,
    error,
    pendingQuestion,
    sendMessage,
    answerQuestion,
    rejectQuestion,
    addPseudoMessage,
  } = useChat({
    sessionId,
    backendUrl,
    directory,
    onMessagesChange,
    onStatusChange,
  });

  const { todoModal, closeTodoModal } = useTodoModal();
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageCount = messages.length;
  const renderItems = buildRenderMessageItems(messages);
  const contextItemsRef = useRef(contextItems);
  const onClearContextRef = useRef(onClearContext);

  useEffect(() => {
    contextItemsRef.current = contextItems;
    onClearContextRef.current = onClearContext;
  }, [contextItems, onClearContext]);

  useEffect(() => {
    if (messageCount === 0) return;
    const el = scrollRef.current;
    if (el && typeof el.scrollTo === "function") {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messageCount]);

  const handleSendMessage = useCallback(
    (content: string) => {
      const currentContextItems = contextItemsRef.current;
      const hasContext = currentContextItems && currentContextItems.length > 0;

      sendMessage(
        content,
        hasContext ? { contextItems: currentContextItems } : undefined,
      );

      if (hasContext) {
        onClearContextRef.current?.();
      }
    },
    [sendMessage],
  );

  const handleQuestionSubmit = (answers: string[][]) => {
    if (!pendingQuestion) return;

    const qaAnswers = pendingQuestion.questions.map((q, i) => ({
      header: q.header,
      answers: answers[i],
    }));

    addPseudoMessage({
      id: `pseudo-${Date.now()}`,
      sessionId,
      role: "user",
      createdAt: Date.now(),
      completedAt: Date.now(),
      pseudo: true,
      parts: [],
      qaAnswers,
    });

    answerQuestion(pendingQuestion.id, answers);
  };

  const isBusy = status === "busy" || isLoading;

  return (
    <div className={cn("relative flex h-full flex-col", className)}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            Start a conversation
          </div>
        )}
        {renderItems.map((item, index) => {
          const prevMessage = index > 0 ? renderItems[index - 1].message : null;
          const message = item.message;
          const bothActivityOnly = prevMessage
            ? isActivityOnlyMessage(prevMessage) &&
              isActivityOnlyMessage(message)
            : false;

          return (
            <div
              key={item.key}
              className={cn(
                index > 0 && (bothActivityOnly ? "mt-0.5" : "mt-3"),
              )}
            >
              <ChatMessage message={message} />
            </div>
          );
        })}
      </div>

      {pendingQuestion && (
        <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm bg-black/30">
          <QuestionModal
            request={pendingQuestion}
            onSubmit={handleQuestionSubmit}
            onCancel={() => rejectQuestion(pendingQuestion.id)}
          />
        </div>
      )}

      {todoModal.isOpen && (
        <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm bg-black/30">
          <TodoListModal todos={todoModal.todos} onClose={closeTodoModal} />
        </div>
      )}

      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {status === "retry" && (
        <div className="mx-4 mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          Retrying…
        </div>
      )}

      <ChatInput
        onSend={handleSendMessage}
        isLoading={isBusy}
        placeholder={placeholder}
        contextItems={contextItems}
        onClearContext={onClearContext}
      />
    </div>
  );
}

export function AgentChat(props: AgentChatProps) {
  return (
    <TodoModalProvider>
      <AgentChatContent {...props} />
    </TodoModalProvider>
  );
}
