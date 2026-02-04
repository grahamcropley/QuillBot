"use client";

import { useState, useRef, useCallback, lazy, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Edit3, Eye, Copy, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import type { TextSelection } from "@/types";
import { clsx } from "clsx";

const MarkdownEditor = lazy(() =>
  import("@/components/editor").then((mod) => ({
    default: mod.MarkdownEditor,
  })),
);

interface MarkdownPreviewProps {
  content: string;
  onContentChange?: (content: string) => void;
  onTextSelect?: (selection: TextSelection) => void;
  isEditable?: boolean;
  isOpenCodeBusy?: boolean;
  lastUpdated?: Date | null;
}

type ViewMode = "preview" | "edit";

function formatLastUpdated(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function MarkdownPreview({
  content,
  onContentChange,
  onTextSelect,
  isEditable = true,
  isOpenCodeBusy = false,
  lastUpdated,
}: MarkdownPreviewProps) {
  const [viewMode] = useState<ViewMode>("edit");
  const [showPreview, setShowPreview] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const lastSyncedContentRef = useRef(content);
  const theme = useTheme();

  const handleTextSelection = useCallback(() => {
    if (!onTextSelect || !previewRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const range = selection.getRangeAt(0);
    const previewElement = previewRef.current;

    if (!previewElement.contains(range.commonAncestorContainer)) return;

    const textBefore = content.substring(0, content.indexOf(selectedText));
    const linesBeforeSelection = textBefore.split("\n");
    const startLine = linesBeforeSelection.length;
    const endLine = startLine + selectedText.split("\n").length - 1;
    const startOffset = textBefore.length;

    onTextSelect({
      text: selectedText,
      startLine,
      endLine,
      startOffset,
      endOffset: startOffset + selectedText.length,
    });
  }, [content, onTextSelect]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const handleEditorChange = useCallback((newContent: string) => {
    setEditContent(newContent);
    setHasUnsavedChanges(newContent !== lastSyncedContentRef.current);
  }, []);

  const handleSaveEdit = useCallback(() => {
    onContentChange?.(editContent);
    lastSyncedContentRef.current = editContent;
    setHasUnsavedChanges(false);
  }, [editContent, onContentChange]);

  const handleDiscardChanges = useCallback(() => {
    setEditContent(lastSyncedContentRef.current);
    setHasUnsavedChanges(false);
  }, []);

  const canEdit = isEditable && !isOpenCodeBusy;

  return (
    <div className="flex flex-col h-full border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              className={clsx(
                "px-3 py-1.5 text-sm rounded-md transition-colors",
                viewMode === "edit"
                  ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200",
              )}
            >
              <Edit3 className="w-4 h-4 inline mr-1" />
              Edit
            </button>
          )}
          {hasUnsavedChanges && viewMode === "edit" && (
            <>
              <Button
                size="sm"
                onClick={handleDiscardChanges}
                variant="secondary"
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={!hasUnsavedChanges}
              >
                Save
              </Button>
            </>
          )}
          {hasUnsavedChanges && (
            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
              <AlertCircle className="w-3 h-3" />
              Unsaved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && viewMode === "edit" && (
            <span className="text-xs text-gray-400 dark:text-gray-600">
              Updated {formatLastUpdated(lastUpdated)}
            </span>
          )}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={clsx(
              "p-2 rounded-md transition-colors",
              showPreview
                ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200",
            )}
            title={showPreview ? "Hide preview" : "Show preview"}
          >
            <Eye className="w-4 h-4" />
          </button>
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {viewMode === "edit" ? (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-hidden">
              {showPreview ? (
                <div className="h-full flex">
                  <div className="flex-1 overflow-hidden border-r border-gray-200 dark:border-gray-800">
                    <Suspense
                      fallback={
                        <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-600">
                          Loading editor...
                        </div>
                      }
                    >
                      <MarkdownEditor
                        content={editContent}
                        onChange={handleEditorChange}
                        onSave={handleSaveEdit}
                        disabled={!canEdit}
                        theme={theme}
                      />
                    </Suspense>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 prose prose-sm max-w-none">
                    {editContent ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {editContent}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-gray-400 dark:text-gray-600 italic">
                        No content yet. Start editing to see preview.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <Suspense
                  fallback={
                    <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-600">
                      Loading editor...
                    </div>
                  }
                >
                  <MarkdownEditor
                    content={editContent}
                    onChange={handleEditorChange}
                    onSave={handleSaveEdit}
                    disabled={!canEdit}
                    theme={theme}
                  />
                </Suspense>
              )}
            </div>
          </div>
        ) : (
          <div
            ref={previewRef}
            onMouseUp={handleTextSelection}
            className={clsx(
              "h-full overflow-y-auto p-6 prose prose-sm max-w-none",
              theme === "dark" && "dark",
            )}
          >
            {content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            ) : (
              <p className="text-gray-400 dark:text-gray-600 italic">
                No content yet. Start a conversation to generate content.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
