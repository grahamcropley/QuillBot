"use client";

import { clsx } from "clsx";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Loader,
  RefreshCw,
  User,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ActivitySection } from "./activity-section";
import type { Message } from "@/types";
import type {
  ActivityToggleLevel,
  RenderItemActivity,
  RenderItemThinking,
} from "@/types/opencode-events";
import {
  deriveActivityItems,
  filterByToggleLevel,
} from "@/utils/conversation-render-model";

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

interface ThinkingInlineProps {
  item: RenderItemThinking;
}

function ThinkingInline({ item }: ThinkingInlineProps) {
  return (
    <p className="text-xs italic text-gray-400 dark:text-gray-500 my-1 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
      {item.text}
    </p>
  );
}

interface MessageBubbleProps {
  message: Message;
  onRetry?: (message: Message) => void;
  activityToggleLevel: ActivityToggleLevel;
}

export function MessageBubble({
  message,
  onRetry,
  activityToggleLevel,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isQuestionAnswered = message.role === "question-answered";
  const isErroredQuestion =
    message.role === "question" && message.questionData?.error === true;
  const hasError = message.error;
  const isPending = message.status === "pending";
  const isRetrying = message.status === "retrying";
  const hasContent = message.content.trim().length > 0;
  const showContentBubble =
    isUser ||
    isQuestionAnswered ||
    isErroredQuestion ||
    hasError ||
    isPending ||
    isRetrying ||
    hasContent;

  if (isErroredQuestion) {
    return (
      <div className="flex gap-2 flex-row">
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-red-600 dark:bg-red-700">
          <AlertCircle className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col items-start">
          <div className="px-4 py-2 rounded-2xl rounded-bl-md bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-100 text-[0.8rem] leading-relaxed">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
                Question Failed
              </span>
            </div>
            <p className="text-xs text-red-700 dark:text-red-200">
              {message.questionData?.errorMessage ||
                "Failed to submit answer. Please continue the conversation to proceed."}
            </p>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-600 mt-1">
            {formatTime(message.timestamp)}
          </span>
        </div>
      </div>
    );
  }

  const allItems = deriveActivityItems(message);
  const filteredItems = filterByToggleLevel(allItems, activityToggleLevel);

  const activities = filteredItems.filter(
    (item): item is RenderItemActivity => item.type === "activity",
  );
  const thinkingItems = filteredItems.filter(
    (item): item is RenderItemThinking => item.type === "thinking",
  );

  if (isQuestionAnswered) {
    return (
      <div className="flex gap-2 flex-row-reverse">
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-green-600 dark:bg-green-700">
          <CheckCircle2 className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col items-end">
          <div className="px-4 py-2 rounded-2xl rounded-br-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-900 dark:text-green-100 text-[0.8rem] leading-relaxed">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
                Question Answered
              </span>
            </div>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-600 mt-1">
            {formatTime(message.timestamp)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div
        className={clsx(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-blue-600 dark:bg-blue-600"
            : "bg-gray-600 dark:bg-gray-700",
          hasError && "bg-red-600 dark:bg-red-600",
          (isPending || isRetrying) && "bg-blue-400 dark:bg-blue-500",
        )}
      >
        {isPending || isRetrying ? (
          <Loader className="w-4 h-4 text-white animate-spin" />
        ) : hasError ? (
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
        {!isUser && thinkingItems.length > 0 && (
          <div className="w-full mb-1">
            {thinkingItems.map((item) => (
              <ThinkingInline key={item.id} item={item} />
            ))}
          </div>
        )}
        {!isUser && activities.length > 0 && (
          <div className="w-full space-y-2 mb-2">
            {activities.map((item) => (
              <ActivitySection key={item.id} item={item} />
            ))}
          </div>
        )}
        {showContentBubble && (
          <div
            className={clsx(
              "px-4 py-2 rounded-2xl",
              hasError
                ? "bg-red-50 dark:bg-red-950 border-2 border-red-300 dark:border-red-800 text-red-900 dark:text-red-100 rounded-br-md prose prose-compact max-w-none prose-invert"
                : isPending || isRetrying
                  ? "bg-blue-50 dark:bg-blue-950 border-2 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-100 rounded-br-md prose prose-sm max-w-none prose-invert"
                  : isUser
                    ? "bg-blue-500 dark:bg-blue-700 text-white dark:text-white rounded-br-md text-[0.8rem] leading-relaxed"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md prose prose-compact max-w-none dark:prose-invert",
            )}
          >
            {hasError ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : isPending || isRetrying ? (
              <div className="flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin" />
                <p className="text-xs">
                  {isRetrying
                    ? `Retrying... (attempt ${message.retryAttempts || 1})`
                    : "Sending..."}
                </p>
              </div>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            )}
            {hasError && message.errorMessage && (
              <div className="mt-2 pt-2 border-t border-red-300 dark:border-red-800 flex items-start gap-2">
                <p className="text-xs text-red-700 dark:text-red-200 flex-1">
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
        )}
        {(showContentBubble || activities.length > 0) && (
          <span className="text-xs text-gray-400 dark:text-gray-600 mt-1">
            {formatTime(message.timestamp)}
          </span>
        )}
      </div>
    </div>
  );
}
