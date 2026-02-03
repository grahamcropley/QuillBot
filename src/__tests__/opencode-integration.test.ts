import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isStreamMessagePartUpdated,
  isStreamQuestionAsked,
  isStreamSessionStatus,
  isStreamError,
  isStreamDone,
  isStreamFileEdited,
  type StreamEvent,
  type StreamMessagePartUpdated,
  type StreamQuestionAsked,
  type StreamSessionStatus,
  type StreamError,
  type StreamDone,
  type StreamFileEdited,
  type ToolState,
  type TextPart,
  type ToolPart,
} from "@/types/opencode-events";
import { useProjectStore } from "@/stores/project-store";

vi.mock("@/lib/opencode-client", () => ({
  getOpencodeClient: vi.fn(() => ({
    session: {
      create: vi.fn(),
      promptAsync: vi.fn(),
      abort: vi.fn(),
    },
    event: {
      subscribe: vi.fn(),
    },
  })),
}));

function createTextPart(overrides: Partial<TextPart> = {}): TextPart {
  return {
    id: "part-1",
    sessionID: "session-1",
    messageID: "msg-1",
    type: "text",
    text: "Hello world",
    ...overrides,
  };
}

function createToolPart(overrides: Partial<ToolPart> = {}): ToolPart {
  return {
    id: "tool-part-1",
    sessionID: "session-1",
    messageID: "msg-1",
    type: "tool",
    callID: "call-1",
    tool: "read_file",
    state: { status: "running", input: {}, time: { start: Date.now() } },
    ...overrides,
  };
}

function createToolState(
  status: "pending" | "running" | "completed" | "error",
): ToolState {
  const now = Date.now();
  switch (status) {
    case "pending":
      return { status: "pending", input: {}, raw: "" };
    case "running":
      return { status: "running", input: {}, time: { start: now } };
    case "completed":
      return {
        status: "completed",
        input: {},
        output: "",
        title: "Test",
        metadata: {},
        time: { start: now, end: now + 100 },
      };
    case "error":
      return {
        status: "error",
        input: {},
        error: "Test error",
        time: { start: now, end: now + 100 },
      };
  }
}

describe("OpenCode SSE Integration", () => {
  beforeEach(() => {
    useProjectStore.setState({
      sessionStatus: "idle",
      currentToolStates: new Map(),
      projects: [],
      currentProjectId: null,
      isLoading: false,
      isOpenCodeBusy: false,
      textSelection: null,
      analysisMetrics: null,
      isHydrated: false,
    });
  });

  describe("Event Type Guards", () => {
    it("isStreamMessagePartUpdated identifies part events", () => {
      const partEvent: StreamMessagePartUpdated = {
        type: "part",
        part: createTextPart(),
      };

      const statusEvent: StreamSessionStatus = {
        type: "status",
        sessionStatus: { type: "busy" },
        sessionId: "session-1",
      };

      expect(isStreamMessagePartUpdated(partEvent)).toBe(true);
      expect(isStreamMessagePartUpdated(statusEvent)).toBe(false);
    });

    it("isStreamQuestionAsked identifies question events", () => {
      const questionEvent: StreamQuestionAsked = {
        type: "question",
        data: {
          requestId: "req-1",
          sessionId: "session-1",
          questions: [
            {
              question: "Do you want to proceed?",
              header: "Confirmation",
              options: [{ label: "Yes" }, { label: "No" }],
            },
          ],
        },
      };

      const partEvent: StreamMessagePartUpdated = {
        type: "part",
        part: createTextPart(),
      };

      expect(isStreamQuestionAsked(questionEvent)).toBe(true);
      expect(isStreamQuestionAsked(partEvent)).toBe(false);
    });

    it("isStreamSessionStatus identifies status events", () => {
      const statusEvent: StreamSessionStatus = {
        type: "status",
        sessionStatus: { type: "busy" },
        sessionId: "session-1",
      };

      const errorEvent: StreamError = {
        type: "error",
        error: "Something went wrong",
      };

      expect(isStreamSessionStatus(statusEvent)).toBe(true);
      expect(isStreamSessionStatus(errorEvent)).toBe(false);
    });

    it("isStreamError identifies error events", () => {
      const errorEvent: StreamError = {
        type: "error",
        error: "Connection failed",
        sessionId: "session-1",
      };

      const doneEvent: StreamDone = {
        type: "done",
        sessionId: "session-1",
      };

      expect(isStreamError(errorEvent)).toBe(true);
      expect(isStreamError(doneEvent)).toBe(false);
    });

    it("isStreamDone identifies done events", () => {
      const doneEvent: StreamDone = {
        type: "done",
        sessionId: "session-1",
      };

      const partEvent: StreamMessagePartUpdated = {
        type: "part",
        part: createTextPart(),
      };

      expect(isStreamDone(doneEvent)).toBe(true);
      expect(isStreamDone(partEvent)).toBe(false);
    });

    it("isStreamFileEdited identifies file.edited events", () => {
      const fileEditedEvent: StreamFileEdited = {
        type: "file.edited",
        file: "/path/to/draft.md",
      };

      const statusEvent: StreamSessionStatus = {
        type: "status",
        sessionStatus: { type: "idle" },
        sessionId: "session-1",
      };

      expect(isStreamFileEdited(fileEditedEvent)).toBe(true);
      expect(isStreamFileEdited(statusEvent)).toBe(false);
    });
  });

  describe("Project Store Event Handlers", () => {
    it("handleStreamEvent processes part events with tool state", () => {
      const store = useProjectStore.getState();

      const toolPartEvent: StreamEvent = {
        type: "part",
        part: createToolPart({
          id: "tool-part-1",
          tool: "read_file",
          state: createToolState("running"),
        }),
      };

      store.handleStreamEvent(toolPartEvent);

      const updatedState = useProjectStore.getState();
      expect(updatedState.currentToolStates.has("tool-part-1")).toBe(true);

      const toolState = updatedState.currentToolStates.get("tool-part-1");
      expect(toolState?.toolName).toBe("read_file");
      expect(toolState?.state.status).toBe("running");
    });

    it("handleStreamEvent processes question events", () => {
      useProjectStore.setState({
        projects: [
          {
            id: "proj-1",
            name: "Test Project",
            contentType: "blog",
            brief: "Test brief",
            wordCount: 1000,
            styleHints: "",
            documentContent: "",
            messages: [],
            directoryPath: "/tmp/test",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        currentProjectId: "proj-1",
      });

      const store = useProjectStore.getState();

      const questionEvent: StreamEvent = {
        type: "question",
        data: {
          requestId: "req-123",
          sessionId: "session-456",
          questions: [
            {
              question: "Choose an option",
              header: "Selection",
              options: [{ label: "Option A" }, { label: "Option B" }],
            },
          ],
        },
      };

      store.handleStreamEvent(questionEvent);

      const updatedState = useProjectStore.getState();
      const project = updatedState.projects.find((p) => p.id === "proj-1");

      expect(project?.messages.length).toBe(1);
      expect(project?.messages[0].role).toBe("question");
      expect(project?.messages[0].questionData?.requestId).toBe("req-123");
    });

    it("handleStreamEvent updates session status", () => {
      const store = useProjectStore.getState();

      const statusEvent: StreamEvent = {
        type: "status",
        sessionStatus: { type: "busy" },
        sessionId: "session-1",
      };

      store.handleStreamEvent(statusEvent);

      const updatedState = useProjectStore.getState();
      expect(updatedState.sessionStatus).toBe("busy");
    });

    it("handleStreamEvent handles done event by setting idle", () => {
      useProjectStore.setState({ sessionStatus: "busy" });

      const store = useProjectStore.getState();

      const doneEvent: StreamEvent = {
        type: "done",
        sessionId: "session-1",
      };

      store.handleStreamEvent(doneEvent);

      const updatedState = useProjectStore.getState();
      expect(updatedState.sessionStatus).toBe("idle");
    });

    it("handleStreamEvent handles retry status with attempt number", () => {
      const store = useProjectStore.getState();

      const retryStatusEvent: StreamEvent = {
        type: "status",
        sessionStatus: {
          type: "retry",
          attempt: 2,
          message: "Retrying",
          next: 1000,
        },
        sessionId: "session-1",
      };

      store.handleStreamEvent(retryStatusEvent);

      const updatedState = useProjectStore.getState();
      expect(updatedState.sessionStatus).toBe("retry");
      expect(updatedState.retryAttempt).toBe(2);
    });

    it("updateToolState adds tool to currentToolStates", () => {
      const store = useProjectStore.getState();

      const toolState = createToolState("pending");
      store.updateToolState("tool-abc", toolState, "write_file");

      const updatedState = useProjectStore.getState();
      expect(updatedState.currentToolStates.has("tool-abc")).toBe(true);

      const stateEntry = updatedState.currentToolStates.get("tool-abc");
      expect(stateEntry?.toolName).toBe("write_file");
      expect(stateEntry?.state.status).toBe("pending");
    });

    it("updateToolState updates existing tool state", () => {
      const store = useProjectStore.getState();

      store.updateToolState("tool-xyz", createToolState("pending"), "bash");
      store.updateToolState("tool-xyz", createToolState("running"), "bash");

      const updatedState = useProjectStore.getState();
      const stateEntry = updatedState.currentToolStates.get("tool-xyz");
      expect(stateEntry?.state.status).toBe("running");
    });

    it("clearToolStates resets the map", () => {
      const store = useProjectStore.getState();

      store.updateToolState("tool-1", createToolState("running"), "read_file");
      store.updateToolState("tool-2", createToolState("pending"), "write_file");

      expect(useProjectStore.getState().currentToolStates.size).toBe(2);

      store.clearToolStates();

      const updatedState = useProjectStore.getState();
      expect(updatedState.currentToolStates.size).toBe(0);
    });
  });

  describe("Session Status Management", () => {
    it("setSessionStatus sets idle status", () => {
      const store = useProjectStore.getState();

      store.setSessionStatus({ type: "idle" });

      expect(useProjectStore.getState().sessionStatus).toBe("idle");
      expect(useProjectStore.getState().retryAttempt).toBeUndefined();
    });

    it("setSessionStatus sets busy status", () => {
      const store = useProjectStore.getState();

      store.setSessionStatus({ type: "busy" });

      expect(useProjectStore.getState().sessionStatus).toBe("busy");
      expect(useProjectStore.getState().retryAttempt).toBeUndefined();
    });

    it("setSessionStatus sets retry status with attempt", () => {
      const store = useProjectStore.getState();

      store.setSessionStatus({
        type: "retry",
        attempt: 3,
        message: "Retrying",
        next: 2000,
      });

      expect(useProjectStore.getState().sessionStatus).toBe("retry");
      expect(useProjectStore.getState().retryAttempt).toBe(3);
    });
  });

  describe("Abort Functionality", () => {
    it("abort endpoint calls session.abort", async () => {
      const mockAbort = vi.fn().mockResolvedValue({});
      const { getOpencodeClient } = await import("@/lib/opencode-client");

      vi.mocked(getOpencodeClient).mockReturnValue({
        session: {
          create: vi.fn(),
          promptAsync: vi.fn(),
          abort: mockAbort,
        },
        event: {
          subscribe: vi.fn(),
        },
      } as unknown as ReturnType<typeof getOpencodeClient>);

      const client = getOpencodeClient();
      await client.session.abort({ sessionID: "session-123" });

      expect(mockAbort).toHaveBeenCalledWith({ sessionID: "session-123" });
    });
  });

  describe("Text Part Events", () => {
    it("handles text part with delta", () => {
      const textPartEvent: StreamMessagePartUpdated = {
        type: "part",
        part: createTextPart({ text: "Hello world" }),
        delta: " world",
      };

      expect(isStreamMessagePartUpdated(textPartEvent)).toBe(true);
      expect(textPartEvent.delta).toBe(" world");
    });
  });

  describe("Error Event Handling", () => {
    it("handleStreamEvent logs error events", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const store = useProjectStore.getState();

      const errorEvent: StreamEvent = {
        type: "error",
        error: "Test error message",
        sessionId: "session-1",
      };

      store.handleStreamEvent(errorEvent);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[ProjectStore] Stream error:",
        "Test error message",
      );

      consoleSpy.mockRestore();
    });
  });

  describe("File Edited Event Handling", () => {
    it("handleStreamEvent logs file edited events", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const store = useProjectStore.getState();

      const fileEditedEvent: StreamEvent = {
        type: "file.edited",
        file: "/project/draft.md",
      };

      store.handleStreamEvent(fileEditedEvent);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[ProjectStore] File edited:",
        "/project/draft.md",
      );

      consoleSpy.mockRestore();
    });
  });
});
