import { create } from "zustand";
import type {
  Project,
  Message,
  StarterFormData,
  TextSelection,
  MarkedSelection,
  AnalysisMetrics,
  QuestionData,
} from "@/types";
import type {
  StreamEvent,
  ToolState,
  SessionStatus,
  ToolPart,
  ActivityToggleLevel,
} from "@/types/opencode-events";

interface ProjectState {
  projects: Project[];
  currentProjectId: string | null;
  isLoading: boolean;
  isOpenCodeBusy: boolean;
  textSelection: TextSelection | null;
  markedSelections: MarkedSelection[];
  analysisMetrics: AnalysisMetrics | null;
  isHydrated: boolean;
  sessionStatus: "idle" | "busy" | "retry";
  activityToggleLevel: ActivityToggleLevel;
  currentToolStates: Map<string, { state: ToolState; toolName: string }>;
  retryAttempt?: number;

  fetchProjects: () => Promise<void>;
  getCurrentProject: () => Project | null;
  selectProject: (id: string) => void;
  createProject: (name: string, formData: StarterFormData) => Promise<string>;
  updateProjectInfo: (
    updates: Pick<
      Project,
      "name" | "contentType" | "wordCount" | "styleHints" | "brief"
    >,
  ) => Promise<void>;
  updateDocument: (content: string) => Promise<void>;
  addMessage: (role: Message["role"], content: string) => Promise<void>;
  addMessageWithDetails: (message: Message) => Promise<void>;
  markMessageAsFailed: (messageId: string, errorMessage: string) => void;
  updateMessageStatus: (
    messageId: string,
    status: "pending" | "sent" | "failed" | "retrying",
    errorMessage?: string,
    retryAttempts?: number,
  ) => void;
  addQuestion: (questionData: QuestionData) => Promise<void>;
  answerQuestion: (questionId: string, answers: string[][]) => Promise<void>;
  setOpenCodeBusy: (busy: boolean) => void;
  setTextSelection: (selection: TextSelection | null) => void;
  addMarkedSelection: (selection: MarkedSelection) => void;
  removeMarkedSelection: (id: string) => void;
  clearMarkedSelections: () => void;
  setAnalysisMetrics: (metrics: AnalysisMetrics | null) => void;
  deleteProject: (id: string) => Promise<void>;
  setSessionStatus: (status: SessionStatus) => void;
  setActivityToggleLevel: (level: ActivityToggleLevel) => void;
  updateToolState: (
    partId: string,
    state: ToolState,
    toolName?: string,
  ) => void;
  clearToolStates: () => void;
  handleStreamEvent: (event: StreamEvent) => void;
}

function hydrateProject(p: Project): Project {
  return {
    ...p,
    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.updatedAt),
    messages: p.messages.map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    })),
  };
}

function buildQuestionAnsweredMessage(
  questionMessage: Message | undefined,
  answers: string[][],
): Message | null {
  if (!questionMessage?.questionData) return null;

  const summaryParts: string[] = [];

  questionMessage.questionData.questions.forEach((q, index) => {
    const selected = answers[index] ?? [];
    if (selected.length === 0) return;

    const predefinedLabels = new Set(q.options.map((o) => o.label));
    const customAnswers = selected.filter((a) => !predefinedLabels.has(a));
    const predefinedAnswers = selected.filter((a) => predefinedLabels.has(a));

    const parts: string[] = [];
    if (predefinedAnswers.length > 0) {
      parts.push(predefinedAnswers.join(", "));
    }
    if (customAnswers.length > 0) {
      parts.push(customAnswers.map((a) => `"${a}"`).join(", "));
    }

    if (questionMessage.questionData!.questions.length > 1) {
      summaryParts.push(`**${q.header}:** ${parts.join(", ")}`);
    } else {
      summaryParts.push(parts.join(", "));
    }
  });

  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    role: "question-answered",
    content: summaryParts.join("\n"),
    timestamp: new Date(),
    questionData: {
      ...questionMessage.questionData,
      answered: true,
      answers,
    },
  };
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: [],
  currentProjectId: null,
  isLoading: false,
  isOpenCodeBusy: false,
  textSelection: null,
  markedSelections: [],
  analysisMetrics: null,
  isHydrated: false,
  sessionStatus: "idle",
  activityToggleLevel: "all-activities",
  currentToolStates: new Map(),

  fetchProjects: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch("/api/projects");
      if (!response.ok) throw new Error("Failed to fetch projects");
      const data = await response.json();
      const projects = data.projects.map(hydrateProject);
      set({ projects, isLoading: false, isHydrated: true });
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      set({ isLoading: false, isHydrated: true });
    }
  },

  getCurrentProject: () => {
    const { projects, currentProjectId } = get();
    return projects.find((p) => p.id === currentProjectId) ?? null;
  },

  selectProject: (id) => {
    set({ currentProjectId: id, textSelection: null, analysisMetrics: null });
  },

  createProject: async (name, formData) => {
    set({ isLoading: true });
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, formData }),
      });

      if (!response.ok) throw new Error("Failed to create project");

      const data = await response.json();
      const project = hydrateProject(data.project);

      set((state) => ({
        projects: [...state.projects, project],
        currentProjectId: project.id,
        isLoading: false,
      }));

      return project.id;
    } catch (error) {
      console.error("Failed to create project:", error);
      set({ isLoading: false });
      throw error;
    }
  },

  updateProjectInfo: async (updates) => {
    const { currentProjectId } = get();
    if (!currentProjectId) return;

    const previousProject = get().projects.find(
      (p) => p.id === currentProjectId,
    );
    if (!previousProject) return;

    const optimisticProject: Project = {
      ...previousProject,
      ...updates,
      updatedAt: new Date(),
    };

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === currentProjectId ? optimisticProject : p,
      ),
    }));

    try {
      const response = await fetch(`/api/projects/${currentProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to update project info");
      }

      const data = await response.json();
      const updatedProject = hydrateProject(data.project);
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === currentProjectId ? updatedProject : p,
        ),
      }));
    } catch (error) {
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === currentProjectId ? previousProject : p,
        ),
      }));
      console.error("Failed to update project info:", error);
      throw error;
    }
  },

  updateDocument: async (content) => {
    const { currentProjectId } = get();
    if (!currentProjectId) return;

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === currentProjectId
          ? { ...p, documentContent: content, updatedAt: new Date() }
          : p,
      ),
    }));

    try {
      await fetch(`/api/projects/${currentProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentContent: content }),
      });
    } catch (error) {
      console.error("Failed to update document:", error);
    }
  },

  addMessage: async (role, content) => {
    const { currentProjectId } = get();
    if (!currentProjectId) return;

    const tempMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      role,
      content,
      timestamp: new Date(),
    };

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === currentProjectId
          ? {
              ...p,
              messages: [...p.messages, tempMessage],
              updatedAt: new Date(),
            }
          : p,
      ),
    }));

    try {
      await fetch(`/api/projects/${currentProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: { role, content } }),
      });
    } catch (error) {
      console.error("Failed to add message:", error);
    }
  },

  addMessageWithDetails: async (message) => {
    const { currentProjectId, projects } = get();
    if (!currentProjectId) return;

    const messageToStore: Message = {
      ...message,
      id:
        message.id ||
        `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: message.timestamp ?? new Date(),
    };

    const currentProject = projects.find((p) => p.id === currentProjectId);
    const existingMessage = currentProject?.messages.find(
      (m) => m.id === messageToStore.id,
    );
    if (existingMessage) {
      console.log(
        "[ProjectStore] Message with id already exists, skipping:",
        messageToStore.id,
      );
      return;
    }

    if (
      messageToStore.role === "question" &&
      messageToStore.questionData?.requestId
    ) {
      const existingQuestion = currentProject?.messages.find(
        (m) =>
          m.role === "question" &&
          m.questionData?.requestId === messageToStore.questionData?.requestId,
      );
      if (existingQuestion) {
        console.log(
          "[ProjectStore] Question with requestId already exists, skipping:",
          messageToStore.questionData.requestId,
        );
        return;
      }
    }

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === currentProjectId
          ? {
              ...p,
              messages: [...p.messages, messageToStore],
              updatedAt: new Date(),
            }
          : p,
      ),
    }));

    try {
      await fetch(`/api/projects/${currentProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToStore }),
      });
    } catch (error) {
      console.error("Failed to add message with details:", error);
    }
  },

  markMessageAsFailed: (messageId, errorMessage) => {
    const { currentProjectId } = get();
    if (!currentProjectId) return;

    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== currentProjectId) return p;

        const updatedMessages = p.messages.map((m) => {
          if (m.id === messageId) {
            return {
              ...m,
              error: true,
              errorMessage,
              status: "failed" as const,
            };
          }
          return m;
        });

        return { ...p, messages: updatedMessages };
      }),
    }));
  },

  updateMessageStatus: (messageId, status, errorMessage, retryAttempts) => {
    const { currentProjectId } = get();
    if (!currentProjectId) return;

    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== currentProjectId) return p;

        const updatedMessages = p.messages.map((m) => {
          if (m.id === messageId) {
            return {
              ...m,
              status,
              error: status === "failed",
              errorMessage: status === "failed" ? errorMessage : undefined,
              retryAttempts: status === "retrying" ? retryAttempts : undefined,
            };
          }
          return m;
        });

        return { ...p, messages: updatedMessages };
      }),
    }));
  },

  addQuestion: async (questionData) => {
    console.log("[ProjectStore] addQuestion called with:", questionData);
    const { currentProjectId, projects } = get();
    if (!currentProjectId) return;

    // Check if a question with the same requestId already exists
    const currentProject = projects.find((p) => p.id === currentProjectId);
    const existingQuestion = currentProject?.messages.find(
      (m) =>
        m.role === "question" &&
        m.questionData?.requestId === questionData.requestId,
    );
    if (existingQuestion) {
      console.log(
        "[ProjectStore] Question with requestId already exists, skipping:",
        questionData.requestId,
      );
      return;
    }

    const tempMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      role: "question",
      content: "",
      questionData,
      timestamp: new Date(),
    };

    console.log("[ProjectStore] Creating question message:", tempMessage);

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === currentProjectId
          ? {
              ...p,
              messages: [...p.messages, tempMessage],
              updatedAt: new Date(),
            }
          : p,
      ),
    }));

    console.log("[ProjectStore] Question message added to state");

    try {
      await fetch(`/api/projects/${currentProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: tempMessage }),
      });
      // Don't replace client state from server response to avoid race conditions
      // with answerQuestion updates
    } catch (error) {
      console.error("Failed to add question:", error);
    }
  },

  answerQuestion: async (questionId, answers) => {
    const { currentProjectId } = get();
    if (!currentProjectId) return;

    const projectBefore = get().projects.find((p) => p.id === currentProjectId);
    const questionMessage = projectBefore?.messages.find(
      (m) => m.id === questionId,
    );

    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== currentProjectId) return p;

        const updatedMessages = p.messages.map((m) => {
          if (m.id === questionId && m.questionData) {
            return {
              ...m,
              questionData: {
                ...m.questionData,
                answered: true,
                answers,
              },
            };
          }
          return m;
        });

        return { ...p, messages: updatedMessages, updatedAt: new Date() };
      }),
    }));

    const answeredMessage = buildQuestionAnsweredMessage(
      questionMessage,
      answers,
    );
    if (answeredMessage) {
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === currentProjectId
            ? {
                ...p,
                messages: [...p.messages, answeredMessage],
                updatedAt: new Date(),
              }
            : p,
        ),
      }));

      try {
        await fetch(`/api/projects/${currentProjectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: answeredMessage }),
        });
      } catch (error) {
        console.error("Failed to persist question-answered message:", error);
      }
    }

    const project = get().projects.find((p) => p.id === currentProjectId);
    const message = project?.messages.find((m) => m.id === questionId);
    const requestId = message?.questionData?.requestId;
    const updatedQuestionData = message?.questionData;

    if (!requestId || !updatedQuestionData) {
      console.error("Could not find request ID for question", questionId);
      return;
    }

    try {
      await fetch(`/api/projects/${currentProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageUpdate: {
            id: questionId,
            updates: { questionData: updatedQuestionData },
          },
        }),
      });

      const response = await fetch("/api/opencode/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: currentProjectId,
          requestId,
          answers,
        }),
      });

      if (!response.ok || !response.body) {
        console.error("Failed to submit answer:", response.status);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              console.log("[answerQuestion] SSE event:", data);
            } catch {
              continue;
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to submit answer:", error);
    }
  },

  setOpenCodeBusy: (busy) => {
    set({ isOpenCodeBusy: busy });
  },

  setTextSelection: (selection) => {
    set({ textSelection: selection });
  },

  addMarkedSelection: (selection) => {
    set((state) => ({
      markedSelections: [...state.markedSelections, selection],
    }));
  },

  removeMarkedSelection: (id) => {
    set((state) => ({
      markedSelections: state.markedSelections.filter((s) => s.id !== id),
    }));
  },

  clearMarkedSelections: () => {
    set({ markedSelections: [] });
  },

  setAnalysisMetrics: (metrics) => {
    set({ analysisMetrics: metrics });
  },

  deleteProject: async (id) => {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProjectId:
        state.currentProjectId === id ? null : state.currentProjectId,
    }));

    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
    } catch (error) {
      console.error("Failed to delete project:", error);
    }
  },

  setSessionStatus: (status) => {
    set({
      sessionStatus: status.type,
      retryAttempt: status.type === "retry" ? status.attempt : undefined,
    });
  },

  setActivityToggleLevel: (level) => {
    set({ activityToggleLevel: level });
  },

  updateToolState: (partId, state, toolName = "unknown") => {
    set((current) => {
      const newMap = new Map(current.currentToolStates);
      newMap.set(partId, { state, toolName });
      return { currentToolStates: newMap };
    });
  },

  clearToolStates: () => {
    set({ currentToolStates: new Map() });
  },

  handleStreamEvent: (event) => {
    const { setSessionStatus, updateToolState, addQuestion } = get();

    switch (event.type) {
      case "part": {
        const part = event.part;
        if (part.type === "tool") {
          const toolPart = part as ToolPart;
          updateToolState(toolPart.id, toolPart.state, toolPart.tool);
        }
        break;
      }
      case "status": {
        setSessionStatus(event.sessionStatus);
        break;
      }
      case "question": {
        const questionRequest = event.data;
        const questionData: QuestionData = {
          requestId: questionRequest.requestId,
          sessionId: questionRequest.sessionId,
          questions: questionRequest.questions.map((q) => ({
            ...q,
            options: q.options.map((opt) => ({
              label: opt.label,
              description: opt.description ?? "",
            })),
          })),
          answered: false,
        };
        addQuestion(questionData);
        break;
      }
      case "error": {
        console.error("[ProjectStore] Stream error:", event.error);
        break;
      }
      case "done": {
        set({ sessionStatus: "idle" });
        break;
      }
      case "file.edited": {
        console.log("[ProjectStore] File edited:", event.file);
        break;
      }
    }
  },
}));
