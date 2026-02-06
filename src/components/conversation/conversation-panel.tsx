"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type SyntheticEvent,
} from "react";
import { Send } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { ActivityToggle } from "./activity-toggle";
import { MessageBubble } from "./message-bubble";
import { QuestionPrompt } from "./question-prompt";
import { SelectionsIndicator } from "./selections-indicator";
import { StatusLine } from "./status-line";
import type { Message, TextSelection } from "@/types";
import type { StreamStatus } from "@/types/opencode-events";
import { useProjectStore } from "@/stores/project-store";
import { formatSelectionsContext } from "@/utils/format-selections";

interface ConversationPanelProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  onAnswerQuestion?: (questionId: string, answers: string[][]) => void;
  onRetryMessage?: (message: Message) => void;
  isLoading?: boolean;
  streamStatus?: StreamStatus;
  textSelection?: TextSelection | null;
  onClearSelection?: () => void;
  currentFileName?: string;
}

export function ConversationPanel({
  messages,
  onSendMessage,
  onAnswerQuestion,
  onRetryMessage,
  isLoading,
  streamStatus: streamStatusProp,
  textSelection,
  onClearSelection,
  currentFileName,
}: ConversationPanelProps) {
  const markedSelections = useProjectStore((state) => state.markedSelections);
  const clearMarkedSelections = useProjectStore(
    (state) => state.clearMarkedSelections,
  );
  const activityToggleLevel = useProjectStore(
    (state) => state.activityToggleLevel,
  );
  const setActivityToggleLevel = useProjectStore(
    (state) => state.setActivityToggleLevel,
  );

  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const pendingQuestion = useMemo(() => {
    return (
      messages.find(
        (message) =>
          message.role === "question" &&
          message.questionData &&
          !message.questionData.answered,
      ) ?? null
    );
  }, [messages]);

  const visibleMessages = useMemo(() => {
    return messages.filter((message) => message.role !== "question");
  }, [messages]);

  const resolvedStatus = useMemo((): StreamStatus => {
    if (pendingQuestion && !isLoading) {
      return {
        kind: "waiting-for-answer",
        label: "Waiting for your response...",
      };
    }
    return streamStatusProp ?? { kind: "idle", label: "" };
  }, [streamStatusProp, pendingQuestion, isLoading]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const threshold = 100;

      setShouldAutoScroll(distanceFromBottom < threshold);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, resolvedStatus, shouldAutoScroll]);

  const handleSubmit = useCallback(
    (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!inputValue.trim() || isLoading) return;

      let messageContent = inputValue.trim();

      if (markedSelections.length > 0) {
        const selectionContext = formatSelectionsContext(
          markedSelections,
          currentFileName,
        );
        messageContent = selectionContext + "\n" + messageContent;
      }

      if (textSelection) {
        const selectionContext = `[Lines ${textSelection.startLine}-${textSelection.endLine}] Selected: "${textSelection.text}"\n\n`;
        messageContent = selectionContext + messageContent;
        onClearSelection?.();
      }

      onSendMessage(messageContent);
      setInputValue("");
    },
    [
      inputValue,
      isLoading,
      markedSelections,
      currentFileName,
      textSelection,
      onClearSelection,
      onSendMessage,
    ],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSubmit(event as unknown as SyntheticEvent<HTMLFormElement>);
      }
    },
    [handleSubmit],
  );

  const showStatusLine = true;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
        <ActivityToggle
          level={activityToggleLevel}
          onChange={setActivityToggleLevel}
        />
      </div>
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-3"
      >
        {visibleMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600">
            <p>Start the conversation...</p>
          </div>
        ) : (
          visibleMessages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onRetry={onRetryMessage}
              activityToggleLevel={activityToggleLevel}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {showStatusLine && (
        <div className="mx-4 mb-2">
          <StatusLine streamStatus={resolvedStatus} />
        </div>
      )}

      <SelectionsIndicator
        selections={markedSelections}
        onClear={clearMarkedSelections}
      />

      {textSelection && (
        <div className="mx-4 mb-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg text-xs">
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

      {pendingQuestion ? (
        <div className="border-t border-gray-200 dark:border-gray-800 p-3 bg-blue-50/50 dark:bg-blue-950/30">
          <QuestionPrompt
            questionData={pendingQuestion.questionData!}
            onSubmit={(answers) =>
              onAnswerQuestion?.(pendingQuestion.id, answers)
            }
            variant="input-area"
          />
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="p-3 border-t border-gray-200 dark:border-gray-800"
        >
          <div className="flex w-full gap-2">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Shift+Enter for new line)"
              className="min-h-[44px] max-h-[120px] w-full flex-1 resize-none text-[0.8rem]"
            />
            <Button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              isLoading={isLoading}
              className="flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
