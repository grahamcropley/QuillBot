/**
 * @vitest-environment node
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  clearQuestion,
  getMessages,
  getPendingQuestion,
  getSessionPreferences,
  getSessionPreferencesByQuestionRequest,
  getSessionStatus,
  getTrackedSession,
  removeMessage,
  removePart,
  setMessages,
  setQuestion,
  setSessionPreferences,
  setSessionStatus,
  subscribe,
  trackSession,
  untrackSession,
  upsertMessage,
  upsertPart,
  setDisplayOverride,
  getDisplayOverrides,
} from "./sessionStore";

function makeSession(id: string) {
  return {
    id,
    title: `Session ${id}`,
    time: { created: 1, updated: 1 },
  } as unknown as Parameters<typeof trackSession>[0];
}

function makeMessage(sessionId: string, messageId: string, role: "user" | "assistant" = "user") {
  return {
    id: messageId,
    sessionID: sessionId,
    role,
    time: { created: 1, updated: 1 },
  } as unknown as Parameters<typeof upsertMessage>[1];
}

function makePart(sessionId: string, messageId: string, partId: string) {
  return {
    id: partId,
    sessionID: sessionId,
    messageID: messageId,
    type: "text",
    text: "part",
  } as unknown as Parameters<typeof upsertPart>[1];
}

function makeQuestion(sessionId: string, requestId: string) {
  return {
    id: requestId,
    sessionID: sessionId,
    questions: [],
  } as unknown as Parameters<typeof setQuestion>[1];
}

afterEach(() => {
  untrackSession("ses-a");
  untrackSession("ses-b");
  untrackSession("ses-c");
  untrackSession("ses-d");
});

describe("sessionStore", () => {
  it("tracks sessions with preferences and does not overwrite existing session", () => {
    trackSession(makeSession("ses-a"), { agent: "alpha", directory: "/repo/a" });
    trackSession(makeSession("ses-a"), { agent: "beta", directory: "/repo/b" });

    expect(getTrackedSession("ses-a")).toBeDefined();
    expect(getSessionPreferences("ses-a")).toEqual({ agent: "alpha", directory: "/repo/a" });
  });

  it("emits messages/status/question events and stops after unsubscribe", () => {
    trackSession(makeSession("ses-a"));

    const events: string[] = [];
    const unsubscribe = subscribe("ses-a", (event) => {
      events.push(event.type);
    });

    upsertMessage("ses-a", makeMessage("ses-a", "m1"));
    setSessionStatus("ses-a", { type: "busy" } as Parameters<typeof setSessionStatus>[1]);
    setQuestion("ses-a", makeQuestion("ses-a", "req-1"));

    unsubscribe();
    clearQuestion("ses-a");

    expect(events).toEqual(["messages", "status", "question"]);
  });

  it("stores, updates, and removes message parts", () => {
    trackSession(makeSession("ses-a"));

    upsertMessage("ses-a", makeMessage("ses-a", "m1"));
    upsertPart("ses-a", makePart("ses-a", "m1", "p1"));
    upsertPart("ses-a", makePart("ses-a", "m1", "p1"));

    expect(getMessages("ses-a")[0]?.parts).toHaveLength(1);

    removePart("ses-a", "m1", "p1");
    expect(getMessages("ses-a")[0]?.parts).toHaveLength(0);
  });

  it("removes messages and supports full setMessages replacement", () => {
    trackSession(makeSession("ses-a"));

    upsertMessage("ses-a", makeMessage("ses-a", "m1"));
    removeMessage("ses-a", "m1");
    expect(getMessages("ses-a")).toHaveLength(0);

    setMessages("ses-a", [
      {
        info: makeMessage("ses-a", "m2", "assistant"),
        parts: [makePart("ses-a", "m2", "p2")],
      },
    ]);

    expect(getMessages("ses-a")).toHaveLength(1);
    expect(getMessages("ses-a")[0]?.info.id).toBe("m2");
  });

  it("resolves question-linked preferences and clears state", () => {
    trackSession(makeSession("ses-a"), { directory: "/repo/a", agent: "alpha" });

    setQuestion("ses-a", makeQuestion("ses-a", "req-42"));
    expect(getPendingQuestion("ses-a")?.id).toBe("req-42");
    expect(getSessionPreferencesByQuestionRequest("req-42")).toEqual({
      directory: "/repo/a",
      agent: "alpha",
    });

    clearQuestion("ses-a");
    expect(getPendingQuestion("ses-a")).toBeNull();
    expect(getSessionPreferencesByQuestionRequest("req-42")).toEqual({});
  });

  it("updates session preferences and status defaults", () => {
    trackSession(makeSession("ses-a"));

    expect(getSessionStatus("ses-a")).toEqual({ type: "idle" });

    setSessionPreferences("ses-a", { agent: "omega", directory: "/repo/omega" });
    expect(getSessionPreferences("ses-a")).toEqual({ agent: "omega", directory: "/repo/omega" });

    setSessionStatus("ses-a", { type: "retry" } as Parameters<typeof setSessionStatus>[1]);
    expect(getSessionStatus("ses-a")).toEqual({ type: "retry" });
  });

  it("stores and retrieves display overrides", () => {
    trackSession(makeSession("ses-a"));

    expect(getDisplayOverrides("ses-a")).toEqual({});

    setDisplayOverride("ses-a", "hello world", {
      displayContent: "hello world",
      contextItemCount: 2,
    });

    setDisplayOverride("ses-a", "fix this", {
      displayContent: "fix this",
      contextItemCount: 1,
    });

    expect(getDisplayOverrides("ses-a")).toEqual({
      "hello world": { displayContent: "hello world", contextItemCount: 2 },
      "fix this": { displayContent: "fix this", contextItemCount: 1 },
    });
  });

  it("returns empty display overrides for unknown session", () => {
    expect(getDisplayOverrides("unknown")).toEqual({});
  });
});
