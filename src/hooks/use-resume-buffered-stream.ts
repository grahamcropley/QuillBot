"use client";

import { useEffect, useRef } from "react";
import type { UseOpenCodeStreamReturn } from "./use-opencode-stream";

export function useResumeBufferedStream(
  stream: UseOpenCodeStreamReturn,
  projectId: string,
  enabled: boolean = true,
): void {
  const isResumingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !stream.sessionId || stream.isStreaming) return;

    if (isResumingRef.current) return;

    const sessionId = stream.sessionId;

    const checkAndResume = async (): Promise<void> => {
      try {
        const response = await fetch(
          `/api/opencode/buffer?sessionId=${encodeURIComponent(sessionId)}`,
        );

        if (!response.ok) return;

        const data = (await response.json()) as {
          events: unknown[];
          isComplete: boolean;
        };
        const { events } = data;

        if (events.length > 0) {
          console.log(
            "[useResumeBufferedStream] Found buffered events, resuming stream",
          );
          isResumingRef.current = true;
          try {
            await stream.resumeBufferedStream(sessionId);
          } finally {
            isResumingRef.current = false;
          }
        }
      } catch (error) {
        console.warn(
          "[useResumeBufferedStream] Failed to check buffered events:",
          error,
        );
        isResumingRef.current = false;
      }
    };

    const timer = setTimeout(checkAndResume, 500);
    return () => {
      clearTimeout(timer);
    };
  }, [
    stream.sessionId,
    stream.isStreaming,
    stream.resumeBufferedStream,
    projectId,
    enabled,
  ]);
}
