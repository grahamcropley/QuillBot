"use client";

import {
  useState,
  useRef,
  useCallback,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  memo,
} from "react";
import { Copy, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import type { TextSelection } from "@/types";

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
  onUnsavedChangesChange?: (hasChanges: boolean) => void;
  onDiscardChanges?: (discard: () => void) => void;
}

function formatLastUpdated(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

interface HeaderProps {
  hasUnsavedChanges: boolean;
  lastUpdated: Date | null | undefined;
  copied: boolean;
  onDiscard: () => void;
  onSave: () => void;
  onCopy: () => void;
}

const EditorHeader = memo(function EditorHeader({
  hasUnsavedChanges,
  lastUpdated,
  copied,
  onDiscard,
  onSave,
  onCopy,
}: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="flex items-center gap-2">
        {hasUnsavedChanges && (
          <>
            <Button size="sm" onClick={onDiscard} variant="secondary">
              Discard
            </Button>
            <Button size="sm" onClick={onSave} disabled={!hasUnsavedChanges}>
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
        {lastUpdated && (
          <span className="text-xs text-gray-400 dark:text-gray-600">
            Updated {formatLastUpdated(lastUpdated)}
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={onCopy}>
          {copied ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
});

export function MarkdownPreview({
  content,
  onContentChange,
  onTextSelect,
  isEditable = true,
  isOpenCodeBusy = false,
  lastUpdated,
  onUnsavedChangesChange,
  onDiscardChanges,
}: MarkdownPreviewProps) {
  const [editContent, setEditContent] = useState(content);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastSyncedContentRef = useRef(content);
  const theme = useTheme();

  useEffect(() => {
    setEditContent(content);
    lastSyncedContentRef.current = content;
    setHasUnsavedChanges(false);
  }, [content]);

  useEffect(() => {
    onUnsavedChangesChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onUnsavedChangesChange]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(editContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [editContent]);

  const handleEditorChange = useCallback((newContent: string) => {
    setEditContent(newContent);
    const isDirty = newContent !== lastSyncedContentRef.current;
    setHasUnsavedChanges(isDirty);
  }, []);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const timer = setTimeout(() => {
      onContentChange?.(editContent);
      lastSyncedContentRef.current = editContent;
      setHasUnsavedChanges(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [editContent, hasUnsavedChanges, onContentChange]);

  const handleSaveEdit = useCallback(() => {
    onContentChange?.(editContent);
    lastSyncedContentRef.current = editContent;
    setHasUnsavedChanges(false);
  }, [editContent, onContentChange]);

  const handleDiscardChanges = useCallback(() => {
    setEditContent(lastSyncedContentRef.current);
    setHasUnsavedChanges(false);
  }, []);

  useEffect(() => {
    onDiscardChanges?.(handleDiscardChanges);
  }, [handleDiscardChanges, onDiscardChanges]);

  const canEdit = isEditable && !isOpenCodeBusy;

  const headerProps = useMemo(
    () => ({
      hasUnsavedChanges,
      lastUpdated,
      copied,
      onDiscard: handleDiscardChanges,
      onSave: handleSaveEdit,
      onCopy: handleCopy,
    }),
    [
      hasUnsavedChanges,
      lastUpdated,
      copied,
      handleDiscardChanges,
      handleSaveEdit,
      handleCopy,
    ],
  );

  return (
    <div className="flex flex-col h-full border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
      <EditorHeader {...headerProps} />

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
    </div>
  );
}
