import { useState, useCallback, useRef, useEffect } from "react";
import type {
  Message,
  MessagePart,
  SessionStatus,
  QuestionRequest,
  QuestionInfo,
  ContextItem,
} from "../AgentChat.types";

interface UseChatOptions {
  sessionId: string;
  backendUrl: string;
  directory?: string;
  onMessagesChange?: (messages: Message[]) => void;
  onStatusChange?: (status: SessionStatus) => void;
}

interface RawMessage {
  info: {
    id: string;
    sessionID: string;
    role: "user" | "assistant";
    time: { created: number; completed?: number };
    error?: { name: string; data: { message?: string } };
  };
  parts: Array<{
    id: string;
    type: string;
    text?: string;
    tool?: string;
    state?: {
      status: string;
      title?: string;
      input?: {
        [key: string]: unknown;
      };
      metadata?: {
        [key: string]: unknown;
      };
    };
  }>;
}

interface RawQuestionRequest {
  id: string;
  sessionID: string;
  questions: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description: string }>;
    multiple?: boolean;
    custom?: boolean;
  }>;
}

export interface SendMessageOptions {
  displayContent?: string;
  contextItems?: ContextItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function mergeToolPayload(
  input: Record<string, unknown> | undefined,
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!input && !metadata) return undefined;
  if (!metadata) return input;

  return {
    ...(input ?? {}),
    ...metadata,
    metadata,
  };
}

function mapParts(
  rawParts: RawMessage["parts"],
): MessagePart[] {
  return rawParts.map((p) => {
    const metadata = isRecord(p.state?.metadata) ? p.state.metadata : undefined;
    return {
      id: p.id,
      type: p.type,
      text: p.text,
      tool: p.tool,
      toolStatus: p.state?.status as MessagePart["toolStatus"],
      toolTitle: p.state?.title,
      toolInput: mergeToolPayload(p.state?.input, metadata),
    };
  });
}

interface DisplayOverride {
  displayContent: string;
  contextItemCount: number;
}

function mapMessages(
  raw: RawMessage[],
  displayOverrides?: Map<string, DisplayOverride>,
): Message[] {
  return raw.map((m) => {
    const base: Message = {
      id: m.info.id,
      sessionId: m.info.sessionID,
      role: m.info.role,
      createdAt: m.info.time.created,
      completedAt: m.info.time.completed,
      parts: mapParts(m.parts),
      error: m.info.error?.data?.message ?? m.info.error?.name,
    };

    if (displayOverrides && m.info.role === "user") {
      const textContent = m.parts
        .filter((p) => p.type === "text" && p.text)
        .map((p) => p.text!)
        .join("")
        .trim();

      for (const [key, override] of displayOverrides) {
        if (textContent.startsWith(key)) {
          base.displayContent = override.displayContent;
          base.contextItemCount = override.contextItemCount;
          displayOverrides.delete(key);
          break;
        }
      }
    }

    return base;
  });
}

function mapQuestionRequest(raw: RawQuestionRequest): QuestionRequest {
  return {
    id: raw.id,
    sessionId: raw.sessionID,
    questions: raw.questions.map((q): QuestionInfo => ({
      question: q.question,
      header: q.header,
      options: q.options,
      multiple: q.multiple,
      custom: q.custom,
    })),
  };
}

export function useChat({
  sessionId,
  backendUrl,
  directory,
  onMessagesChange,
  onStatusChange,
}: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<QuestionRequest | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pseudoMessagesRef = useRef<Message[]>([]);
  const displayOverridesRef = useRef<Map<string, DisplayOverride>>(new Map());
  const onMessagesChangeRef = useRef(onMessagesChange);
  const onStatusChangeRef = useRef(onStatusChange);

  onMessagesChangeRef.current = onMessagesChange;
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    if (!sessionId) return;

    setMessages([]);
    setError(null);
    setStatus("idle");
    setPendingQuestion(null);
    pseudoMessagesRef.current = [];

    const eventUrl = new URL(`${backendUrl}/api/sessions/${sessionId}/events`, window.location.origin);
    if (directory) {
      eventUrl.searchParams.set("directory", directory);
    }
    const eventSource = new EventSource(eventUrl.toString());

    const mergeWithPseudo = (serverMessages: Message[]): Message[] => {
      const pseudos = pseudoMessagesRef.current;
      if (pseudos.length === 0) return serverMessages;
      const merged = [...serverMessages, ...pseudos];
      merged.sort((a, b) => a.createdAt - b.createdAt);
      return merged;
    };

    const handleMessages = (raw: RawMessage[], serverOverrides?: Record<string, DisplayOverride>) => {
      if (serverOverrides) {
        for (const [key, override] of Object.entries(serverOverrides)) {
          if (!displayOverridesRef.current.has(key)) {
            displayOverridesRef.current.set(key, override);
          }
        }
      }
      const mapped = mapMessages(raw, displayOverridesRef.current);
      const merged = mergeWithPseudo(mapped);
      setMessages(merged);
      onMessagesChangeRef.current?.(merged);
    };

    eventSource.addEventListener("snapshot", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as {
        messages: RawMessage[];
        status: { type: string };
        question: RawQuestionRequest | null;
        displayOverrides?: Record<string, DisplayOverride>;
      };
      handleMessages(data.messages, data.displayOverrides);
      const newStatus = data.status.type as SessionStatus;
      setStatus(newStatus);
      onStatusChangeRef.current?.(newStatus);
      setPendingQuestion(data.question ? mapQuestionRequest(data.question) : null);
    });

    eventSource.addEventListener("messages", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as
        | RawMessage[]
        | { messages: RawMessage[]; displayOverrides?: Record<string, DisplayOverride> };

      if (Array.isArray(data)) {
        handleMessages(data);
      } else {
        handleMessages(data.messages, data.displayOverrides);
      }
    });

    eventSource.addEventListener("status", (e: MessageEvent) => {
      const raw = JSON.parse(e.data) as { type: string };
      const newStatus = raw.type as SessionStatus;
      setStatus((prev) => {
        if (prev !== newStatus) {
          onStatusChangeRef.current?.(newStatus);
        }
        return newStatus;
      });
    });

    eventSource.addEventListener("question", (e: MessageEvent) => {
      const raw = JSON.parse(e.data) as RawQuestionRequest | null;
      setPendingQuestion(raw ? mapQuestionRequest(raw) : null);
    });

    eventSource.onerror = () => {
      setError("Connection lost. Reconnecting…");
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId, backendUrl, directory]);

  const sendMessage = useCallback(
    async (content: string, options?: SendMessageOptions) => {
      if (!content.trim() || !sessionId) return;

      setIsLoading(true);
      setError(null);

      abortRef.current = new AbortController();

      if (options?.displayContent) {
        displayOverridesRef.current.set(content.trim(), {
          displayContent: options.displayContent,
          contextItemCount: options.contextItems?.length ?? 0,
        });
      } else if (options?.contextItems && options.contextItems.length > 0) {
        displayOverridesRef.current.set(content.trim(), {
          displayContent: content.trim(),
          contextItemCount: options.contextItems.length,
        });
      }

      try {
        const messageUrl = new URL(`${backendUrl}/api/sessions/${sessionId}/messages`, window.location.origin);
        if (directory) {
          messageUrl.searchParams.set("directory", directory);
        }

        const body: Record<string, unknown> = {
          content: content.trim(),
        };

        if (options?.displayContent) {
          body.displayContent = options.displayContent;
        }

        if (options?.contextItems && options.contextItems.length > 0) {
          body.contextParts = options.contextItems.map((item) => ({
            type: item.type,
            label: item.label,
            content: item.content,
          }));
        }

        const res = await fetch(
          messageUrl.toString(),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: abortRef.current.signal,
          },
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(data.error ?? `Send failed: ${res.status}`);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Failed to send message";
        setError(message);
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [sessionId, backendUrl, directory],
  );

  const answerQuestion = useCallback(
    async (requestId: string, answers: string[][]) => {
      try {
        const res = await fetch(
          `${backendUrl}/api/questions/${requestId}/reply`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answers }),
          },
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(data.error ?? `Reply failed: ${res.status}`);
        }

        setPendingQuestion(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to submit answer";
        setError(message);
      }
    },
    [backendUrl],
  );

  const addPseudoMessage = useCallback((message: Message) => {
    pseudoMessagesRef.current = [...pseudoMessagesRef.current, message];
    setMessages((prev) => {
      const serverMessages = prev.filter((m) => !m.pseudo);
      const merged = [...serverMessages, ...pseudoMessagesRef.current];
      merged.sort((a, b) => a.createdAt - b.createdAt);
      onMessagesChangeRef.current?.(merged);
      return merged;
    });
  }, []);

  const rejectQuestion = useCallback(
    async (requestId: string) => {
      try {
        const res = await fetch(
          `${backendUrl}/api/questions/${requestId}/reject`,
          {
            method: "POST",
          },
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(data.error ?? `Reject failed: ${res.status}`);
        }

        setPendingQuestion(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to reject question";
        setError(message);
      }
    },
    [backendUrl],
  );

  const cancelRequest = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  return {
    messages,
    status,
    isLoading,
    error,
    pendingQuestion,
    sendMessage,
    answerQuestion,
    rejectQuestion,
    addPseudoMessage,
    cancelRequest,
  };
}
