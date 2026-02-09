import { create } from "zustand";
import type {
  Project,
  Message,
  StarterFormData,
  TextSelection,
  MarkedSelection,
  AnalysisMetrics,
} from "@/types";

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

  fetchProjects: () => Promise<void>;
  getCurrentProject: () => Project | null;
  selectProject: (id: string) => void;
  createProject: (
    name: string,
    formData: StarterFormData,
    isReviewMode?: boolean,
    reviewFilename?: string,
  ) => Promise<string>;
  updateProjectInfo: (
    updates: Partial<
      Pick<
        Project,
        | "name"
        | "contentType"
        | "wordCount"
        | "styleHints"
        | "brief"
        | "opencodeSessionId"
      >
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
  setOpenCodeBusy: (busy: boolean) => void;
  setTextSelection: (selection: TextSelection | null) => void;
  addMarkedSelection: (selection: MarkedSelection) => void;
  removeMarkedSelection: (id: string) => void;
  clearMarkedSelections: () => void;
  setAnalysisMetrics: (metrics: AnalysisMetrics | null) => void;
  deleteProject: (id: string) => Promise<void>;
  setSessionStatus: (status: "idle" | "busy" | "retry") => void;
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
  markedSelections: [],
  analysisMetrics: null,
  isHydrated: false,
  sessionStatus: "idle",

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

  createProject: async (name, formData, isReviewMode, reviewFilename) => {
    set({ isLoading: true });
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, formData, isReviewMode, reviewFilename }),
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
    set({ sessionStatus: status });
  },
}));
