"use client";

import { useEffect } from "react";
import type { UseOpenCodeStreamReturn } from "./use-opencode-stream";

export function useResumeBufferedStream(
  stream: UseOpenCodeStreamReturn,
  projectId: string,
  enabled: boolean = true,
): void {
  useEffect(() => {
    if (!enabled || !stream.sessionId) return;

    const checkAndResume = async (): Promise<void> => {
      try {
        const sessionId = stream.sessionId;
        const response = await fetch(
          `/api/opencode/buffer?sessionId=${encodeURIComponent(sessionId || "")}`,
        );

        if (!response.ok) return;

        const data = (await response.json()) as {
          events: unknown[];
          isComplete: boolean;
        };
        const { events, isComplete } = data;

        if (events.length > 0 && !isComplete && sessionId) {
          console.log(
            "[useResumeBufferedStream] Found buffered events, resuming stream",
          );
          await stream.resumeBufferedStream(sessionId);
        }
      } catch (error) {
        console.warn(
          "[useResumeBufferedStream] Failed to check buffered events:",
          error,
        );
      }
    };

    const timer = setTimeout(checkAndResume, 500);
    return () => {
      clearTimeout(timer);
    };
  }, [stream, projectId, enabled]);
}
