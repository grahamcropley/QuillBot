"use client";

import { useCallback, useRef, useEffect } from "react";
import type { Result } from "@/types";

interface UseAgentChatInitialMessageOptions {
  projectId: string;
  sessionId: string;
  directoryPath: string;
  onSuccess?: (newSessionId: string) => void;
  onError?: (error: Error) => void;
}

interface SendInitialMessageOptions {
  content: string;
  command?: string;
  commandArgs?: string;
}

export function useAgentChatInitialMessage(
  options: UseAgentChatInitialMessageOptions,
) {
  const { projectId, sessionId, directoryPath, onSuccess, onError } = options;

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const sendInitialMessage = useCallback(
    async (
      messageOptions: SendInitialMessageOptions,
    ): Promise<Result<{ sessionId: string }>> => {
      const { content, command, commandArgs } = messageOptions;

      if (!isMountedRef.current) {
        return { success: false, error: new Error("Component unmounted") };
      }

      try {
        const createSession = async () => {
          const createSessionResponse = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: `Project ${projectId}`,
              directory: directoryPath,
            }),
          });

          if (!createSessionResponse.ok) {
            throw new Error(
              `Failed to create session: HTTP ${createSessionResponse.status}`,
            );
          }

          const sessionData = (await createSessionResponse.json()) as {
            id?: string;
          };

          if (!sessionData.id) {
            throw new Error("Failed to create session: missing id");
          }

          if (isMountedRef.current) {
            onSuccess?.(sessionData.id);
          }

          return sessionData.id;
        };

        let effectiveSessionId = sessionId;
        if (!effectiveSessionId) {
          effectiveSessionId = await createSession();
        }

        const messageBody: {
          content: string;
          displayContent?: string;
          contextParts?: Array<{
            type: string;
            label: string;
            content: string;
          }>;
        } = {
          content,
        };

        if (command === "write-content" && commandArgs) {
          const displayContent = content;
          const contextContent = `Command: ${command}\nArgs: ${commandArgs}`;

          messageBody.displayContent = displayContent;
          messageBody.contextParts = [
            {
              type: "command-context",
              label: "Content Creation Instructions",
              content: contextContent,
            },
          ];

          messageBody.content = `${contextContent}\n\nBrief:\n${content}`;
        }

        const sendMessage = async (nextSessionId: string) => {
          return fetch(
            `/api/sessions/${encodeURIComponent(nextSessionId)}/messages`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(messageBody),
            },
          );
        };

        let messageResponse = await sendMessage(effectiveSessionId);

        // If the sessionId is persisted in our project store but no longer exists in OpenCode
        // (e.g. after opencode restarts), recreate the session and retry once.
        if (messageResponse.status === 404) {
          effectiveSessionId = await createSession();
          messageResponse = await sendMessage(effectiveSessionId);
        }

        if (!messageResponse.ok) {
          const errorText = await messageResponse.text();
          throw new Error(
            `Failed to send message: HTTP ${messageResponse.status}: ${errorText}`,
          );
        }

        if (isMountedRef.current) {
          return {
            success: true,
            data: { sessionId: effectiveSessionId },
          };
        }

        return {
          success: false,
          error: new Error("Component unmounted"),
        };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (isMountedRef.current) {
          onError?.(error);
        }
        return { success: false, error };
      }
    },
    [projectId, sessionId, directoryPath, onSuccess, onError],
  );

  return {
    sendInitialMessage,
  };
}
