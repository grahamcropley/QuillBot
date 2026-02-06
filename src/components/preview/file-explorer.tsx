"use client";

import { File, FileText, Folder, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { clsx } from "clsx";
import type { FileInfo } from "@/hooks/use-file-watcher";

interface FileExplorerProps {
  files: FileInfo[];
  selectedFile: string | null;
  onSelectFile: (fileName: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileName: string, isDirectory: boolean) {
  if (isDirectory) return Folder;
  if (fileName.endsWith(".md") || fileName.endsWith(".markdown"))
    return FileText;
  return File;
}

export function FileExplorer({
  files,
  selectedFile,
  onSelectFile,
  onRefresh,
  isLoading,
}: FileExplorerProps) {
  const markdownFiles = files.filter(
    (f) =>
      !f.isDirectory &&
      (f.name.endsWith(".md") || f.name.endsWith(".markdown")),
  );
  const otherFiles = files.filter((f) => !markdownFiles.includes(f));

  return (
    <div className="flex flex-col h-full border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-50">
          Documents
        </h3>
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={clsx("w-4 h-4", isLoading && "animate-spin")}
            />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 p-6 text-center">
            <Folder className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">No files yet</p>
            <p className="text-xs mt-1">Ask OpenCode to create files</p>
          </div>
        ) : (
          <div className="p-1.5">
            {markdownFiles.length > 0 && (
              <div className="mb-2">
                <div className="space-y-0.5 mt-0.5">
                  {markdownFiles.map((file) => {
                    const Icon = getFileIcon(file.name, file.isDirectory);
                    const isSelected = selectedFile === file.name;

                    return (
                      <button
                        key={file.name}
                        onClick={() => onSelectFile(file.name)}
                        className={clsx(
                          "w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs transition-colors",
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-100 font-medium"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
                        )}
                      >
                        <Icon
                          className={clsx(
                            "w-4 h-4 flex-shrink-0",
                            isSelected
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-gray-400 dark:text-gray-600",
                          )}
                        />
                        <span className="flex-1 truncate text-left">
                          {file.name}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-600">
                          {formatFileSize(file.size)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {otherFiles.length > 0 && (
              <div>
                <div className="px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Other Files
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {otherFiles.map((file) => {
                    const Icon = getFileIcon(file.name, file.isDirectory);

                    return (
                      <div
                        key={file.name}
                        className="flex items-center gap-2 px-2 py-1 text-xs text-gray-600 dark:text-gray-400"
                      >
                        <Icon className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-600" />
                        <span className="flex-1 truncate">{file.name}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-600">
                          {file.isDirectory ? "—" : formatFileSize(file.size)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
