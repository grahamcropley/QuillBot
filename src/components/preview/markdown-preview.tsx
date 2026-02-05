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
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Copy,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Bookmark,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Button } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import type { TextSelection } from "@/types";
import type { MarkdownEditorHandle } from "@/components/editor/markdown-editor";

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .trim();
}

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

export interface MarkdownPreviewHandle {
  findAndHighlight: (excerpt: string) => boolean;
}

function formatLastUpdated(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function getLineCol(
  text: string,
  index: number,
): { line: number; column: number } {
  const textBefore = text.slice(0, index);
  const lines = textBefore.split("\n");
  const line = lines.length;
  const column = lines[lines.length - 1].length;
  return { line, column };
}

interface HeaderProps {
  hasUnsavedChanges: boolean;
  lastUpdated: Date | null | undefined;
  copied: boolean;
  isPreviewMode: boolean;
  onDiscard: () => void;
  onSave: () => void;
  onCopy: () => void;
  onTogglePreview: () => void;
  hasSelection: boolean;
  inMarkedSection: boolean;
  onMark: () => void;
  onClear: () => void;
}

const EditorHeader = memo(function EditorHeader({
  hasUnsavedChanges,
  lastUpdated,
  copied,
  isPreviewMode,
  onDiscard,
  onSave,
  onCopy,
  onTogglePreview,
  hasSelection,
  inMarkedSection,
  onMark,
  onClear,
}: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 relative z-10">
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
        <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={inMarkedSection ? onClear : onMark}
          disabled={!hasSelection && !inMarkedSection}
          title={inMarkedSection ? "Clear selection" : "Mark selection"}
          className={`${
            !hasSelection && !inMarkedSection
              ? "opacity-50 cursor-not-allowed"
              : ""
          }`}
        >
          {inMarkedSection ? (
            <>
              <X className="w-4 h-4 text-red-500" />
              <span className="text-xs ml-1">Clear selection</span>
            </>
          ) : (
            <>
              <Bookmark
                className="w-4 h-4 text-amber-500"
                fill={hasSelection ? "currentColor" : "none"}
              />
              <span className="text-xs ml-1">Mark selection</span>
            </>
          )}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        {lastUpdated && (
          <span className="text-xs text-gray-400 dark:text-gray-600">
            Updated {formatLastUpdated(lastUpdated)}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onTogglePreview}
          title={isPreviewMode ? "Edit" : "Preview"}
        >
          {isPreviewMode ? (
            <Eye className="w-4 h-4" />
          ) : (
            <EyeOff className="w-4 h-4" />
          )}
        </Button>
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

export const MarkdownPreview = forwardRef<
  MarkdownPreviewHandle,
  MarkdownPreviewProps
>(function MarkdownPreview(
  {
    content,
    onContentChange,
    onTextSelect,
    isEditable = true,
    isOpenCodeBusy = false,
    lastUpdated,
    onUnsavedChangesChange,
    onDiscardChanges,
  },
  ref,
) {
  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [editContent, setEditContent] = useState(content);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const lastSyncedContentRef = useRef(content);
  const editorRef = useRef<MarkdownEditorHandle>(null);
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

  const handleTogglePreview = useCallback(() => {
    setIsPreviewMode((prev) => !prev);
  }, []);

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
      onUnsavedChangesChange?.(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [editContent, hasUnsavedChanges, onContentChange, onUnsavedChangesChange]);

  const handleSaveEdit = useCallback(() => {
    onContentChange?.(editContent);
    lastSyncedContentRef.current = editContent;
    setHasUnsavedChanges(false);
    onUnsavedChangesChange?.(false);
  }, [editContent, onContentChange, onUnsavedChangesChange]);

  const handleDiscardChanges = useCallback(() => {
    setEditContent(lastSyncedContentRef.current);
    setHasUnsavedChanges(false);
  }, []);

  useEffect(() => {
    onDiscardChanges?.(handleDiscardChanges);
  }, [handleDiscardChanges, onDiscardChanges]);

  const canEdit = isEditable && !isOpenCodeBusy;

  const [selectionState, setSelectionState] = useState({
    hasSelection: false,
    inMarkedSection: false,
  });

  const handleSelectionChange = useCallback((state: any) => {
    setSelectionState({
      hasSelection: state.hasSelection,
      inMarkedSection: state.inMarkedSection,
    });
  }, []);

  const handleMark = useCallback(() => {
    editorRef.current?.mark?.();
  }, []);

  const handleClear = useCallback(() => {
    editorRef.current?.clear?.();
  }, []);

  const headerProps = useMemo(
    () => ({
      hasUnsavedChanges,
      lastUpdated,
      copied,
      isPreviewMode,
      onDiscard: handleDiscardChanges,
      onSave: handleSaveEdit,
      onCopy: handleCopy,
      onTogglePreview: handleTogglePreview,
      hasSelection: selectionState.hasSelection,
      inMarkedSection: selectionState.inMarkedSection,
      onMark: handleMark,
      onClear: handleClear,
    }),
    [
      hasUnsavedChanges,
      lastUpdated,
      copied,
      isPreviewMode,
      handleDiscardChanges,
      handleSaveEdit,
      handleCopy,
      handleTogglePreview,
      selectionState,
      handleMark,
      handleClear,
    ],
  );

  useImperativeHandle(
    ref,
    () => ({
      findAndHighlight: (excerpt: string) => {
        return editorRef.current?.findAndHighlight(excerpt) ?? false;
      },
    }),
    [],
  );

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden relative"
    >
      <EditorHeader {...headerProps} />

      <div className="flex-1 overflow-hidden relative">
        {isPreviewMode ? (
          <div
            ref={previewRef}
            className="h-full overflow-auto p-6 bg-white dark:bg-gray-950 relative"
          >
            <div className="prose dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  a: ({ node, ...props }) => (
                    <a
                      {...props}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    />
                  ),
                  code: ({
                    node,
                    inline,
                    className,
                    children,
                    ...props
                  }: any) => (
                    <code
                      {...props}
                      className={
                        inline
                          ? "bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm"
                          : className
                      }
                    >
                      {children}
                    </code>
                  ),
                  pre: ({ node, ...props }) => (
                    <pre
                      {...props}
                      className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto"
                    />
                  ),
                  blockquote: ({ node, ...props }) => (
                    <blockquote
                      {...props}
                      className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic"
                    />
                  ),
                  table: ({ node, ...props }) => (
                    <table
                      {...props}
                      className="border-collapse w-full border border-gray-300 dark:border-gray-600"
                    />
                  ),
                  th: ({ node, ...props }) => (
                    <th
                      {...props}
                      className="border border-gray-300 dark:border-gray-600 p-2 bg-gray-100 dark:bg-gray-800 text-left"
                    />
                  ),
                  td: ({ node, ...props }) => (
                    <td
                      {...props}
                      className="border border-gray-300 dark:border-gray-600 p-2"
                    />
                  ),
                }}
              >
                {editContent}
              </ReactMarkdown>
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
              ref={editorRef}
              content={editContent}
              onChange={handleEditorChange}
              onSave={handleSaveEdit}
              disabled={!canEdit}
              theme={theme}
              onSelectionChange={handleSelectionChange}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
});
