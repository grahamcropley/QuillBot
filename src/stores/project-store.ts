import { create } from "zustand";
import type {
  Project,
  Message,
  StarterFormData,
  TextSelection,
  AnalysisMetrics,
  QuestionData,
} from "@/types";
import type {
  StreamEvent,
  ToolState,
  SessionStatus,
  ToolPart,
} from "@/types/opencode-events";

interface ProjectState {
  projects: Project[];
  currentProjectId: string | null;
  isLoading: boolean;
  isOpenCodeBusy: boolean;
  textSelection: TextSelection | null;
  analysisMetrics: AnalysisMetrics | null;
  isHydrated: boolean;
  sessionStatus: "idle" | "busy" | "retry";
  currentToolStates: Map<string, { state: ToolState; toolName: string }>;
  retryAttempt?: number;

  fetchProjects: () => Promise<void>;
  getCurrentProject: () => Project | null;
  selectProject: (id: string) => void;
  createProject: (name: string, formData: StarterFormData) => Promise<string>;
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
  setAnalysisMetrics: (metrics: AnalysisMetrics | null) => void;
  deleteProject: (id: string) => Promise<void>;
  setSessionStatus: (status: SessionStatus) => void;
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

export const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: [],
  currentProjectId: null,
  isLoading: false,
  isOpenCodeBusy: false,
  textSelection: null,
  analysisMetrics: null,
  isHydrated: false,
  sessionStatus: "idle",
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
      const response = await fetch(`/api/projects/${currentProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: { role, content } }),
      });

      if (response.ok) {
        const data = await response.json();
        const updated = hydrateProject(data.project);
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === currentProjectId ? updated : p,
          ),
        }));
      }
    } catch (error) {
      console.error("Failed to add message:", error);
    }
  },

  addMessageWithDetails: async (message) => {
    const { currentProjectId } = get();
    if (!currentProjectId) return;

    const messageToStore: Message = {
      ...message,
      id:
        message.id ||
        `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: message.timestamp ?? new Date(),
    };

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
      const response = await fetch(`/api/projects/${currentProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToStore }),
      });

      if (response.ok) {
        const data = await response.json();
        const updated = hydrateProject(data.project);
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === currentProjectId ? updated : p,
          ),
        }));
      }
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
    const { currentProjectId } = get();
    if (!currentProjectId) return;

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
      const response = await fetch(`/api/projects/${currentProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: tempMessage }),
      });

      if (response.ok) {
        const data = await response.json();
        const updated = hydrateProject(data.project);
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === currentProjectId ? updated : p,
          ),
        }));
      }
    } catch (error) {
      console.error("Failed to add question:", error);
    }
  },

  answerQuestion: async (questionId, answers) => {
    const { currentProjectId } = get();
    if (!currentProjectId) return;

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

    const project = get().projects.find((p) => p.id === currentProjectId);
    const message = project?.messages.find((m) => m.id === questionId);
    const requestId = message?.questionData?.requestId;

    if (!requestId) {
      console.error("Could not find request ID for question", questionId);
      return;
    }

    try {
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
