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
  pollInterval?: number;
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
  pollInterval = 2000,
  enabled = true,
}: UseFileWatcherOptions): UseFileWatcherResult {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    setIsLoading(true);
    fetchFiles().finally(() => setIsLoading(false));

    intervalRef.current = setInterval(fetchFiles, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchFiles, pollInterval, enabled]);

  return {
    files,
    isLoading,
    error,
    refetch: fetchFiles,
    readFile,
  };
}
