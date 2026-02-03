"use client";

import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { ConversationPanel } from "@/components/conversation";
import { MarkdownPreview } from "@/components/preview";
import { AnalysisPanel } from "@/components/analysis";
import { ExportModal } from "@/components/export";
import { Button, Card, CardHeader, PanelErrorBoundary } from "@/components/ui";
import { useProjectStore } from "@/stores/project-store";
import {
  useOpenCodeStream,
  useTextSelection,
  useMarkdownSync,
  useFileWatcher,
} from "@/hooks";
import { analyzeContent } from "@/lib/analysis";
import { buildPrompt } from "@/utils/prompt-builder";
import type { TextSelection, Message } from "@/types";
import type { Part, StreamActivity } from "@/types/opencode-events";
import { FileExplorer } from "@/components/preview/file-explorer";

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(0);
  const [isResizing, setIsResizing] = useState(false);
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
  const markMessageAsFailed = useProjectStore(
    (state) => state.markMessageAsFailed,
  );
  const addQuestion = useProjectStore((state) => state.addQuestion);
  const answerQuestion = useProjectStore((state) => state.answerQuestion);
  const updateDocument = useProjectStore((state) => state.updateDocument);
  const deleteProject = useProjectStore((state) => state.deleteProject);
  const analysisMetrics = useProjectStore((state) => state.analysisMetrics);
  const setAnalysisMetrics = useProjectStore(
    (state) => state.setAnalysisMetrics,
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

  const { sendMessage, isStreaming, streamingContent, statusMessage } =
    useOpenCodeStream({
      projectId,
      onQuestion: (questionData) => {
        console.log("[ProjectPage] onQuestion called with:", questionData);
        addQuestion(questionData);
      },
      onComplete: (content) => {
        addMessageWithDetails({
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          role: "assistant",
          content,
          timestamp: new Date(),
          parts: streamingParts,
          activities: streamingActivities,
        });

        setStreamingParts([]);
        setStreamingActivities([]);

        const markdownMatch = content.match(/```markdown\n([\s\S]*?)\n```/);
        if (markdownMatch) {
          updateDocument(markdownMatch[1]);
        }
      },
      onPart: (part) => {
        setStreamingParts((prev) => {
          const index = prev.findIndex((p) => p.id === part.id);
          if (index === -1) {
            return [...prev, part];
          }
          const next = [...prev];
          next[index] = part;
          return next;
        });
      },
      onActivity: (activity) => {
        setStreamingActivities((prev) => [...prev, activity]);
      },
      onError: (error) => {
        console.error("OpenCode stream error:", error);
      },
    });

  const displayedMessages = useMemo(() => {
    if (!currentProject) return [] as Message[];

    if (!isStreaming || !streamingContent) {
      return currentProject.messages;
    }

    const streamingMessage: Message = {
      id: "streaming-assistant",
      role: "assistant",
      content: streamingContent,
      timestamp: new Date(),
      parts: streamingParts,
      activities: streamingActivities,
    };

    return [...currentProject.messages, streamingMessage];
  }, [
    currentProject,
    isStreaming,
    streamingContent,
    streamingParts,
    streamingActivities,
  ]);

  useEffect(() => {
    selectProject(projectId);
  }, [projectId, selectProject]);

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

  const handleSendMessage = useCallback(
    async (content: string, isInitialMessage = false, messageId?: string) => {
      if (!currentProject) return;

      let userMessageId = messageId;

      if (!userMessageId) {
        const tempId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        userMessageId = tempId;
        await addMessage("user", content);
      }

      const messageContent = isInitialMessage
        ? buildPrompt({
            contentType: currentProject.contentType,
            wordCount: currentProject.wordCount,
            styleHints: currentProject.styleHints,
            brief: content,
          })
        : content;

      setStreamingParts([]);
      setStreamingActivities([]);

      const result = await sendMessage({
        message: messageContent,
        command: isInitialMessage ? "/write-content" : undefined,
      });

      if (!result.success && userMessageId) {
        markMessageAsFailed(
          userMessageId,
          result.error.message || "Failed to send message",
        );
      }
    },
    [currentProject, addMessage, sendMessage, markMessageAsFailed],
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

  const handleDeleteProject = useCallback(async () => {
    if (
      confirm(
        "Are you sure you want to delete this project? This action cannot be undone.",
      )
    ) {
      await deleteProject(projectId);
      router.push("/");
    }
  }, [deleteProject, projectId, router]);

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
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">
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
            disabled={!currentProject.documentContent}
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
            <CardHeader className="flex-shrink-0">
              <h3 className="font-semibold text-gray-900">Conversation</h3>
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

        <div className="flex-1 min-h-0 flex flex-col gap-6 pr-6 overflow-hidden">
          <div className="flex flex-wrap gap-6 pr-6">
            <div className="flex-1 min-w-[240px] max-h-[400px] overflow-hidden">
              <PanelErrorBoundary panelName="file-explorer">
                <FileExplorer
                  files={projectFiles}
                  selectedFile={syncedFileName}
                  onSelectFile={selectFile}
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
                />
              </PanelErrorBoundary>
            </div>
          </div>

          <div
            ref={previewRef}
            className="flex-1 min-h-0 overflow-hidden pr-6 pb-6"
          >
            <PanelErrorBoundary panelName="preview">
              <MarkdownPreview
                content={
                  streamingContent ||
                  syncedContent ||
                  currentProject.documentContent
                }
                onContentChange={handleContentChange}
                onTextSelect={handleTextSelect}
                isEditable={!isStreaming}
                isOpenCodeBusy={isStreaming}
                lastUpdated={syncedLastUpdated}
              />
            </PanelErrorBoundary>
          </div>
        </div>
      </div>

      <ExportModal
        project={currentProject}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
}
