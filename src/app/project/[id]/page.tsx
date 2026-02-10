"use client";

import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, PenLine } from "lucide-react";
import { AgentChat } from "@agent-chat/react";
import { MarkdownPreview } from "@/components/preview";
import { AnalysisPanel } from "@/components/analysis";
import { ExportModal } from "@/components/export";
import { Modal } from "@/components/ui/modal";
import { Button, Card, CardHeader, PanelErrorBoundary } from "@/components/ui";
import { useProjectStore } from "@/stores/project-store";
import {
  useTextSelection,
  useMarkdownSync,
  useFileWatcher,
  useFileVersionHistory,
  useAgentChatInitialMessage,
} from "@/hooks";
import { analyzeContent } from "@/lib/analysis";
import {
  buildCommandArgs,
  buildImportProcessingPrompt,
} from "@/utils/prompt-builder";
import { formatSelectionsContext } from "@/utils/format-selections";
import type { TextSelection, Message, ContentType } from "@/types";
import type { MarkdownPreviewHandle } from "@/components/preview/markdown-preview";
import { FileExplorer } from "@/components/preview/file-explorer";
import { ProjectInfoModal } from "@/components/project-info-modal";

// AgentChat ContextItem type (from @agent-chat/react documentation)
interface ContextItem {
  id: string;
  type: "text-selection" | "image" | "file" | string;
  label: string;
  content: string;
}

interface ProjectInfoValues {
  name: string;
  contentType: ContentType;
  wordCount: number;
  styleHints: string;
  brief: string;
}

interface ImportMetadata {
  title: string;
  contentType: ContentType;
  targetWordCount: number;
}

const AI_EXTERNAL_UPDATE_GRACE_MS = 5000;

function parseImportMetadata(content: string): ImportMetadata | null {
  const match = content.match(
    /<import-metadata>([\s\S]*?)<\/import-metadata>/i,
  );
  if (!match?.[1]) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[1]) as {
      title?: unknown;
      contentType?: unknown;
      targetWordCount?: unknown;
    };

    const allowedContentTypes: ContentType[] = [
      "blog",
      "white-paper",
      "social-post",
      "email",
      "case-study",
      "landing-page",
    ];

    if (
      typeof parsed.title !== "string" ||
      !allowedContentTypes.includes(parsed.contentType as ContentType) ||
      typeof parsed.targetWordCount !== "number"
    ) {
      return null;
    }

    const roundedWordCount = Math.max(
      100,
      Math.round(parsed.targetWordCount / 100) * 100,
    );

    return {
      title: parsed.title.trim() || "Imported draft",
      contentType: parsed.contentType as ContentType,
      targetWordCount: roundedWordCount,
    };
  } catch {
    return null;
  }
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MarkdownPreviewHandle | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isServerErrorModalOpen, setIsServerErrorModalOpen] = useState(false);
  const [serverErrorMessage, setServerErrorMessage] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isProjectInfoModalOpen, setIsProjectInfoModalOpen] = useState(false);
  const [isSavingProjectInfo, setIsSavingProjectInfo] = useState(false);
  const [projectInfoSaveError, setProjectInfoSaveError] = useState("");
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isUnsavedChangesModalOpen, setIsUnsavedChangesModalOpen] =
    useState(false);
  const [pendingBranchSaveContent, setPendingBranchSaveContent] = useState<
    string | null
  >(null);
  const [hasUnsavedEditorChanges, setHasUnsavedEditorChanges] = useState(false);
  const [editorDiscardFn, setEditorDiscardFn] = useState<(() => void) | null>(
    null,
  );
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(0);
  const [isResizing, setIsResizing] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );
  const [pendingFileSwitch, setPendingFileSwitch] = useState<string | null>(
    null,
  );
  const [isNavigationModalOpen, setIsNavigationModalOpen] = useState(false);
  const hasInitialized = useRef<Set<string>>(new Set());
  const initialWidthSetRef = useRef(false);

  const projects = useProjectStore((state) => state.projects);
  const currentProject = projects.find((p) => p.id === projectId);
  const isHydrated = useProjectStore((state) => state.isHydrated);

  // Only enable hooks that need the project after store is hydrated and project exists
  const projectReady = isHydrated && !!currentProject;
  const fetchProjects = useProjectStore((state) => state.fetchProjects);
  const selectProject = useProjectStore((state) => state.selectProject);
  const addMessageWithDetails = useProjectStore(
    (state) => state.addMessageWithDetails,
  );
  const updateMessageStatus = useProjectStore(
    (state) => state.updateMessageStatus,
  );
  const updateDocument = useProjectStore((state) => state.updateDocument);
  const updateProjectInfo = useProjectStore((state) => state.updateProjectInfo);
  const deleteProject = useProjectStore((state) => state.deleteProject);
  const analysisMetrics = useProjectStore((state) => state.analysisMetrics);
  const setAnalysisMetrics = useProjectStore(
    (state) => state.setAnalysisMetrics,
  );
  const clearMarkedSelections = useProjectStore(
    (state) => state.clearMarkedSelections,
  );
  const markedSelections = useProjectStore((state) => state.markedSelections);

  useEffect(() => {
    if (!isHydrated) {
      fetchProjects();
    }
  }, [isHydrated, fetchProjects]);

  useEffect(() => {
    if (!containerRef.current || initialWidthSetRef.current) return;
    const width = containerRef.current.offsetWidth * 0.35;
    setLeftPanelWidth(Math.max(width, 500));
    initialWidthSetRef.current = true;
  }, []);

  const documentContent = currentProject?.documentContent || "";

  const { selection: textSelection, clearSelection: clearTextSelection } =
    useTextSelection(previewRef, documentContent);

  const {
    content: syncedContent,
    fileName: syncedFileName,
    lastUpdated: syncedLastUpdated,
    selectFile,
  } = useMarkdownSync({
    projectId,
    enabled: projectReady,
  });

  const activeFilePath = projectReady ? (syncedFileName ?? "draft.md") : null;

  const {
    record: versionRecord,
    baselineContent: baselineVersionContent,
    refresh: refreshVersionHistory,
    selectedVersionId,
    setSelectedVersionId,
    selectedVersionContent,
    loadVersionContent,
    createSnapshot,
    branchToVersion,
    setLastModified: setFileLastModified,
  } = useFileVersionHistory({
    projectId,
    filePath: activeFilePath,
    enabled: projectReady,
  });

  useEffect(() => {
    if (!projectReady || !activeFilePath) return;

    // If the file just became populated, ensure Version 1 exists and the
    // baseline content is correct.
    const fileHasContent = syncedContent.trim().length > 0;
    const needsInitialVersion =
      fileHasContent && (versionRecord?.versions.length ?? 0) === 0;
    const needsBaselineHeal = fileHasContent && baselineVersionContent === null;

    if (needsInitialVersion || needsBaselineHeal) {
      void refreshVersionHistory();
    }
  }, [
    activeFilePath,
    baselineVersionContent,
    projectReady,
    refreshVersionHistory,
    syncedContent,
    versionRecord?.versions.length,
  ]);

  useEffect(() => {
    if (!projectReady) return;
    if (!activeFilePath) return;
    if (!versionRecord?.latestVersionId) return;
    if (!selectedVersionId) return;
    if (selectedVersionId === versionRecord.latestVersionId) return;
    void loadVersionContent(selectedVersionId);
  }, [
    activeFilePath,
    loadVersionContent,
    projectReady,
    selectedVersionId,
    versionRecord?.latestVersionId,
  ]);

  const versions = useMemo(() => {
    const list = versionRecord?.versions ?? [];
    return [...list]
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((v) => ({
        id: v.id,
        timestamp: new Date(v.createdAt),
        author: v.createdBy.name,
        label: v.label,
      }));
  }, [versionRecord?.versions]);

  const latestVersionId = versionRecord?.latestVersionId ?? null;
  const isViewingLatestVersion =
    !latestVersionId || selectedVersionId === latestVersionId;

  const baselineReady =
    baselineVersionContent !== null &&
    (versionRecord?.versions.length ?? 0) > 0;

  const [liveExternalUpdateSource, setLiveExternalUpdateSource] = useState<
    "ai" | "system"
  >("system");
  const [chatStatus, setChatStatus] = useState<"idle" | "busy" | "retry">(
    "idle",
  );
  const lastBusyAtRef = useRef<number>(0);

  const prevActiveFilePathRef = useRef<string | null>(activeFilePath);
  const prevSyncedContentRef = useRef<string>(syncedContent);

  useEffect(() => {
    // File switches should never be attributed as AI edits.
    if (prevActiveFilePathRef.current !== activeFilePath) {
      setLiveExternalUpdateSource("system");
      prevSyncedContentRef.current = syncedContent;
    }
    prevActiveFilePathRef.current = activeFilePath;
  }, [activeFilePath, syncedContent]);

  useEffect(() => {
    if (syncedContent === prevSyncedContentRef.current) {
      return;
    }

    const wasRecentlyBusy =
      Date.now() - lastBusyAtRef.current <= AI_EXTERNAL_UPDATE_GRACE_MS;
    const nextSource: "ai" | "system" =
      chatStatus === "busy" || chatStatus === "retry" || wasRecentlyBusy
        ? "ai"
        : "system";

    setLiveExternalUpdateSource(nextSource);
    prevSyncedContentRef.current = syncedContent;
  }, [chatStatus, syncedContent]);

  const [hasNewerLiveUpdates, setHasNewerLiveUpdates] = useState(false);
  const lastLiveContentRef = useRef<string>("");

  useEffect(() => {
    if (!projectReady) return;

    if (isViewingLatestVersion) {
      setHasNewerLiveUpdates(false);
      lastLiveContentRef.current = syncedContent;
      return;
    }

    if (syncedContent !== lastLiveContentRef.current) {
      if (lastLiveContentRef.current) {
        setHasNewerLiveUpdates(true);
      }
      lastLiveContentRef.current = syncedContent;
    }
  }, [isViewingLatestVersion, projectReady, syncedContent]);

  const { files: projectFiles, refetch: refreshFiles } = useFileWatcher({
    projectId,
    enabled: projectReady,
  });

  // Track draft.md content separately for analysis (regardless of selected file)
  const [draftContent, setDraftContent] = useState<string>("");

  const isStreaming = chatStatus === "busy" || chatStatus === "retry";
  const streamSessionId = currentProject?.opencodeSessionId ?? null;

  const handleChatStatusChange = useCallback(
    (status: "idle" | "busy" | "retry") => {
      setChatStatus(status);
      if (status === "busy" || status === "retry") {
        lastBusyAtRef.current = Date.now();
      }
    },
    [],
  );

  const { sendInitialMessage } = useAgentChatInitialMessage({
    projectId,
    sessionId: currentProject?.opencodeSessionId || "",
    directoryPath: currentProject?.directoryPath || "",
    onSuccess: (newSessionId) => {
      void updateProjectInfo({ opencodeSessionId: newSessionId }).catch(
        (err) => {
          console.error("[ProjectPage] Failed to persist new session ID:", err);
        },
      );
    },
    onError: (error) => {
      console.error("[ProjectPage] Initial message error:", error);
      setServerErrorMessage(error.message);
      setIsServerErrorModalOpen(true);
    },
  });

  useEffect(() => {
    selectProject(projectId);
  }, [projectId, selectProject]);

  const lastSyncedContentRef = useRef<string>("");

  useEffect(() => {
    if (
      syncedContent &&
      syncedContent !== lastSyncedContentRef.current &&
      syncedContent !== currentProject?.documentContent
    ) {
      lastSyncedContentRef.current = syncedContent;
      updateDocument(syncedContent);
    }
  }, [syncedContent, currentProject?.documentContent, updateDocument]);

  // Load draft.md content for analysis (independent of selected file)
  useEffect(() => {
    if (!projectReady) return;

    const fetchDraftContent = async () => {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/files?path=draft.md`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.content) {
            setDraftContent(data.content);
          }
        } else {
          setDraftContent("");
        }
      } catch (error) {
        console.error("Failed to fetch draft.md for analysis:", error);
        setDraftContent("");
      }
    };

    fetchDraftContent();
  }, [projectId, projectReady]);

  useEffect(() => {
    if (draftContent && currentProject?.brief) {
      const metrics = analyzeContent(draftContent, currentProject.brief);
      setAnalysisMetrics(metrics);
    } else {
      setAnalysisMetrics(null);
    }
  }, [draftContent, currentProject?.brief, setAnalysisMetrics]);

  const handleSendMessage = useCallback(
    async (content: string, isInitialMessage = false, messageId?: string) => {
      if (!currentProject) return;

      const MAX_RETRY_ATTEMPTS = 3;
      let userMessageId = messageId;
      let retryAttempt = 0;

      if (userMessageId) {
        const currentMessage = currentProject.messages.find(
          (m) => m.id === userMessageId,
        );
        retryAttempt = (currentMessage?.retryAttempts || 0) + 1;

        if (retryAttempt > MAX_RETRY_ATTEMPTS) {
          updateMessageStatus(
            userMessageId,
            "failed",
            `Failed after ${MAX_RETRY_ATTEMPTS} retry attempts`,
            retryAttempt - 1,
          );
          return;
        }

        if (retryAttempt > 1) {
          updateMessageStatus(
            userMessageId,
            "retrying",
            undefined,
            retryAttempt,
          );
        }
      } else {
        const tempId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        userMessageId = tempId;
        await addMessageWithDetails({
          id: tempId,
          role: "user",
          content,
          timestamp: new Date(),
          status: "pending",
        });
      }

      editorRef.current?.flushPendingWrites?.();

      const isInitialContent =
        isInitialMessage && currentProject.messages.length === 0;
      const commandArgs =
        isInitialContent && !currentProject.reviewFilename
          ? buildCommandArgs({
              contentType: currentProject.contentType,
              wordCount: currentProject.wordCount,
              styleHints: currentProject.styleHints,
              brief: content,
            })
          : undefined;

      const result = await sendInitialMessage({
        content,
        command:
          isInitialContent && !currentProject.reviewFilename
            ? "write-content"
            : undefined,
        commandArgs,
      });

      if (result.success) {
        updateMessageStatus(userMessageId, "sent");
      } else if (userMessageId) {
        updateMessageStatus(
          userMessageId,
          "failed",
          result.error.message || "Failed to send message",
          retryAttempt,
        );
      }
    },
    [
      currentProject,
      addMessageWithDetails,
      updateMessageStatus,
      sendInitialMessage,
    ],
  );

  // Track initialization and trigger initial message send
  // Using useRef to avoid triggering re-renders
  const pendingInitialMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      currentProject &&
      currentProject.messages.length === 0 &&
      !currentProject.opencodeSessionId &&
      !isStreaming &&
      !hasInitialized.current.has(currentProject.id)
    ) {
      hasInitialized.current.add(currentProject.id);
      pendingInitialMessageRef.current = currentProject.reviewFilename
        ? buildImportProcessingPrompt(currentProject.reviewFilename)
        : currentProject.brief;
    }
  }, [currentProject, isStreaming]);

  // Handle pending initial message outside of the main effect
  useEffect(() => {
    const pendingMessage = pendingInitialMessageRef.current;
    if (pendingMessage) {
      pendingInitialMessageRef.current = null;

      const isInitialContent = currentProject?.messages.length === 0;
      const hasSession = streamSessionId || currentProject?.opencodeSessionId;

      if (isInitialContent && !hasSession) {
        const commandArgs = !currentProject?.reviewFilename
          ? buildCommandArgs({
              contentType: currentProject?.contentType || "blog",
              wordCount: currentProject?.wordCount || 1000,
              styleHints: currentProject?.styleHints || "",
              brief: pendingMessage,
            })
          : undefined;

        void sendInitialMessage({
          content: pendingMessage,
          command: !currentProject?.reviewFilename
            ? "write-content"
            : undefined,
          commandArgs,
        });
      }
    }
  }, [sendInitialMessage, currentProject, streamSessionId]);

  const handleRetryMessage = useCallback(
    async (message: Message) => {
      if (!message.error || message.role !== "user") return;

      await handleSendMessage(message.content, false, message.id);
    },
    [handleSendMessage],
  );

  const writeActiveFile = useCallback(
    async (nextContent: string) => {
      if (!activeFilePath) return;
      await fetch(`/api/projects/${projectId}/files`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: activeFilePath, content: nextContent }),
      }).catch((err) => {
        console.error("Failed to write file:", err);
      });

      // Keep project metadata up to date for draft analysis.
      if (activeFilePath === "draft.md") {
        void updateDocument(nextContent);
      }
    },
    [activeFilePath, projectId, updateDocument],
  );

  const handleCreateSnapshot = useCallback(
    async (nextContent: string): Promise<boolean> => {
      if (!activeFilePath) return false;

      if (!latestVersionId || !selectedVersionId || isViewingLatestVersion) {
        const result = await createSnapshot(nextContent);
        if (!result.success) {
          console.error("Failed to create snapshot:", result.error);
          return false;
        }
        return true;
      }

      // Historical save: prune future versions, then continue from here.
      setIsUnsavedChangesModalOpen(true);
      setPendingBranchSaveContent(nextContent);
      return false;
    },
    [
      activeFilePath,
      createSnapshot,
      isViewingLatestVersion,
      latestVersionId,
      selectedVersionId,
    ],
  );

  const startResizing = useCallback(() => {
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const resize = useCallback(
    (event: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = event.clientX - containerRect.left;
      const maxWidth = containerRect.width - 480;

      if (newWidth >= 500 && newWidth <= maxWidth) {
        setLeftPanelWidth(newWidth);
      }
    },
    [isResizing],
  );

  useEffect(() => {
    if (!isResizing) return;
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);

    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  const handleTextSelect = useCallback((selection: TextSelection) => {
    useProjectStore.getState().setTextSelection(selection);
  }, []);

  const contextItems = useMemo((): ContextItem[] => {
    return markedSelections.map((selection, index) => ({
      id: selection.id,
      type: "text-selection",
      label: `Selection ${index + 1} (Line ${selection.line}, Col ${selection.column + 1})`,
      content: `Line ${selection.line}, Col ${selection.column + 1} (${selection.length} chars): "${selection.text}"`,
    }));
  }, [markedSelections]);

  const handleClearContext = useCallback(() => {
    clearMarkedSelections();
  }, [clearMarkedSelections]);

  const buildSelectionActionMessage = useCallback(
    (instruction: string) => {
      let messageContent = instruction;

      if (markedSelections.length > 0) {
        const selectionContext = formatSelectionsContext(
          markedSelections,
          syncedFileName || "draft.md",
        );
        messageContent = selectionContext + "\n" + messageContent;
      }

      if (textSelection) {
        const selectionContext = `[Lines ${textSelection.startLine}-${textSelection.endLine}] Selected: "${textSelection.text}"\n\n`;
        messageContent = selectionContext + messageContent;
        clearTextSelection();
      }

      return messageContent;
    },
    [markedSelections, syncedFileName, textSelection, clearTextSelection],
  );

  const handleExpandSelection = useCallback(() => {
    const message = buildSelectionActionMessage(
      "Expand the highlighted sections with more detail, depth, and specific context. You can also adjust closely related or relevant sections as needed.",
    );
    void handleSendMessage(message);
  }, [buildSelectionActionMessage, handleSendMessage]);

  const handleReduceSelection = useCallback(() => {
    const message = buildSelectionActionMessage(
      "Reduce the impact and wordiness of the highlighted sections. Make them concise and straightforward. You can also adjust closely related or relevant sections as needed.",
    );
    void handleSendMessage(message);
  }, [buildSelectionActionMessage, handleSendMessage]);

  const handleImprovePointSelection = useCallback(() => {
    const message = buildSelectionActionMessage(
      "Strengthen the highlighted sections to make a clearer point and tie them into the narrative so they feel more relevant. You can also adjust closely related or relevant sections as needed.",
    );
    void handleSendMessage(message);
  }, [buildSelectionActionMessage, handleSendMessage]);

  const handleHighlightText = useCallback((excerpt: string) => {
    if (editorRef.current) {
      const found = editorRef.current.findAndHighlight(excerpt);
      if (!found) {
        console.warn("[ProjectPage] Text not found in editor:", excerpt);
      }
    }
  }, []);

  const handleDeleteProject = useCallback(() => {
    setProjectInfoSaveError("");
    setIsProjectInfoModalOpen(false);
    setIsDeleteModalOpen(true);
  }, []);

  const handleSaveProjectInfo = useCallback(
    async (values: ProjectInfoValues) => {
      setProjectInfoSaveError("");
      setIsSavingProjectInfo(true);
      try {
        await updateProjectInfo(values);
        setIsProjectInfoModalOpen(false);
      } catch (error) {
        setProjectInfoSaveError(
          error instanceof Error
            ? error.message
            : "Failed to save project details",
        );
      } finally {
        setIsSavingProjectInfo(false);
      }
    },
    [updateProjectInfo],
  );

  const handleGenerateAiSummary = useCallback(async () => {
    setProjectInfoSaveError("");
    setIsGeneratingSummary(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/ai-summary`, {
        method: "POST",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate AI summary");
      }

      return data.summary as string;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to generate AI summary";
      setProjectInfoSaveError(errorMessage);
      throw error;
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [projectId]);

  const handleConfirmDelete = useCallback(async () => {
    setIsDeleteModalOpen(false);
    await deleteProject(projectId);
    router.push("/");
  }, [deleteProject, projectId, router]);

  const handleBackClick = useCallback(() => {
    if (hasUnsavedEditorChanges) {
      setPendingNavigation("/");
      setIsNavigationModalOpen(true);
    } else {
      router.push("/");
    }
  }, [hasUnsavedEditorChanges, router]);

  const handleFileSelect = useCallback(
    (fileName: string) => {
      if (hasUnsavedEditorChanges) {
        setPendingFileSwitch(fileName);
        setIsNavigationModalOpen(true);
      } else {
        selectFile(fileName);
      }
    },
    [hasUnsavedEditorChanges, selectFile],
  );

  const handleNavigationConfirm = useCallback(() => {
    void (async () => {
      editorRef.current?.flushPendingWrites?.();

      // IMPORTANT: "Save" here means "create a new version snapshot",
      // not merely flushing disk writes.
      const ok = await editorRef.current?.saveSnapshot?.();
      if (!ok) return;

      setHasUnsavedEditorChanges(false);
      setIsNavigationModalOpen(false);

      if (pendingFileSwitch) {
        selectFile(pendingFileSwitch);
        setPendingFileSwitch(null);
      } else if (pendingNavigation) {
        router.push(pendingNavigation);
        setPendingNavigation(null);
      }
    })();
  }, [pendingFileSwitch, pendingNavigation, selectFile, router]);

  const handleNavigationCancel = useCallback(() => {
    setIsNavigationModalOpen(false);
    setPendingNavigation(null);
    setPendingFileSwitch(null);
  }, []);

  const handleNavigationDiscard = useCallback(() => {
    editorDiscardFn?.();
    setHasUnsavedEditorChanges(false);
    setIsNavigationModalOpen(false);
    if (pendingFileSwitch) {
      selectFile(pendingFileSwitch);
      setPendingFileSwitch(null);
    } else if (pendingNavigation) {
      router.push(pendingNavigation);
      setPendingNavigation(null);
    }
  }, [
    editorDiscardFn,
    pendingFileSwitch,
    pendingNavigation,
    selectFile,
    router,
  ]);

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Project not found
        </h2>
        <Button onClick={() => router.push("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleBackClick}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">
                {currentProject.name}
              </h1>
            </div>
            <p className="text-sm text-gray-500 capitalize">
              {currentProject.contentType.replace("-", " ")} •{" "}
              {currentProject.wordCount} words target
            </p>
            <p className="text-xs text-gray-500">
              Created by {currentProject.createdByName ?? "Unknown"} • Last
              modified by {currentProject.lastModifiedByName ?? "Unknown"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setProjectInfoSaveError("");
              setIsProjectInfoModalOpen(true);
            }}
          >
            <PenLine className="w-4 h-4 mr-2" />
            Edit Details
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsExportModalOpen(true)}
            disabled={
              !(syncedFileName ? syncedContent : currentProject.documentContent)
            }
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex flex-1 min-h-0 w-full gap-0 relative"
      >
        <div
          style={{ width: leftPanelWidth > 0 ? leftPanelWidth : "35%" }}
          className="flex-shrink-0 flex flex-col min-h-0 min-w-[500px]"
        >
          <Card className="flex flex-1 flex-col overflow-hidden h-full">
            <CardHeader className="flex-shrink-0 pb-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Conversation
              </h3>
            </CardHeader>
            <div className="flex-1 overflow-hidden" data-preserve-selection>
              <PanelErrorBoundary panelName="conversation">
                <AgentChat
                  sessionId={
                    streamSessionId || currentProject.opencodeSessionId || ""
                  }
                  directory={currentProject.directoryPath}
                  placeholder="Ask the agent anything..."
                  className="quill-agent-chat h-full"
                  onStatusChange={handleChatStatusChange}
                  contextItems={contextItems}
                  onClearContext={handleClearContext}
                />
              </PanelErrorBoundary>
            </div>
          </Card>
        </div>

        <button
          type="button"
          className="w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize flex-shrink-0 transition-colors z-10 flex items-center justify-center group mx-2.5"
          onMouseDown={startResizing}
          aria-label="Resize conversation panel"
        >
          <div className="h-8 w-1 bg-gray-300 rounded-full group-hover:bg-blue-500" />
        </button>

        <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[240px] max-h-[400px] overflow-hidden">
              <PanelErrorBoundary panelName="file-explorer">
                <FileExplorer
                  files={projectFiles}
                  selectedFile={syncedFileName}
                  onSelectFile={handleFileSelect}
                  onRefresh={refreshFiles}
                />
              </PanelErrorBoundary>
            </div>

            <div className="flex-[2] min-w-[320px] max-h-[400px] overflow-hidden">
              <PanelErrorBoundary panelName="analysis">
                <AnalysisPanel
                  metrics={analysisMetrics}
                  targetWordCount={currentProject.wordCount}
                  isLoading={isStreaming}
                  projectId={projectId}
                  onSendMessage={handleSendMessage}
                  onHighlightText={handleHighlightText}
                  cachedBriefScore={
                    currentProject.briefAdherenceCache?.adherenceScore
                  }
                />
              </PanelErrorBoundary>
            </div>
          </div>

          <div ref={previewRef} className="flex-1 min-h-0 overflow-hidden">
            <PanelErrorBoundary panelName="preview">
              <MarkdownPreview
                key={activeFilePath ?? "no-file"}
                ref={editorRef}
                content={
                  isViewingLatestVersion
                    ? syncedFileName
                      ? syncedContent
                      : currentProject.documentContent
                    : (selectedVersionContent ?? "")
                }
                documentKey={activeFilePath ?? undefined}
                onContentChange={writeActiveFile}
                baselineContent={baselineVersionContent ?? undefined}
                onCreateSnapshot={handleCreateSnapshot}
                onDiscardToBaseline={writeActiveFile}
                onTextSelect={handleTextSelect}
                isEditable={!isStreaming && baselineReady}
                isOpenCodeBusy={isStreaming}
                baselineReady={baselineReady}
                liveExternalUpdateSource={liveExternalUpdateSource}
                lastUpdated={syncedLastUpdated}
                lastModifiedByName={
                  versionRecord?.lastModifiedBy?.name ??
                  currentProject.lastModifiedByName
                }
                versions={versions}
                selectedVersionId={selectedVersionId ?? undefined}
                onSelectVersion={setSelectedVersionId}
                latestVersionId={latestVersionId}
                onReturnToLatest={() => {
                  if (latestVersionId) setSelectedVersionId(latestVersionId);
                }}
                hasNewerLiveUpdates={hasNewerLiveUpdates}
                onUnsavedChangesChange={setHasUnsavedEditorChanges}
                onDiscardChanges={(discard) => {
                  setEditorDiscardFn(() => discard);
                }}
                onSelectionExpand={handleExpandSelection}
                onSelectionReduce={handleReduceSelection}
                onSelectionImprovePoint={handleImprovePointSelection}
              />
            </PanelErrorBoundary>
          </div>
        </div>
      </div>

      <ExportModal
        project={currentProject}
        content={
          syncedFileName ? syncedContent : currentProject.documentContent
        }
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      <Modal
        isOpen={isServerErrorModalOpen}
        title="OpenCode Server Unavailable"
        description={serverErrorMessage}
        onClose={() => setIsServerErrorModalOpen(false)}
        onConfirm={() => {
          setIsServerErrorModalOpen(false);
          router.push("/");
        }}
        confirmText="Return Home"
        cancelText=""
        confirmVariant="danger"
      />

      <Modal
        isOpen={isDeleteModalOpen}
        title="Delete Project"
        description={`Are you sure you want to delete "${currentProject.name}"? This action cannot be undone.`}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        confirmText="Delete"
        confirmVariant="danger"
        cancelText="Cancel"
      />

      <Modal
        isOpen={isUnsavedChangesModalOpen}
        title="Save From Older Version"
        description="You're editing an older version. Saving now will delete all newer versions and continue versioning from here."
        onClose={() => {
          setIsUnsavedChangesModalOpen(false);
          setPendingBranchSaveContent(null);
        }}
        onConfirm={() => {
          void (async () => {
            if (
              !activeFilePath ||
              !pendingBranchSaveContent ||
              !selectedVersionId
            )
              return;

            const branched = await branchToVersion(selectedVersionId, false);
            if (!branched.success) {
              console.error("Failed to branch:", branched.error);
              return;
            }

            await writeActiveFile(pendingBranchSaveContent);
            const snap = await createSnapshot(pendingBranchSaveContent);
            if (!snap.success) {
              console.error("Failed to snapshot:", snap.error);
            }

            setIsUnsavedChangesModalOpen(false);
            setPendingBranchSaveContent(null);
          })();
        }}
        onSecondary={() => {
          setIsUnsavedChangesModalOpen(false);
          setPendingBranchSaveContent(null);
        }}
        confirmText="Continue From Here"
        secondaryText="Cancel"
        cancelText="Cancel"
      />

      <Modal
        isOpen={isNavigationModalOpen}
        title="Unsaved Changes"
        description={
          pendingFileSwitch
            ? "You have unsaved changes in the editor. Save them before switching files, or discard them and continue."
            : "You have unsaved changes in the editor. Save them before leaving, or discard them and continue."
        }
        onClose={handleNavigationCancel}
        onConfirm={handleNavigationConfirm}
        onSecondary={handleNavigationDiscard}
        confirmText={pendingFileSwitch ? "Save & Switch" : "Save & Leave"}
        secondaryText={
          pendingFileSwitch ? "Discard & Switch" : "Discard & Leave"
        }
        cancelText="Cancel"
      />

      <ProjectInfoModal
        isOpen={isProjectInfoModalOpen}
        initialValues={{
          name: currentProject.name,
          contentType: currentProject.contentType,
          wordCount: currentProject.wordCount,
          styleHints: currentProject.styleHints,
          brief: currentProject.brief,
        }}
        isSaving={isSavingProjectInfo}
        errorMessage={projectInfoSaveError}
        onClose={() => {
          if (!isSavingProjectInfo) {
            setIsProjectInfoModalOpen(false);
            setProjectInfoSaveError("");
          }
        }}
        onSave={handleSaveProjectInfo}
        onGenerateSummary={handleGenerateAiSummary}
        onDelete={handleDeleteProject}
        isGeneratingSummary={isGeneratingSummary}
      />
    </div>
  );
}
