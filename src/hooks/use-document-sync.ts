"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Result } from "@/types";

interface UseDocumentSyncOptions {
  /** Polling interval in milliseconds (default: 500) */
  pollInterval?: number;
  /** Debounce delay for updates in milliseconds (default: 300) */
  debounceDelay?: number;
  /** Whether polling is enabled (default: true) */
  enabled?: boolean;
}

interface UseDocumentSyncReturn {
  /** Current document content */
  content: string;
  /** Whether the hook is currently fetching */
  isLoading: boolean;
  /** Last successful update timestamp */
  lastUpdated: Date | null;
  /** Error from last fetch attempt */
  error: Error | null;
  /** Manually trigger a refresh */
  refresh: () => Promise<void>;
}

async function fetchDocument(projectId: string): Promise<Result<string>> {
  try {
    const response = await fetch(`/api/opencode/document/${projectId}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return { success: false, error: new Error(`HTTP ${response.status}`) };
    }

    const data = await response.json();
    return { success: true, data: data.content || "" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export function useDocumentSync(
  projectId: string | null,
  options: UseDocumentSyncOptions = {},
): UseDocumentSyncReturn {
  const { pollInterval = 500, debounceDelay = 300, enabled = true } = options;

  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const lastContentRef = useRef<string>("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const updateContent = useCallback(
    (newContent: string) => {
      if (newContent !== lastContentRef.current) {
        lastContentRef.current = newContent;

        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setContent(newContent);
            setLastUpdated(new Date());
          }
        }, debounceDelay);
      }
    },
    [debounceDelay],
  );

  const refresh = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    const result = await fetchDocument(projectId);

    if (!isMountedRef.current) return;

    setIsLoading(false);

    if (result.success) {
      updateContent(result.data);
    } else {
      setError(result.error);
    }
  }, [projectId, updateContent]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!projectId || !enabled) {
      return;
    }

    const doFetch = async () => {
      if (!isMountedRef.current) return;

      setIsLoading(true);
      setError(null);

      const result = await fetchDocument(projectId);

      if (!isMountedRef.current) return;

      setIsLoading(false);

      if (result.success) {
        updateContent(result.data);
      } else {
        setError(result.error);
      }
    };

    doFetch();

    const intervalId = setInterval(doFetch, pollInterval);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [projectId, pollInterval, enabled, updateContent]);

  return {
    content,
    isLoading,
    lastUpdated,
    error,
    refresh,
  };
}
