import { useState } from "react";
import { cn } from "../../../lib/cn";
import type { ContextItem } from "../agent-chat.types";

interface ChatInputProps {
  onSend: (content: string) => void;
  onInterrupt?: () => void;
  isLoading: boolean;
  placeholder?: string;
  contextItems?: ContextItem[];
  onClearContext?: () => void;
}

export function ChatInput({
  onSend,
  onInterrupt,
  isLoading,
  placeholder,
  contextItems,
  onClearContext,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [interruptArmed, setInterruptArmed] = useState(false);

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim() || isLoading) return;
      onSend(input);
      setInput("");
    }
  };

  const handleSendButtonClick = () => {
    if (isLoading) {
      if (!onInterrupt) return;

      if (!interruptArmed) {
        setInterruptArmed(true);
        return;
      }

      setInterruptArmed(false);
      onInterrupt();
      return;
    }

    if (interruptArmed) {
      setInterruptArmed(false);
    }

    if (!input.trim()) return;
    onSend(input);
    setInput("");
  };

  const contextCount = contextItems?.length ?? 0;

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-700">
      {contextCount > 0 && (
        <div className="flex items-center justify-between bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          <span>
            {contextCount} {contextCount === 1 ? "selection" : "selections"}{" "}
            will be sent with next message
          </span>
          <button
            type="button"
            onClick={onClearContext}
            aria-label="Clear context selections"
            className="ml-2 rounded p-0.5 text-amber-600 transition-colors hover:bg-amber-100 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-800/30 dark:hover:text-amber-300"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <title>Clear selections</title>
              <path
                d="M3 3l8 8M11 3l-8 8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-end gap-2 p-4">
        <textarea
          value={input}
          onChange={(e) => {
            if (interruptArmed) {
              setInterruptArmed(false);
            }
            setInput(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Type a message..."}
          rows={1}
          disabled={isLoading}
          className={cn(
            "flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm",
            "placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
            "disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100",
          )}
        />
        <button
          type="button"
          disabled={!isLoading && !input.trim()}
          aria-label={
            isLoading
              ? interruptArmed
                ? "Interrupt agent (confirm)"
                : "Interrupt agent"
              : "Send message"
          }
          onClick={handleSendButtonClick}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            isLoading && interruptArmed
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-blue-600 text-white hover:bg-blue-700",
            "transition-colors",
            "disabled:opacity-50",
            !isLoading && "disabled:hover:bg-blue-600",
            isLoading && interruptArmed && "disabled:hover:bg-red-600",
          )}
        >
          {isLoading ? (
            interruptArmed ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <title>Stop</title>
                <rect
                  x="4"
                  y="4"
                  width="8"
                  height="8"
                  rx="1"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <title>Send</title>
              <path
                d="M1 8h14M9 2l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
