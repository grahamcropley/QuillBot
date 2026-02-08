import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useFileWatcher } from "./use-file-watcher";

interface UseMarkdownSyncOptions {
  projectId: string;
  enabled?: boolean;
  preferredFileName?: string;
}

interface UseMarkdownSyncResult {
  content: string;
  fileName: string | null;
  isLoading: boolean;
  lastUpdated: Date | null;
  availableFiles: string[];
  selectFile: (fileName: string) => void;
}

export function useMarkdownSync({
  projectId,
  enabled = true,
  preferredFileName = "draft.md",
}: UseMarkdownSyncOptions): UseMarkdownSyncResult {
  const [currentDoc, setCurrentDoc] = useState<{
    content: string;
    fileName: string | null;
  }>({ content: "", fileName: null });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const lastModifiedMapRef = useRef(new Map<string, string>());

  const content = currentDoc.content;
  const fileName = currentDoc.fileName;

  const {
    files,
    isLoading: isLoadingFiles,
    readFile,
  } = useFileWatcher({
    projectId,
    enabled,
  });

  const markdownFiles = useMemo(
    () =>
      files
        .filter(
          (f) =>
            !f.name.startsWith(".") &&
            !f.isDirectory &&
            (f.name.endsWith(".md") || f.name.endsWith(".markdown")),
        )
        .map((f) => f.name),
    [files],
  );

  const loadFile = useCallback(
    async (targetFileName: string) => {
      setIsLoadingContent(true);
      try {
        const fileContent = await readFile(targetFileName);
        if (fileContent !== null) {
          setCurrentDoc({ content: fileContent, fileName: targetFileName });
          setLastUpdated(new Date());
        }
      } catch (error) {
        console.error("Failed to load markdown file:", error);
      } finally {
        setIsLoadingContent(false);
      }
    },
    [readFile],
  );

  useEffect(() => {
    if (!enabled || markdownFiles.length === 0) return;

    if (fileName && markdownFiles.includes(fileName)) {
      loadFile(fileName);
      return;
    }

    const targetFile = markdownFiles.includes(preferredFileName)
      ? preferredFileName
      : markdownFiles[0];

    if (targetFile) {
      loadFile(targetFile);
    }
  }, [markdownFiles, enabled, preferredFileName, fileName, loadFile]);

  useEffect(() => {
    if (!enabled || !fileName) return;

    const targetFile = files.find((file) => file.name === fileName);
    if (!targetFile) return;

    const modifiedAt =
      typeof targetFile.modifiedAt === "string"
        ? targetFile.modifiedAt
        : String(targetFile.modifiedAt);
    const lastKnown = lastModifiedMapRef.current.get(fileName);

    if (!lastKnown || lastKnown !== modifiedAt) {
      lastModifiedMapRef.current.set(fileName, modifiedAt);
      loadFile(fileName);
    }
  }, [files, enabled, fileName, loadFile]);

  const selectFile = useCallback(
    (newFileName: string) => {
      if (markdownFiles.includes(newFileName)) {
        lastModifiedMapRef.current.delete(newFileName);
        loadFile(newFileName);
      }
    },
    [markdownFiles, loadFile],
  );

  return {
    content,
    fileName,
    isLoading: isLoadingFiles || isLoadingContent,
    lastUpdated,
    availableFiles: markdownFiles,
    selectFile,
  };
}
