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
  Code,
  History,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Button } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { markdownToHtml } from "@/lib/markdown-to-html";
import { useProjectStore } from "@/stores/project-store";
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
  /**
   * Key for the currently displayed document (e.g. file name). Used to reset
   * UI-only state when switching between files.
   */
  documentKey?: string;
  /**
   * Autosave hook. Called on a debounce while editing the latest view.
   * This should write to disk so OpenCode and the UI stay in sync.
   */
  onContentChange?: (content: string) => void;
  /**
   * Baseline snapshot content (latest saved version). Used to determine
   * whether there are changes to save/discard.
   */
  baselineContent?: string;
  /**
   * Create a new version snapshot ("Save" in the versioning sense).
   */
  onCreateSnapshot?: (content: string) => boolean | Promise<boolean>;
  /**
   * Revert working file to baseline ("Discard" in the versioning sense).
   */
  onDiscardToBaseline?: (baseline: string) => void | Promise<void>;
  onTextSelect?: (selection: TextSelection) => void;
  isEditable?: boolean;
  isOpenCodeBusy?: boolean;
  baselineReady?: boolean;
  /**
   * Source attribution for external disk updates while viewing the latest
   * version. Typically "ai" only when the OpenCode server has written the file.
   */
  liveExternalUpdateSource?: "ai" | "system";
  lastUpdated?: Date | null;
  lastModifiedByName?: string;
  versions?: { id: string; timestamp: Date; author: string; label?: string }[];
  latestVersionId?: string | null;
  selectedVersionId?: string;
  onSelectVersion?: (versionId: string) => void;
  onReturnToLatest?: () => void;
  hasNewerLiveUpdates?: boolean;
  onUnsavedChangesChange?: (hasChanges: boolean) => void;
  onDiscardChanges?: (discard: () => void) => void;
  onSelectionExpand?: () => void;
  onSelectionReduce?: () => void;
  onSelectionImprovePoint?: () => void;
}

export interface MarkdownPreviewHandle {
  findAndHighlight: (excerpt: string) => boolean;
  flushPendingWrites: () => void;
  saveSnapshot: () => Promise<boolean>;
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
  lastModifiedByName?: string;
  versions?: { id: string; timestamp: Date; author: string; label?: string }[];
  latestVersionId?: string | null;
  selectedVersionId?: string;
  onSelectVersion?: (versionId: string) => void;
  onReturnToLatest?: () => void;
  hasNewerLiveUpdates: boolean;
  isViewingLatest: boolean;
  copied: boolean;
  copiedHtml: boolean;
  isPreviewMode: boolean;
  onDiscard: () => void;
  onSave: () => void;
  onCopy: () => void;
  onCopyHtml: () => void;
  onTogglePreview: () => void;
  hasSelection: boolean;
  inMarkedSection: boolean;
  onMark: () => void;
  onClear: () => void;
  showSelectionActions: boolean;
  selectionActionsDisabled: boolean;
  onExpandSelection: () => void;
  onReduceSelection: () => void;
  onImprovePointSelection: () => void;
}

const EditorHeader = memo(function EditorHeader({
  hasUnsavedChanges,
  lastUpdated,
  lastModifiedByName,
  versions,
  latestVersionId,
  selectedVersionId,
  onSelectVersion,
  onReturnToLatest,
  hasNewerLiveUpdates,
  isViewingLatest,
  copied,
  copiedHtml,
  isPreviewMode,
  onDiscard,
  onSave,
  onCopy,
  onCopyHtml,
  onTogglePreview,
  hasSelection,
  inMarkedSection,
  onMark,
  onClear,
  showSelectionActions,
  selectionActionsDisabled,
  onExpandSelection,
  onReduceSelection,
  onImprovePointSelection,
}: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 relative z-10">
      <div className="flex items-center gap-2">
        {isViewingLatest && hasUnsavedChanges && (
          <>
            <Button size="sm" onClick={onDiscard} variant="secondary">
              Discard
            </Button>
            <Button size="sm" onClick={onSave} disabled={!hasUnsavedChanges}>
              Save
            </Button>
          </>
        )}
        {!isViewingLatest && (
          <>
            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
              <AlertCircle className="w-3 h-3" />
              Viewing older version
            </span>
            {hasNewerLiveUpdates && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Newer updates available
              </span>
            )}
            <Button size="sm" onClick={onSave} variant="secondary">
              Continue from here
            </Button>
          </>
        )}
        {isViewingLatest && hasUnsavedChanges && (
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
        {showSelectionActions && (
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={onExpandSelection}
              disabled={selectionActionsDisabled}
            >
              Expand
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onReduceSelection}
              disabled={selectionActionsDisabled}
            >
              Reduce
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onImprovePointSelection}
              disabled={selectionActionsDisabled}
            >
              Improve Point
            </Button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {versions && versions.length > 0 && (
          <>
            <div className="relative flex items-center group">
              <History className="w-3.5 h-3.5 text-gray-500 absolute left-2 pointer-events-none z-10" />
              <select
                className="pl-7 pr-7 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md appearance-none hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors cursor-pointer text-gray-700 dark:text-gray-200"
                value={selectedVersionId}
                onChange={(e) => onSelectVersion?.(e.target.value)}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label ?? v.id} - {formatLastUpdated(v.timestamp)}
                    {v.id === latestVersionId ? " (Latest)" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 pointer-events-none z-10" />
            </div>

            {latestVersionId && selectedVersionId !== latestVersionId && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onReturnToLatest}
                title="Return to latest version"
                className="text-xs px-2"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Latest
              </Button>
            )}

            <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-2" />
          </>
        )}

        {lastUpdated && (
          <div className="flex flex-col items-end mr-2 text-right">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider leading-none mb-0.5">
              Last update
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400 leading-none">
              {formatLastUpdated(lastUpdated)}
              {lastModifiedByName && (
                <span className="text-gray-400 ml-1">
                  by {lastModifiedByName}
                </span>
              )}
            </span>
          </div>
        )}

        {lastUpdated && (
          <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-1" />
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
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopy}
          title="Copy markdown"
        >
          {copied ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopyHtml}
          title="Copy HTML"
        >
          {copiedHtml ? (
            <Check className="w-4 h-4" />
          ) : (
            <Code className="w-4 h-4" />
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
    documentKey,
    onContentChange,
    baselineContent,
    onCreateSnapshot,
    onDiscardToBaseline,
    onTextSelect,
    isEditable = true,
    isOpenCodeBusy = false,
    baselineReady = true,
    liveExternalUpdateSource = "system",
    lastUpdated,
    lastModifiedByName,
    versions,
    latestVersionId,
    selectedVersionId,
    onSelectVersion,
    onReturnToLatest,
    hasNewerLiveUpdates = false,
    onUnsavedChangesChange,
    onDiscardChanges,
    onSelectionExpand,
    onSelectionReduce,
    onSelectionImprovePoint,
  },
  ref,
) {
  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [editContent, setEditContent] = useState(content);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const baselineContentRef = useRef<string | null>(baselineContent ?? null);
  const [copied, setCopied] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const lastSyncedContentRef = useRef(content);
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const pendingAutosaveContentRef = useRef<string | null>(null);
  const lastEditSourceRef = useRef<"user" | "external">("external");
  const lastDocumentKeyRef = useRef<string | undefined>(documentKey);
  const pendingDocumentSwitchRef = useRef(false);
  const pendingDocumentSwitchTimerRef = useRef<number | null>(null);
  const latestCachedContentRef = useRef<string | null>(null);
  const latestCachedHighlightsRef = useRef<{
    user: Array<[number, number]>;
    ai: Array<[number, number]>;
  } | null>(null);
  const wasViewingLatestRef = useRef<boolean>(true);
  const [externalUpdateOverride, setExternalUpdateOverride] = useState<
    "ai" | "system" | null
  >(null);
  const theme = useTheme();
  const markedSelections = useProjectStore((state) => state.markedSelections);

  useEffect(() => {
    lastEditSourceRef.current = "external";
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    pendingAutosaveContentRef.current = null;

    setEditContent(content);
    lastSyncedContentRef.current = content;

    if (pendingDocumentSwitchRef.current) {
      editorRef.current?.clearChangeHighlights?.();

      if (pendingDocumentSwitchTimerRef.current) {
        window.clearTimeout(pendingDocumentSwitchTimerRef.current);
      }

      // Keep suppressing external attribution until the content settles.
      pendingDocumentSwitchTimerRef.current = window.setTimeout(() => {
        pendingDocumentSwitchTimerRef.current = null;
        pendingDocumentSwitchRef.current = false;
        setExternalUpdateOverride(null);
        editorRef.current?.clearChangeHighlights?.();
      }, 400);

      return () => {
        if (pendingDocumentSwitchTimerRef.current) {
          window.clearTimeout(pendingDocumentSwitchTimerRef.current);
          pendingDocumentSwitchTimerRef.current = null;
        }
      };
    }
  }, [content]);

  useEffect(() => {
    if (!documentKey) return;
    const last = lastDocumentKeyRef.current;
    if (last === documentKey) return;

    lastDocumentKeyRef.current = documentKey;
    pendingDocumentSwitchRef.current = true;

    if (pendingDocumentSwitchTimerRef.current) {
      window.clearTimeout(pendingDocumentSwitchTimerRef.current);
      pendingDocumentSwitchTimerRef.current = null;
    }

    // Prevent a file load from being attributed as an AI edit.
    setExternalUpdateOverride("system");
    editorRef.current?.clearChangeHighlights?.();
    latestCachedContentRef.current = null;
    latestCachedHighlightsRef.current = null;
    wasViewingLatestRef.current = true;
    lastEditSourceRef.current = "external";
    setHasUnsavedChanges(false);
  }, [documentKey]);

  useEffect(() => {
    baselineContentRef.current = baselineContent ?? null;
  }, [baselineContent]);

  useEffect(() => {
    onUnsavedChangesChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onUnsavedChangesChange]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(editContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [editContent]);

  const handleCopyHtml = useCallback(async () => {
    const html = markdownToHtml(editContent);
    try {
      const htmlBlob = new Blob([html], { type: "text/html" });
      const textBlob = new Blob([html], { type: "text/plain" });
      const data = [
        new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        }),
      ];
      await navigator.clipboard.write(data);
    } catch {
      // Fallback for browsers that don't support ClipboardItem
      await navigator.clipboard.writeText(html);
    }
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  }, [editContent]);

  const handleTogglePreview = useCallback(() => {
    setIsPreviewMode((prev) => !prev);
  }, []);

  const handleEditorChange = useCallback((newContent: string) => {
    lastEditSourceRef.current = "user";
    setEditContent(newContent);
  }, []);

  const flushPendingWrites = useCallback(() => {
    if (!onContentChange) return;
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const pending = pendingAutosaveContentRef.current;
    if (pending !== null) {
      pendingAutosaveContentRef.current = null;
      onContentChange(pending);
    }
  }, [onContentChange]);

  const isViewingLatest =
    !latestVersionId || selectedVersionId === latestVersionId;

  useEffect(() => {
    if (!isViewingLatest) {
      setHasUnsavedChanges(false);
      return;
    }
    if (!baselineReady) {
      setHasUnsavedChanges(false);
      return;
    }
    const baseline = baselineContent ?? baselineContentRef.current;
    if (baseline === null) {
      setHasUnsavedChanges(false);
      return;
    }
    setHasUnsavedChanges(editContent !== baseline);
  }, [editContent, isViewingLatest, baselineContent, baselineReady]);

  useEffect(() => {
    const wasViewingLatest = wasViewingLatestRef.current;

    wasViewingLatestRef.current = isViewingLatest;

    if (wasViewingLatest && !isViewingLatest) {
      latestCachedContentRef.current = editContent;
      latestCachedHighlightsRef.current =
        editorRef.current?.getChangeHighlights?.() ?? null;
    }

    if (!wasViewingLatest && isViewingLatest) {
      // Prevent a full-doc swap from being classified as an AI edit.
      setExternalUpdateOverride("system");
      const handle = window.setTimeout(() => {
        setExternalUpdateOverride(null);
        const cached = latestCachedHighlightsRef.current;
        if (!cached) return;
        // Only restore if we returned to the same content.
        if (latestCachedContentRef.current === editContent) {
          editorRef.current?.setChangeHighlights?.(cached);
        } else {
          editorRef.current?.clearChangeHighlights?.();
        }
      }, 0);

      return () => {
        window.clearTimeout(handle);
      };
    }
  }, [editContent, isViewingLatest]);

  useEffect(() => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    // Never autosave if we're not in the live/latest view.
    if (!onContentChange || !isViewingLatest) {
      pendingAutosaveContentRef.current = null;
      return;
    }

    // Don't autosave while OpenCode is busy / editor is disabled.
    const canAutosave = isEditable && !isOpenCodeBusy;
    if (!canAutosave) {
      pendingAutosaveContentRef.current = null;
      return;
    }

    if (lastEditSourceRef.current !== "user") {
      pendingAutosaveContentRef.current = null;
      return;
    }

    // Only write when the user has actually changed content relative to the
    // last content we loaded from disk.
    const isDirtyRelativeToDisk = editContent !== lastSyncedContentRef.current;
    if (!isDirtyRelativeToDisk) {
      pendingAutosaveContentRef.current = null;
      return;
    }

    pendingAutosaveContentRef.current = editContent;

    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      const pending = pendingAutosaveContentRef.current;
      if (pending === null) return;
      pendingAutosaveContentRef.current = null;
      onContentChange(pending);
    }, 400);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [
    editContent,
    isEditable,
    isOpenCodeBusy,
    isViewingLatest,
    onContentChange,
  ]);

  const handleSaveSnapshot = useCallback(async (): Promise<boolean> => {
    if (!onCreateSnapshot) return false;
    const ok = await onCreateSnapshot(editContent);
    if (!ok) return false;

    baselineContentRef.current = editContent;
    setHasUnsavedChanges(false);
    editorRef.current?.clearChangeHighlights?.();
    return true;
  }, [editContent, onCreateSnapshot]);

  const handleDiscardChanges = useCallback(() => {
    lastEditSourceRef.current = "external";
    const baseline = baselineContentRef.current ?? "";
    setEditContent(baseline);
    setHasUnsavedChanges(false);
    void onDiscardToBaseline?.(baseline);
    editorRef.current?.clearChangeHighlights?.();
  }, [onDiscardToBaseline]);

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

  const canShowSelectionActions =
    markedSelections.length > 0 &&
    !!onSelectionExpand &&
    !!onSelectionReduce &&
    !!onSelectionImprovePoint;

  const headerProps = useMemo(
    () => ({
      hasUnsavedChanges,
      baselineReady,
      lastUpdated,
      lastModifiedByName,
      versions,
      latestVersionId,
      selectedVersionId,
      onSelectVersion,
      onReturnToLatest,
      hasNewerLiveUpdates,
      isViewingLatest,
      copied,
      copiedHtml,
      isPreviewMode,
      onDiscard: handleDiscardChanges,
      onSave: handleSaveSnapshot,
      onCopy: handleCopy,
      onCopyHtml: handleCopyHtml,
      onTogglePreview: handleTogglePreview,
      hasSelection: selectionState.hasSelection,
      inMarkedSection: selectionState.inMarkedSection,
      onMark: handleMark,
      onClear: handleClear,
      showSelectionActions: canShowSelectionActions,
      selectionActionsDisabled: isOpenCodeBusy,
      onExpandSelection: onSelectionExpand ?? (() => {}),
      onReduceSelection: onSelectionReduce ?? (() => {}),
      onImprovePointSelection: onSelectionImprovePoint ?? (() => {}),
    }),
    [
      hasUnsavedChanges,
      baselineReady,
      lastUpdated,
      lastModifiedByName,
      versions,
      latestVersionId,
      selectedVersionId,
      onSelectVersion,
      onReturnToLatest,
      hasNewerLiveUpdates,
      isViewingLatest,
      copied,
      copiedHtml,
      isPreviewMode,
      handleDiscardChanges,
      handleSaveSnapshot,
      handleCopy,
      handleCopyHtml,
      handleTogglePreview,
      selectionState,
      handleMark,
      handleClear,
      canShowSelectionActions,
      isOpenCodeBusy,
      onSelectionExpand,
      onSelectionReduce,
      onSelectionImprovePoint,
    ],
  );

  useImperativeHandle(
    ref,
    () => ({
      findAndHighlight: (excerpt: string) => {
        return editorRef.current?.findAndHighlight(excerpt) ?? false;
      },
      flushPendingWrites: () => {
        flushPendingWrites();
      },
      saveSnapshot: async () => {
        return await handleSaveSnapshot();
      },
    }),
    [flushPendingWrites, handleSaveSnapshot],
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
              onSave={handleSaveSnapshot}
              disabled={!canEdit}
              theme={theme}
              onSelectionChange={handleSelectionChange}
              externalUpdateSource={
                externalUpdateOverride ??
                (isViewingLatest ? liveExternalUpdateSource : "system")
              }
            />
          </Suspense>
        )}
      </div>
    </div>
  );
});
