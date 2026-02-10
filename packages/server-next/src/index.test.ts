/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAgentChatNextHandlers } from "./index";

const coreMock = vi.hoisted(() => {
  const opencode = {
    app: { agents: vi.fn() },
    session: {
      create: vi.fn(),
      messages: vi.fn(),
      delete: vi.fn(),
      get: vi.fn(),
      promptAsync: vi.fn(),
    },
    question: {
      reply: vi.fn(),
      reject: vi.fn(),
    },
  };

  return {
    opencode,
    ensureEventListener: vi.fn(),
    trackSession: vi.fn(),
    setMessages: vi.fn(),
    listTrackedSessions: vi.fn(),
    getSessionPreferences: vi.fn(),
    setSessionPreferences: vi.fn(),
    getSessionPreferencesByQuestionRequest: vi.fn(),
    getTrackedSession: vi.fn(),
    getMessages: vi.fn(),
    getSessionStatus: vi.fn(),
    getPendingQuestion: vi.fn(),
    subscribe: vi.fn(),
    untrackSession: vi.fn(),
    setDisplayOverride: vi.fn(),
    getDisplayOverrides: vi.fn(),
  };
});

vi.mock("@agent-chat/server-core", () => {
  return coreMock;
});

function makeSession(id: string) {
  return {
    id,
    title: `Session ${id}`,
    time: { created: Date.now(), updated: Date.now() },
  };
}

describe("createAgentChatNextHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    coreMock.listTrackedSessions.mockReturnValue([]);
    coreMock.getSessionPreferences.mockReturnValue({});
    coreMock.setSessionPreferences.mockReset();
    coreMock.getSessionPreferencesByQuestionRequest.mockReturnValue({});
    coreMock.getTrackedSession.mockReturnValue(undefined);
    coreMock.getMessages.mockReturnValue([]);
    coreMock.getSessionStatus.mockReturnValue({ type: "idle" });
    coreMock.getPendingQuestion.mockReturnValue(null);
    coreMock.subscribe.mockImplementation(() => () => undefined);

    coreMock.opencode.app.agents.mockResolvedValue({ data: [], error: null });
    coreMock.opencode.session.create.mockResolvedValue({
      data: makeSession("created"),
      error: null,
    });
    coreMock.opencode.session.messages.mockResolvedValue({
      data: [],
      error: null,
    });
    coreMock.opencode.session.delete.mockResolvedValue({
      data: null,
      error: null,
    });
    coreMock.opencode.session.get.mockResolvedValue({
      data: makeSession("found"),
      error: null,
    });
    coreMock.opencode.session.promptAsync.mockResolvedValue({
      data: null,
      error: null,
    });
    coreMock.opencode.question.reply.mockResolvedValue({
      data: null,
      error: null,
    });
    coreMock.opencode.question.reject.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  it("creates a session with agent and directory preferences", async () => {
    const handlers = createAgentChatNextHandlers();
    const response = await handlers.sessions.POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Session 1",
          agent: "builder",
          directory: "/tmp/project",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(coreMock.ensureEventListener).toHaveBeenCalledWith("/tmp/project");
    expect(coreMock.trackSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: "created" }),
      { agent: "builder", directory: "/tmp/project" },
    );
    expect(coreMock.opencode.session.messages).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionID: "created",
        directory: "/tmp/project",
      }),
    );
  });

  it("uses directory query param fallback for message POST", async () => {
    const handlers = createAgentChatNextHandlers();
    const response = await handlers.messages.POST(
      new Request(
        "http://localhost/api/sessions/ses_1/messages?directory=/tmp/project",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "hello" }),
        },
      ),
      { params: Promise.resolve({ sessionId: "ses_1" }) },
    );

    expect(response.status).toBe(202);
    expect(coreMock.ensureEventListener).toHaveBeenCalledWith("/tmp/project");
    expect(coreMock.opencode.session.get).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionID: "ses_1",
        directory: "/tmp/project",
      }),
    );
    expect(coreMock.trackSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: "found" }),
      { directory: "/tmp/project" },
    );
    expect(coreMock.opencode.session.promptAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionID: "ses_1",
        directory: "/tmp/project",
      }),
    );
  });

  it("persists recovered directory on tracked session for message POST", async () => {
    coreMock.getTrackedSession.mockReturnValue({ id: "ses_1" });

    const handlers = createAgentChatNextHandlers();
    const response = await handlers.messages.POST(
      new Request(
        "http://localhost/api/sessions/ses_1/messages?directory=/tmp/project",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "hello" }),
        },
      ),
      { params: Promise.resolve({ sessionId: "ses_1" }) },
    );

    expect(response.status).toBe(202);
    expect(coreMock.setSessionPreferences).toHaveBeenCalledWith("ses_1", {
      directory: "/tmp/project",
    });
  });

  it("uses directory query param fallback for events GET", async () => {
    const handlers = createAgentChatNextHandlers();
    const response = await handlers.events.GET(
      new Request(
        "http://localhost/api/sessions/ses_1/events?directory=/tmp/project",
      ),
      { params: Promise.resolve({ sessionId: "ses_1" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(coreMock.ensureEventListener).toHaveBeenCalledWith("/tmp/project");
    expect(coreMock.opencode.session.get).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionID: "ses_1",
        directory: "/tmp/project",
      }),
    );
    expect(coreMock.trackSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: "found" }),
      { directory: "/tmp/project" },
    );

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    const first = await reader?.read();
    const chunk = new TextDecoder().decode(first?.value);
    expect(chunk).toContain("event: snapshot");
    await reader?.cancel();
  });

  it("persists recovered directory on tracked session for events GET", async () => {
    coreMock.getTrackedSession.mockReturnValue({ id: "ses_1" });

    const handlers = createAgentChatNextHandlers();
    const response = await handlers.events.GET(
      new Request(
        "http://localhost/api/sessions/ses_1/events?directory=/tmp/project",
      ),
      { params: Promise.resolve({ sessionId: "ses_1" }) },
    );

    expect(response.status).toBe(200);
    expect(coreMock.setSessionPreferences).toHaveBeenCalledWith("ses_1", {
      directory: "/tmp/project",
    });

    const reader = response.body?.getReader();
    await reader?.cancel();
  });

  it("returns 400 when posting an empty message", async () => {
    coreMock.getSessionPreferences.mockReturnValue({
      directory: "/tmp/project",
    });

    const handlers = createAgentChatNextHandlers();
    const response = await handlers.messages.POST(
      new Request("http://localhost/api/sessions/ses_1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "   " }),
      }),
      { params: Promise.resolve({ sessionId: "ses_1" }) },
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Message content is required");
  });
});
