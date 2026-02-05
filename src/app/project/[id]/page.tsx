"use client";

import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { ConversationPanel } from "@/components/conversation";
import { MarkdownPreview } from "@/components/preview";
import { AnalysisPanel } from "@/components/analysis";
import { ExportModal } from "@/components/export";
import { Modal } from "@/components/ui/modal";
import { Button, Card, CardHeader, PanelErrorBoundary } from "@/components/ui";
import { useProjectStore } from "@/stores/project-store";
import {
  useOpenCodeStream,
  useTextSelection,
  useMarkdownSync,
  useFileWatcher,
} from "@/hooks";
import { useResumeBufferedStream } from "@/hooks/use-resume-buffered-stream";
import { analyzeContent } from "@/lib/analysis";
import { buildPrompt } from "@/utils/prompt-builder";
import type { TextSelection, Message } from "@/types";
import type { Part, StreamActivity } from "@/types/opencode-events";
import type { MarkdownPreviewHandle } from "@/components/preview/markdown-preview";
import { FileExplorer } from "@/components/preview/file-explorer";

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
  const [isUnsavedChangesModalOpen, setIsUnsavedChangesModalOpen] =
    useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
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
  const fetchProjects = useProjectStore((state) => state.fetchProjects);
  const selectProject = useProjectStore((state) => state.selectProject);
  const addMessage = useProjectStore((state) => state.addMessage);
  const addMessageWithDetails = useProjectStore(
    (state) => state.addMessageWithDetails,
  );
  const updateMessageStatus = useProjectStore(
    (state) => state.updateMessageStatus,
  );
  const addQuestion = useProjectStore((state) => state.addQuestion);
  const answerQuestion = useProjectStore((state) => state.answerQuestion);
  const updateDocument = useProjectStore((state) => state.updateDocument);
  const deleteProject = useProjectStore((state) => state.deleteProject);
  const analysisMetrics = useProjectStore((state) => state.analysisMetrics);
  const setAnalysisMetrics = useProjectStore(
    (state) => state.setAnalysisMetrics,
  );
  const clearMarkedSelections = useProjectStore(
    (state) => state.clearMarkedSelections,
  );

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
    enabled: true,
  });

  const { files: projectFiles, refetch: refreshFiles } = useFileWatcher({
    projectId,
    enabled: true,
  });

  const [streamingParts, setStreamingParts] = useState<Part[]>([]);
  const [streamingActivities, setStreamingActivities] = useState<
    StreamActivity[]
  >([]);
  const [streamingSegments, setStreamingSegments] = useState<Message[]>([]);
  const streamingPartsRef = useRef<Part[]>([]);
  const streamingActivitiesRef = useRef<StreamActivity[]>([]);
  const streamingSegmentsRef = useRef<Message[]>([]);
  const streamSplitCounterRef = useRef(0);

  const nextStreamSplitId = useCallback(() => {
    streamSplitCounterRef.current += 1;
    return `stream_split_${Date.now()}_${streamSplitCounterRef.current}`;
  }, []);

  const commitStreamingSegment = useCallback((segment: Message) => {
    setStreamingSegments((prev) => {
      const next = [...prev, segment];
      streamingSegmentsRef.current = next;
      return next;
    });
  }, []);

  const resetStreamingCollections = useCallback(() => {
    setStreamingParts([]);
    setStreamingActivities([]);
    streamingPartsRef.current = [];
    streamingActivitiesRef.current = [];
  }, []);

  const {
    sendMessage,
    isStreaming,
    streamingContent,
    statusMessage,
    sessionId: streamSessionId,
    resumeBufferedStream,
  } = useOpenCodeStream({
    projectId,
    initialSessionId: currentProject?.opencodeSessionId ?? null,
    onQuestion: (questionData) => {
      console.log("[ProjectPage] onQuestion called with:", questionData);
      addQuestion(questionData);
    },
    onStreamSplit: ({ tool, content }) => {
      const parts = streamingPartsRef.current;
      const activities = streamingActivitiesRef.current;

      if (!content.trim() && parts.length === 0 && activities.length === 0) {
        return;
      }

      commitStreamingSegment({
        id: nextStreamSplitId(),
        role: "assistant",
        content,
        timestamp: new Date(),
        parts,
        activities,
      });

      resetStreamingCollections();
      console.log("[ProjectPage] Stream split at tool:", tool);
    },
    onComplete: (content) => {
      const finalParts = streamingPartsRef.current;
      const finalActivities = streamingActivitiesRef.current;
      const segmentsToStore = [...streamingSegmentsRef.current];

      if (
        content.trim() ||
        finalParts.length > 0 ||
        finalActivities.length > 0
      ) {
        segmentsToStore.push({
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          role: "assistant",
          content,
          timestamp: new Date(),
          parts: finalParts,
          activities: finalActivities,
        });
      }

      resetStreamingCollections();
      clearMarkedSelections();

      void (async () => {
        for (const segment of segmentsToStore) {
          await addMessageWithDetails(segment);
        }

        setStreamingSegments([]);
        streamingSegmentsRef.current = [];
      })();

      const markdownMatch = content.match(/```markdown\n([\s\S]*?)\n```/);
      if (markdownMatch) {
        updateDocument(markdownMatch[1]);
      }
    },
    onPart: (part) => {
      const current = streamingPartsRef.current;
      const index = current.findIndex((p) => p.id === part.id);
      const next =
        index === -1
          ? [...current, part]
          : current.map((existing, idx) => (idx === index ? part : existing));
      streamingPartsRef.current = next;
      setStreamingParts(next);
    },
    onActivity: (activity) => {
      const next = [...streamingActivitiesRef.current, activity];
      streamingActivitiesRef.current = next;
      setStreamingActivities(next);
    },
    onError: (error) => {
      console.error("OpenCode stream error:", error);
      const errorMsg = error.message || "Unknown error";

      // Detect server connection errors
      if (
        errorMsg.includes("fetch failed") ||
        errorMsg.includes("HTTP 500") ||
        errorMsg.includes("Failed to communicate with OpenCode")
      ) {
        setServerErrorMessage(
          "Unable to connect to the OpenCode server. Please ensure it's running and try again.",
        );
        setIsServerErrorModalOpen(true);
      }
    },
  });

  useResumeBufferedStream(
    {
      sendMessage,
      isStreaming,
      streamingContent,
      statusMessage,
      sessionId: streamSessionId || currentProject?.opencodeSessionId || null,
      error: null,
      lastFailedMessageId: null,
      clearError: () => {},
      reset: () => {},
      abort: async () => {},
      resumeBufferedStream,
    },
    projectId,
    true,
  );

  const displayedMessages = useMemo(() => {
    if (!currentProject) return [] as Message[];

    const hasStreamingData =
      streamingContent ||
      streamingParts.length > 0 ||
      streamingActivities.length > 0;
    const hasStreamingSegments = streamingSegments.length > 0;

    if (!isStreaming && !hasStreamingSegments) {
      return currentProject.messages;
    }

    if (!hasStreamingData) {
      const seenIds = new Set(currentProject.messages.map((msg) => msg.id));
      const dedupedSegments = streamingSegments.filter(
        (segment) => !seenIds.has(segment.id),
      );
      return [...currentProject.messages, ...dedupedSegments];
    }

    const streamingMessage: Message = {
      id: "streaming-assistant",
      role: "assistant",
      content: streamingContent,
      timestamp: new Date(),
      parts: streamingParts,
      activities: streamingActivities,
    };

    const lastMessage = currentProject.messages.at(-1);
    const hasPendingQuestion =
      lastMessage?.role === "question" &&
      lastMessage.questionData &&
      !lastMessage.questionData.answered;
    const hasStreamingText = Boolean(streamingContent.trim());

    if (hasPendingQuestion && !hasStreamingText) {
      const mergedQuestion: Message = {
        ...lastMessage,
        parts: [...(lastMessage.parts ?? []), ...streamingParts],
        activities: [...(lastMessage.activities ?? []), ...streamingActivities],
      };
      return [
        ...currentProject.messages.slice(0, -1),
        mergedQuestion,
        ...streamingSegments,
      ];
    }

    const seenIds = new Set(currentProject.messages.map((msg) => msg.id));
    const dedupedSegments = streamingSegments.filter(
      (segment) => !seenIds.has(segment.id),
    );
    return [...currentProject.messages, ...dedupedSegments, streamingMessage];
  }, [
    currentProject,
    isStreaming,
    streamingContent,
    streamingParts,
    streamingActivities,
    streamingSegments,
  ]);

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

  useEffect(() => {
    if (currentProject?.documentContent) {
      const metrics = analyzeContent(
        currentProject.documentContent,
        currentProject.brief,
      );
      setAnalysisMetrics(metrics);
    }
  }, [
    currentProject?.documentContent,
    currentProject?.brief,
    setAnalysisMetrics,
  ]);

  const sendMessageInternal = useCallback(
    async (content: string, isInitialMessage = false, messageId?: string) => {
      if (!currentProject) return;

      const MAX_RETRY_ATTEMPTS = 3;
      let userMessageId = messageId;
      let retryAttempt = 0;

      // Get current message to check retry count
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

        // Mark as retrying
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
        await addMessage("user", content);
        // Mark new message as pending
        updateMessageStatus(userMessageId, "pending");
      }

      const messageContent = isInitialMessage
        ? buildPrompt({
            contentType: currentProject.contentType,
            wordCount: currentProject.wordCount,
            styleHints: currentProject.styleHints,
            brief: content,
          })
        : content;

      resetStreamingCollections();
      setStreamingSegments([]);
      streamingSegmentsRef.current = [];

      const result = await sendMessage({
        message: messageContent,
        command: isInitialMessage ? "/write-content" : undefined,
      });

      if (result.success) {
        // Mark as sent
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
      addMessage,
      sendMessage,
      updateMessageStatus,
      resetStreamingCollections,
    ],
  );

  const handleSendMessage = useCallback(
    async (content: string, isInitialMessage = false, messageId?: string) => {
      if (!currentProject) return;

      // Check for unsaved editor changes
      if (hasUnsavedEditorChanges) {
        setPendingMessage(content);
        setIsUnsavedChangesModalOpen(true);
        return;
      }

      await sendMessageInternal(content, isInitialMessage, messageId);
    },
    [currentProject, hasUnsavedEditorChanges, sendMessageInternal],
  );

  // Track initialization and trigger initial message send
  // Using useRef to avoid triggering re-renders
  const pendingInitialMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      currentProject &&
      currentProject.messages.length === 0 &&
      !isStreaming &&
      !hasInitialized.current.has(currentProject.id)
    ) {
      hasInitialized.current.add(currentProject.id);
      pendingInitialMessageRef.current = currentProject.brief;
    }
  }, [currentProject, isStreaming]);

  // Handle pending initial message outside of the main effect
  useEffect(() => {
    const pendingMessage = pendingInitialMessageRef.current;
    if (pendingMessage) {
      pendingInitialMessageRef.current = null;
      handleSendMessage(pendingMessage, true);
    }
  }, [handleSendMessage]);

  const handleRetryMessage = useCallback(
    async (message: Message) => {
      if (!message.error || message.role !== "user") return;

      await handleSendMessage(message.content, false, message.id);
    },
    [handleSendMessage],
  );

  const handleContentChange = useCallback(
    (content: string) => {
      updateDocument(content);
    },
    [updateDocument],
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

  const handleHighlightText = useCallback((excerpt: string) => {
    if (editorRef.current) {
      const found = editorRef.current.findAndHighlight(excerpt);
      if (!found) {
        console.warn("[ProjectPage] Text not found in editor:", excerpt);
      }
    }
  }, []);

  const handleDeleteProject = useCallback(async () => {
    setIsDeleteModalOpen(true);
  }, []);

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
    editorRef.current?.save?.();
    setHasUnsavedEditorChanges(false);
    setIsNavigationModalOpen(false);
    if (pendingMessage) {
      sendMessageInternal(pendingMessage);
      setPendingMessage(null);
    } else if (pendingFileSwitch) {
      selectFile(pendingFileSwitch);
      setPendingFileSwitch(null);
    } else if (pendingNavigation) {
      router.push(pendingNavigation);
      setPendingNavigation(null);
    }
  }, [
    pendingMessage,
    pendingFileSwitch,
    pendingNavigation,
    selectFile,
    sendMessageInternal,
    router,
  ]);

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
    <div className="flex h-full flex-col gap-3 overflow-hidden">
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
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          <Button
            variant="ghost"
            onClick={handleDeleteProject}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
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
          <Card className="flex flex-1 flex-col overflow-hidden h-full rounded-r-none border-r-0">
            <CardHeader className="flex-shrink-0 pb-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Conversation
              </h3>
            </CardHeader>
            <div className="flex-1 overflow-hidden" data-preserve-selection>
              <PanelErrorBoundary panelName="conversation">
                <ConversationPanel
                  messages={displayedMessages}
                  onSendMessage={handleSendMessage}
                  onAnswerQuestion={answerQuestion}
                  onRetryMessage={handleRetryMessage}
                  isLoading={isStreaming}
                  statusMessage={statusMessage}
                  textSelection={textSelection}
                  onClearSelection={clearTextSelection}
                  currentFileName={syncedFileName || "draft.md"}
                />
              </PanelErrorBoundary>
            </div>
          </Card>
        </div>

        <div
          className="w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize flex-shrink-0 transition-colors z-10 flex items-center justify-center group mx-2.5"
          onMouseDown={startResizing}
        >
          <div className="h-8 w-1 bg-gray-300 rounded-full group-hover:bg-blue-500" />
        </div>

        <div className="flex-1 min-h-0 flex flex-col gap-3 pr-4 overflow-hidden">
          <div className="flex flex-wrap gap-3 pr-2">
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

          <div
            ref={previewRef}
            className="flex-1 min-h-0 overflow-hidden pr-4 pb-4"
          >
            <PanelErrorBoundary panelName="preview">
              <MarkdownPreview
                ref={editorRef}
                content={
                  syncedFileName
                    ? syncedContent
                    : currentProject.documentContent
                }
                onContentChange={handleContentChange}
                onTextSelect={handleTextSelect}
                isEditable={!isStreaming}
                isOpenCodeBusy={isStreaming}
                lastUpdated={syncedLastUpdated}
                onUnsavedChangesChange={setHasUnsavedEditorChanges}
                onDiscardChanges={setEditorDiscardFn}
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
        title="Unsaved Changes"
        description="You have unsaved changes in the editor. Save them before sending a message, or discard them and continue."
        onClose={() => {
          setIsUnsavedChangesModalOpen(false);
          setPendingMessage(null);
        }}
        onConfirm={() => {
          editorRef.current?.save?.();
          setHasUnsavedEditorChanges(false);
          setIsUnsavedChangesModalOpen(false);
          setTimeout(() => {
            if (pendingMessage) {
              sendMessageInternal(pendingMessage);
              setPendingMessage(null);
            }
          }, 100);
        }}
        onSecondary={() => {
          editorDiscardFn?.();
          setHasUnsavedEditorChanges(false);
          setIsUnsavedChangesModalOpen(false);
          if (pendingMessage) {
            sendMessageInternal(pendingMessage);
            setPendingMessage(null);
          }
        }}
        confirmText="Save & Send"
        secondaryText="Discard & Send"
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
    </div>
  );
}
