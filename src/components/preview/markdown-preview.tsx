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
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
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
    setHasUnsavedChanges(false);
    setViewMode("preview");
  }, [editContent, onContentChange]);

  const handleDiscardChanges = useCallback(() => {
    setEditContent(lastSyncedContentRef.current);
    setHasUnsavedChanges(false);
    setViewMode("preview");
  }, []);

  const handleModeSwitch = useCallback(
    (mode: ViewMode) => {
      if (mode === "preview" && hasUnsavedChanges) {
        const confirm = window.confirm(
          "You have unsaved changes. Discard them?",
        );
        if (!confirm) return;
        setHasUnsavedChanges(false);
      }
      if (mode === "edit") {
        setEditContent(content);
        lastSyncedContentRef.current = content;
        setHasUnsavedChanges(false);
      }
      setViewMode(mode);
    },
    [hasUnsavedChanges, content],
  );

  const canEdit = isEditable && !isOpenCodeBusy;

  return (
    <div className="flex flex-col h-full border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <button
              onClick={() => handleModeSwitch("preview")}
              className={clsx(
                "px-3 py-1.5 text-sm rounded-md transition-colors",
                viewMode === "preview"
                  ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200",
              )}
            >
              <Eye className="w-4 h-4 inline mr-1" />
              Preview
            </button>
            {canEdit && (
              <button
                onClick={() => handleModeSwitch("edit")}
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
          </div>
          {hasUnsavedChanges && (
            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
              <AlertCircle className="w-3 h-3" />
              Unsaved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && viewMode === "preview" && (
            <span className="text-xs text-gray-400 dark:text-gray-600">
              Updated {formatLastUpdated(lastUpdated)}
            </span>
          )}
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
        {viewMode === "preview" ? (
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
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-hidden">
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
            <div className="flex justify-end gap-2 p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDiscardChanges}
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={!hasUnsavedChanges}
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
