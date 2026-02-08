import { useState, useEffect, useCallback, useRef } from "react";

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

interface UseFileWatcherOptions {
  projectId: string;
  enabled?: boolean;
}

interface UseFileWatcherResult {
  files: FileInfo[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  readFile: (path: string) => Promise<string | null>;
}

export function useFileWatcher({
  projectId,
  enabled = true,
}: UseFileWatcherOptions): UseFileWatcherResult {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const fallbackIntervalRef = useRef<number | null>(null);

  const fetchFiles = useCallback(async () => {
    if (!projectId || !enabled) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/files`);

      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.statusText}`);
      }

      const data = await response.json();
      setFiles(data.files || []);
      setError(null);
    } catch (err) {
      console.error("File watcher error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch files");
    }
  }, [projectId, enabled]);

  const readFile = useCallback(
    async (path: string): Promise<string | null> => {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`,
        );

        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error(`Failed to read file: ${response.statusText}`);
        }

        const data = await response.json();
        return data.content;
      } catch (err) {
        console.error("File read error:", err);
        return null;
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (!enabled || !projectId) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (fallbackIntervalRef.current) {
        window.clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      return;
    }

    setIsLoading(true);
    fetchFiles().finally(() => setIsLoading(false));

    const es = new EventSource(`/api/projects/${projectId}/events`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setError(null);
      if (fallbackIntervalRef.current) {
        window.clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };

    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as
          | { type: "ready"; now: string }
          | { type: "file.added"; file: FileInfo }
          | { type: "file.changed"; file: FileInfo }
          | { type: "file.deleted"; path: string }
          | { type: "error"; message: string };

        if (data.type === "file.added" || data.type === "file.changed") {
          setFiles((prev) => {
            const next = prev.slice();
            const idx = next.findIndex((f) => f.path === data.file.path);
            if (idx >= 0) {
              next[idx] = data.file;
              return next;
            }
            next.push(data.file);
            return next;
          });
        }

        if (data.type === "file.deleted") {
          setFiles((prev) => prev.filter((f) => f.path !== data.path));
        }

        if (data.type === "error") {
          setError(data.message);
        }
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      // EventSource will retry automatically; surface a soft error.
      setError("Disconnected from file updates");

      // Fallback: poll occasionally in case SSE isn't supported.
      if (!fallbackIntervalRef.current) {
        fallbackIntervalRef.current = window.setInterval(() => {
          void fetchFiles();
        }, 5000);
      }
    };

    return () => {
      es.close();
      if (eventSourceRef.current === es) {
        eventSourceRef.current = null;
      }
      if (fallbackIntervalRef.current) {
        window.clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };
  }, [fetchFiles, enabled, projectId]);

  return {
    files,
    isLoading,
    error,
    refetch: fetchFiles,
    readFile,
  };
}
