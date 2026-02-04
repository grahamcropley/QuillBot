"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Result, QuestionData } from "@/types";
import type {
  StreamEvent,
  StreamActivity,
  Part,
} from "@/types/opencode-events";
import {
  isStreamMessagePartUpdated,
  isStreamQuestionAsked,
  isStreamSessionStatus,
  isStreamError,
  isStreamDone,
  isStreamFileEdited,
  isStreamActivity,
} from "@/types/opencode-events";

interface UseOpenCodeStreamOptions {
  projectId: string;
  onChunk?: (content: string) => void;
  onStatus?: (status: string) => void;
  onQuestion?: (question: QuestionData) => void;
  onComplete?: (fullContent: string, sessionId: string) => void;
  onError?: (error: Error) => void;
  onFileEdited?: (path: string) => void;
  onPart?: (part: Part, delta?: string) => void;
  onActivity?: (activity: StreamActivity) => void;
}

interface SendMessageOptions {
  message: string;
  command?: string;
}

export interface UseOpenCodeStreamReturn {
  sendMessage: (
    options: SendMessageOptions,
  ) => Promise<Result<{ sessionId: string; content: string }>>;
  isStreaming: boolean;
  streamingContent: string;
  statusMessage: string;
  sessionId: string | null;
  error: Error | null;
  lastFailedMessageId: string | null;
  clearError: () => void;
  reset: () => void;
  abort: () => Promise<void>;
  resumeBufferedStream: (currentSessionId: string) => Promise<void>;
}

function extractTextFromPart(part: Part): string | null {
  if (part.type === "text") {
    return part.text;
  }
  return null;
}

function parseSSELine(line: string): StreamEvent | null {
  if (!line.startsWith("data: ")) {
    return null;
  }

  const data = line.slice(6).trim();
  if (data === "[DONE]" || data === "") {
    return null;
  }

  try {
    return JSON.parse(data) as StreamEvent;
  } catch {
    console.warn("[useOpenCodeStream] Failed to parse SSE data:", data);
    return null;
  }
}

function mapQuestionDataFromEvent(
  requestId: string,
  sessionId: string,
  questions: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description?: string }>;
    multiple?: boolean;
    custom?: boolean;
  }>,
): QuestionData {
  return {
    requestId,
    sessionId,
    questions: questions.map((q) => ({
      question: q.question,
      header: q.header,
      options: q.options.map((o) => ({
        label: o.label,
        description: o.description ?? "",
      })),
      multiple: q.multiple,
      custom: q.custom,
    })),
  };
}

export function useOpenCodeStream(
  options: UseOpenCodeStreamOptions,
): UseOpenCodeStreamReturn {
  const {
    projectId,
    onChunk,
    onStatus,
    onQuestion,
    onComplete,
    onError,
    onFileEdited,
    onPart,
    onActivity,
  } = options;

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [lastFailedMessageId, setLastFailedMessageId] = useState<string | null>(
    null,
  );

  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setLastFailedMessageId(null);
  }, []);

  const reset = useCallback(() => {
    setStreamingContent("");
    setStatusMessage("");
    setError(null);
    setIsStreaming(false);
    setLastFailedMessageId(null);
  }, []);

  const abort = useCallback(async () => {
    abortControllerRef.current?.abort();

    if (sessionId) {
      try {
        await fetch("/api/opencode/abort", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, projectId }),
        });
      } catch (err) {
        console.warn("[useOpenCodeStream] Failed to abort on server:", err);
      }
    }

    if (isMountedRef.current) {
      setIsStreaming(false);
      setStatusMessage("");
    }
  }, [sessionId, projectId]);

  const sendMessage = useCallback(
    async (
      messageOptions: SendMessageOptions,
    ): Promise<Result<{ sessionId: string; content: string }>> => {
      const { message, command } = messageOptions;

      if (!isMountedRef.current) {
        return { success: false, error: new Error("Component unmounted") };
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsStreaming(true);
      setStreamingContent("");
      setStatusMessage("");
      setError(null);

      let accumulatedContent = "";
      let currentSessionId = sessionId ?? "";
      let buffer = "";

      try {
        const response = await fetch("/api/opencode/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionId || undefined,
            projectId,
            message: command ? `${command} ${message}` : message,
            command,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          const err = new Error(`HTTP ${response.status}: ${errorText}`);
          if (isMountedRef.current) {
            setError(err);
            setIsStreaming(false);
            onError?.(err);
          }
          return { success: false, error: err };
        }

        const reader = response.body?.getReader();
        if (!reader) {
          const err = new Error("No response body");
          if (isMountedRef.current) {
            setError(err);
            setIsStreaming(false);
            onError?.(err);
          }
          return { success: false, error: err };
        }

        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (!isMountedRef.current) {
            reader.cancel();
            return { success: false, error: new Error("Component unmounted") };
          }

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            const event = parseSSELine(trimmedLine);
            if (!event) continue;

            if (isStreamMessagePartUpdated(event)) {
              onPart?.(event.part, event.delta);

              if (event.part.type === "reasoning") {
                if (isMountedRef.current) {
                  setStatusMessage("Thinking...");
                  onStatus?.("Thinking...");
                }
              } else if (event.part.type === "tool") {
                const toolName = event.part.tool || "unknown";
                const toolStatus = event.part.state.status;
                if (toolStatus === "running" && isMountedRef.current) {
                  setStatusMessage(`Using tool: ${toolName}`);
                  onStatus?.(`Using tool: ${toolName}`);
                }
              } else if (event.part.type === "text") {
                if (isMountedRef.current) {
                  setStatusMessage("Replying...");
                  onStatus?.("Replying...");
                }
              }

              if (event.delta && event.part.type === "text") {
                accumulatedContent += event.delta;
                if (isMountedRef.current) {
                  setStreamingContent(accumulatedContent);
                  onChunk?.(event.delta);
                }
              }
            } else if (isStreamQuestionAsked(event)) {
              const questionData = mapQuestionDataFromEvent(
                event.data.requestId,
                event.data.sessionId,
                event.data.questions,
              );
              onQuestion?.(questionData);
            } else if (isStreamSessionStatus(event)) {
              currentSessionId = event.sessionId;
              const statusString = event.sessionStatus.type;
              if (isMountedRef.current) {
                setStatusMessage(statusString);
                setSessionId(event.sessionId);
                onStatus?.(statusString);
              }
            } else if (isStreamError(event)) {
              const err = new Error(event.error);
              if (isMountedRef.current) {
                setError(err);
                onError?.(err);
              }
            } else if (isStreamDone(event)) {
              currentSessionId = event.sessionId;
              if (isMountedRef.current) {
                setStatusMessage("");
                setSessionId(event.sessionId);
              }
            } else if (isStreamFileEdited(event)) {
              onFileEdited?.(event.file);
            } else if (isStreamActivity(event)) {
              onActivity?.(event);
            }
          }
        }

        if (!isMountedRef.current) {
          return { success: false, error: new Error("Component unmounted") };
        }

        setIsStreaming(false);
        onComplete?.(accumulatedContent, currentSessionId);

        return {
          success: true,
          data: {
            sessionId: currentSessionId,
            content: accumulatedContent,
          },
        };
      } catch (err) {
        if (!isMountedRef.current) {
          return { success: false, error: new Error("Component unmounted") };
        }

        if (err instanceof Error && err.name === "AbortError") {
          setIsStreaming(false);
          return { success: false, error: new Error("Request aborted") };
        }

        const error = err instanceof Error ? err : new Error(String(err));
        setIsStreaming(false);
        setError(error);
        onError?.(error);
        return { success: false, error };
      }
    },
    [
      projectId,
      sessionId,
      onChunk,
      onStatus,
      onQuestion,
      onComplete,
      onError,
      onFileEdited,
      onPart,
      onActivity,
    ],
  );

  const resumeBufferedStream = useCallback(
    async (currentSessionId: string) => {
      if (!isMountedRef.current) {
        return;
      }

      let lastEventIndex = 0;

      try {
        setIsStreaming(true);

        while (true) {
          const response = await fetch(
            `/api/opencode/buffer?sessionId=${encodeURIComponent(currentSessionId)}&lastEventIndex=${lastEventIndex}`,
          );

          if (!response.ok) {
            console.warn("[useOpenCodeStream] Failed to fetch buffered events");
            break;
          }

          const data = await response.json();
          const { events, isComplete, nextEventIndex } = data;

          for (const event of events) {
            if (!isMountedRef.current) break;

            if (isStreamMessagePartUpdated(event)) {
              onPart?.(event.part, event.delta);

              if (event.delta && event.part.type === "text") {
                setStreamingContent((prev) => prev + (event.delta || ""));
                onChunk?.(event.delta);
              }
            } else if (isStreamQuestionAsked(event)) {
              const questionData = mapQuestionDataFromEvent(
                event.data.requestId,
                event.data.sessionId,
                event.data.questions,
              );
              onQuestion?.(questionData);
            } else if (isStreamSessionStatus(event)) {
              if (isMountedRef.current) {
                setStatusMessage(event.sessionStatus.type);
                onStatus?.(event.sessionStatus.type);
              }
            } else if (isStreamError(event)) {
              const err = new Error(event.error);
              if (isMountedRef.current) {
                setError(err);
                onError?.(err);
              }
              break;
            } else if (isStreamDone(event)) {
              if (isMountedRef.current) {
                setStatusMessage("");
              }
              break;
            } else if (isStreamFileEdited(event)) {
              onFileEdited?.(event.file);
            } else if (isStreamActivity(event)) {
              onActivity?.(event);
            }
          }

          lastEventIndex = nextEventIndex;

          if (isComplete) {
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        if (isMountedRef.current) {
          setIsStreaming(false);
        }
      } catch (err) {
        console.error(
          "[useOpenCodeStream] Failed to resume buffered stream:",
          err,
        );
        if (isMountedRef.current) {
          setIsStreaming(false);
        }
      }
    },
    [
      onChunk,
      onStatus,
      onQuestion,
      onComplete,
      onError,
      onFileEdited,
      onPart,
      onActivity,
    ],
  );

  return {
    sendMessage,
    isStreaming,
    streamingContent,
    statusMessage,
    sessionId,
    error,
    lastFailedMessageId,
    clearError,
    reset,
    abort,
    resumeBufferedStream,
  };
}
