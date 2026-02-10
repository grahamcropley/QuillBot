/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const subscribe = vi.fn();

  return {
    opencode: {
      event: {
        subscribe,
      },
    },
    subscribe,
    upsertMessage: vi.fn(),
    removeMessage: vi.fn(),
    upsertPart: vi.fn(),
    removePart: vi.fn(),
    setSessionStatus: vi.fn(),
    updateSessionInfo: vi.fn(),
    getTrackedSession: vi.fn(),
    setQuestion: vi.fn(),
    clearQuestion: vi.fn(),
    errorSpy: vi.spyOn(console, "error").mockImplementation(() => undefined),
  };
});

vi.mock("./opencode", () => ({
  opencode: state.opencode,
}));

vi.mock("./sessionStore", () => ({
  upsertMessage: state.upsertMessage,
  removeMessage: state.removeMessage,
  upsertPart: state.upsertPart,
  removePart: state.removePart,
  setSessionStatus: state.setSessionStatus,
  updateSessionInfo: state.updateSessionInfo,
  getTrackedSession: state.getTrackedSession,
  setQuestion: state.setQuestion,
  clearQuestion: state.clearQuestion,
}));

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForCalls() {
  await vi.waitFor(() => {
    expect(state.clearQuestion).toHaveBeenCalledWith("ses-1");
  });
}

describe("ensureEventListener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.errorSpy.mockClear();
    state.getTrackedSession.mockReturnValue(undefined);
  });

  it("subscribes once per directory key while listener is running", async () => {
    state.subscribe.mockResolvedValue({
      stream: (async function* () {
        await new Promise((resolve) => setTimeout(resolve, 20));
      })(),
    });

    const { ensureEventListener } = await import("./eventListener");

    await Promise.all([
      ensureEventListener("/repo/a"),
      ensureEventListener("/repo/a"),
    ]);

    expect(state.subscribe).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setTimeout(resolve, 30));
    await ensureEventListener("/repo/a");
    expect(state.subscribe).toHaveBeenCalledTimes(2);
  });

  it("routes supported stream events to store updaters for tracked sessions", async () => {
    state.getTrackedSession.mockImplementation((sessionId: string) =>
      sessionId === "ses-1" ? ({ id: "ses-1" } as object) : undefined,
    );

    state.subscribe.mockResolvedValue({
      stream: (async function* () {
        yield {
          type: "message.updated",
          properties: { info: { id: "m1", sessionID: "ses-1" } },
        };
        yield {
          type: "message.removed",
          properties: { sessionID: "ses-1", messageID: "m1" },
        };
        yield {
          type: "message.part.updated",
          properties: { part: { id: "p1", sessionID: "ses-1", messageID: "m1" } },
        };
        yield {
          type: "message.part.removed",
          properties: { sessionID: "ses-1", messageID: "m1", partID: "p1" },
        };
        yield {
          type: "session.status",
          properties: { sessionID: "ses-1", status: { type: "busy" } },
        };
        yield {
          type: "session.updated",
          properties: { info: { id: "ses-1" } },
        };
        yield {
          type: "question.asked",
          properties: { id: "req-1", sessionID: "ses-1", questions: [] },
        };
        yield {
          type: "question.replied",
          properties: { sessionID: "ses-1" },
        };
      })(),
    });

    const { ensureEventListener } = await import("./eventListener");
    await ensureEventListener("/repo/b");
    await waitForCalls();

    expect(state.upsertMessage).toHaveBeenCalledWith("ses-1", expect.objectContaining({ id: "m1" }));
    expect(state.removeMessage).toHaveBeenCalledWith("ses-1", "m1");
    expect(state.upsertPart).toHaveBeenCalledWith("ses-1", expect.objectContaining({ id: "p1" }));
    expect(state.removePart).toHaveBeenCalledWith("ses-1", "m1", "p1");
    expect(state.setSessionStatus).toHaveBeenCalledWith("ses-1", { type: "busy" });
    expect(state.updateSessionInfo).toHaveBeenCalledWith(expect.objectContaining({ id: "ses-1" }));
    expect(state.setQuestion).toHaveBeenCalledWith("ses-1", expect.objectContaining({ id: "req-1" }));
    expect(state.clearQuestion).toHaveBeenCalledWith("ses-1");
  });

  it("ignores session-bound events for untracked sessions", async () => {
    state.getTrackedSession.mockReturnValue(undefined);
    state.subscribe.mockResolvedValue({
      stream: (async function* () {
        yield {
          type: "message.removed",
          properties: { sessionID: "ses-missing", messageID: "m1" },
        };
      })(),
    });

    const { ensureEventListener } = await import("./eventListener");
    await ensureEventListener("/repo/c");
    await settle();

    expect(state.removeMessage).not.toHaveBeenCalled();
  });

  it("logs subscribe and stream errors without throwing", async () => {
    state.subscribe.mockRejectedValueOnce(new Error("boom-subscribe"));

    const { ensureEventListener } = await import("./eventListener");
    await expect(ensureEventListener("/repo/x")).resolves.toBeUndefined();
    expect(state.errorSpy).toHaveBeenCalledWith(
      "[eventListener] Failed to connect to OpenCode SSE:",
      expect.any(Error),
    );

    state.subscribe.mockResolvedValueOnce({
      stream: {
        [Symbol.asyncIterator]() {
          return {
            next: async () => {
              throw new Error("boom-stream");
            },
          };
        },
      },
    });

    await expect(ensureEventListener("/repo/y")).resolves.toBeUndefined();
    await settle();
    expect(state.errorSpy).toHaveBeenCalledWith(
      "[eventListener] SSE stream error:",
      expect.any(Error),
    );
  });
});
