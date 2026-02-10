import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentChat } from "./agent-chat";
import type { Message, ContextItem } from "./agent-chat.types";

function makeRawMessages(messages: Message[]) {
  return messages.map((m) => ({
    info: {
      id: m.id,
      sessionID: m.sessionId,
      role: m.role,
      time: { created: m.createdAt, completed: m.completedAt },
    },
    parts: m.parts.map((p) => ({
      id: p.id,
      type: p.type,
      text: p.text,
      tool: p.tool,
      state: p.toolStatus
        ? { status: p.toolStatus, title: p.toolTitle, input: p.toolInput }
        : undefined,
    })),
  }));
}

let mockESInstance: {
  listeners: Record<string, ((e: MessageEvent) => void)[]>;
  close: ReturnType<typeof vi.fn>;
  onerror: (() => void) | null;
  addEventListener: (event: string, cb: (e: MessageEvent) => void) => void;
  removeEventListener: () => void;
};
let mockEventSourceUrl = "";

function createMockEventSourceClass() {
  return function MockEventSource(url: string | URL) {
    mockEventSourceUrl = String(url);
    mockESInstance = {
      listeners: {},
      close: vi.fn(),
      onerror: null,
      addEventListener(event: string, cb: (e: MessageEvent) => void) {
        if (!mockESInstance.listeners[event])
          mockESInstance.listeners[event] = [];
        mockESInstance.listeners[event].push(cb);
      },
      removeEventListener() {},
    };
    return mockESInstance;
  };
}

function emitSSE(event: string, data: unknown) {
  const cbs = mockESInstance.listeners[event];
  if (cbs) {
    for (const cb of cbs) {
      cb(new MessageEvent(event, { data: JSON.stringify(data) }));
    }
  }
}

beforeEach(() => {
  vi.stubGlobal("EventSource", createMockEventSourceClass());
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }),
  );
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AgentChat", () => {
  it("renders empty state", async () => {
    render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", { messages: [], status: { type: "idle" } });
    });

    await waitFor(() => {
      expect(screen.getByText("Start a conversation")).toBeInTheDocument();
    });
  });

  it("renders messages from SSE snapshot", async () => {
    const messages: Message[] = [
      {
        id: "m1",
        sessionId: "ses_1",
        role: "user",
        createdAt: 1,
        parts: [{ id: "p1", type: "text", text: "Hello" }],
      },
      {
        id: "m2",
        sessionId: "ses_1",
        role: "assistant",
        createdAt: 2,
        parts: [{ id: "p2", type: "text", text: "Hi there!" }],
      },
    ];

    render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", {
        messages: makeRawMessages(messages),
        status: { type: "idle" },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Hello")).toBeInTheDocument();
      expect(screen.getByText("Hi there!")).toBeInTheDocument();
    });
  });

  it("renders custom placeholder", async () => {
    render(<AgentChat sessionId="ses_1" placeholder="Ask me anything..." />);

    act(() => {
      emitSSE("snapshot", { messages: [], status: { type: "idle" } });
    });

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Ask me anything..."),
      ).toBeInTheDocument();
    });
  });

  it("renders send button", async () => {
    render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", { messages: [], status: { type: "idle" } });
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /send message/i }),
      ).toBeInTheDocument();
    });
  });

  it("passes directory to events and message endpoints", async () => {
    const user = userEvent.setup();
    render(<AgentChat sessionId="ses_1" directory="/tmp/my project" />);

    const eventUrl = new URL(mockEventSourceUrl);
    expect(eventUrl.pathname).toBe("/api/sessions/ses_1/events");
    expect(eventUrl.searchParams.get("directory")).toBe("/tmp/my project");

    act(() => {
      emitSSE("snapshot", { messages: [], status: { type: "idle" } });
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /send message/i }),
      ).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("Type a message..."), "hello");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    const calls = vi.mocked(fetch).mock.calls;
    const messageCall = calls.find((call) =>
      String(call[0]).includes("/api/sessions/ses_1/messages"),
    );
    expect(messageCall).toBeDefined();

    const messageUrl = new URL(String(messageCall?.[0]));
    expect(messageUrl.searchParams.get("directory")).toBe("/tmp/my project");
  });

  it("updates messages when SSE messages event fires", async () => {
    render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", { messages: [], status: { type: "idle" } });
    });

    await waitFor(() => {
      expect(screen.getByText("Start a conversation")).toBeInTheDocument();
    });

    const messages: Message[] = [
      {
        id: "m1",
        sessionId: "ses_1",
        role: "user",
        createdAt: 1,
        parts: [{ id: "p1", type: "text", text: "New message" }],
      },
    ];

    act(() => {
      emitSSE("messages", makeRawMessages(messages));
    });

    await waitFor(() => {
      expect(screen.getByText("New message")).toBeInTheDocument();
    });
  });

  it("renders consecutive activity items without collapse controls", async () => {
    const messages: Message[] = [
      {
        id: "m-activity",
        sessionId: "ses_1",
        role: "assistant",
        createdAt: 10,
        parts: [
          { id: "p-text", type: "text", text: "Running a few actions." },
          {
            id: "p-tool-1",
            type: "tool",
            toolStatus: "completed",
            toolTitle: "first.txt",
          },
          {
            id: "p-tool-2",
            type: "tool",
            toolStatus: "completed",
            toolTitle: "second.txt",
          },
          {
            id: "p-tool-3",
            type: "tool",
            toolStatus: "completed",
            toolTitle: "third.txt",
          },
        ],
      },
    ];

    render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", {
        messages: makeRawMessages(messages),
        status: { type: "idle" },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("first.txt")).toBeInTheDocument();
      expect(screen.getByText("second.txt")).toBeInTheDocument();
      expect(screen.getByText("third.txt")).toBeInTheDocument();
      expect(screen.queryByText("Show 1 more actions")).not.toBeInTheDocument();
      expect(screen.queryByText("Hide activity")).not.toBeInTheDocument();
    });
  });

  it("renders compact tool labels and hides step markers", async () => {
    const messages: Message[] = [
      {
        id: "m-steps",
        sessionId: "ses_1",
        role: "assistant",
        createdAt: 11,
        parts: [
          { id: "s1", type: "step-start", text: "patch file" },
          {
            id: "t1",
            type: "tool",
            toolStatus: "running",
            toolTitle: "data/projects/activity-demo.txt",
          },
          { id: "s2", type: "step-finish", text: "patch file" },
        ],
      },
    ];

    render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", {
        messages: makeRawMessages(messages),
        status: { type: "idle" },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("activity-demo.txt")).toBeInTheDocument();
      expect(
        screen.queryByText("data/projects/activity-demo.txt"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Step")).not.toBeInTheDocument();
      expect(screen.queryByText("Done")).not.toBeInTheDocument();
      expect(screen.queryByText("Show 1 more actions")).not.toBeInTheDocument();
    });
  });

  it("renders assistant activity-only messages without bubble chrome", async () => {
    const messages: Message[] = [
      {
        id: "m-activity-only",
        sessionId: "ses_1",
        role: "assistant",
        createdAt: 12,
        parts: [
          {
            id: "a1",
            type: "tool",
            toolStatus: "running",
            toolTitle: "activity.log",
          },
        ],
      },
    ];

    const { container } = render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", {
        messages: makeRawMessages(messages),
        status: { type: "busy" },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("activity.log")).toBeInTheDocument();
      expect(container.querySelector(".bg-zinc-100")).not.toBeInTheDocument();
      const runningTool = screen.getByLabelText("Tool activity.log running");
      expect(
        runningTool.querySelector(".animate-spin"),
      ).not.toBeInTheDocument();
    });
  });

  it("treats empty assistant text plus activity as activity-only (no bubble chrome)", async () => {
    const messages: Message[] = [
      {
        id: "m-activity-empty-text",
        sessionId: "ses_1",
        role: "assistant",
        createdAt: 13,
        parts: [
          { id: "empty", type: "text", text: "   " },
          {
            id: "tool",
            type: "tool",
            toolStatus: "completed",
            toolTitle: "activity.log",
          },
        ],
      },
    ];

    const { container } = render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", {
        messages: makeRawMessages(messages),
        status: { type: "idle" },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("activity.log")).toBeInTheDocument();
      expect(container.querySelector(".bg-zinc-100")).not.toBeInTheDocument();
    });
  });

  it("does not wrap activity rows with outer message bubble when mixed with assistant text", async () => {
    const messages: Message[] = [
      {
        id: "m-mixed",
        sessionId: "ses_1",
        role: "assistant",
        createdAt: 14,
        parts: [
          { id: "txt", type: "text", text: "Done. Updated the file." },
          {
            id: "tool",
            type: "tool",
            toolStatus: "completed",
            toolTitle: "read",
          },
        ],
      },
    ];

    const { container } = render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", {
        messages: makeRawMessages(messages),
        status: { type: "idle" },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Done. Updated the file.")).toBeInTheDocument();
      expect(screen.getByText("read")).toBeInTheDocument();
    });

    const status = container.querySelector("output");
    expect(status).not.toBeNull();
    expect(status?.closest(".bg-zinc-100")).toBeNull();
    expect(status?.closest(".mt-3")).not.toBeNull();
  });

  it("renders file activity pills with relative paths and write +/- summary", async () => {
    const messages: Message[] = [
      {
        id: "m-file-pill",
        sessionId: "ses_1",
        role: "assistant",
        createdAt: 15,
        parts: [
          {
            id: "read-1",
            type: "tool",
            tool: "read",
            toolStatus: "completed",
            toolTitle: "notes/todo.md",
            toolInput: {
              filePath: "/repo/project/notes/todo.md",
            },
          },
          {
            id: "write-1",
            type: "tool",
            tool: "write",
            toolStatus: "completed",
            toolTitle: "docs/draft.md",
            toolInput: {
              filePath: "/repo/project/docs/draft.md",
              diff: "@@ -1,2 +1,3 @@\n line one\n-line two\n+line two updated\n+line three",
            },
          },
        ],
      },
    ];

    render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", {
        messages: makeRawMessages(messages),
        status: { type: "idle" },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("READ")).toBeInTheDocument();
      expect(screen.getByText("notes/todo.md")).toBeInTheDocument();
      expect(screen.queryByText(/\[Lines 0-/i)).not.toBeInTheDocument();
      expect(screen.getByText("WRITE")).toBeInTheDocument();
      expect(screen.getByText("docs/draft.md")).toBeInTheDocument();
      expect(screen.getByText("+2")).toBeInTheDocument();
      expect(screen.getByText("-1")).toBeInTheDocument();
    });

    const readPill = screen.getByText("READ");
    expect(readPill.className).toContain("bg-emerald-600");
  });

  it("shows file tool error detail in the activity label", async () => {
    render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", {
        messages: [
          {
            info: {
              id: "m-file-error",
              sessionID: "ses_1",
              role: "assistant",
              time: { created: 18, completed: 18 },
            },
            parts: [
              {
                id: "read-error-1",
                type: "tool",
                tool: "read",
                state: {
                  status: "error",
                  title: "brief.md",
                  input: {
                    filePath:
                      "/home/graham/github/QuillBot/data/projects/proj_1770688342415_97wr9zk/brief.md",
                  },
                  error:
                    "Error: File not found: /home/graham/github/QuillBot/data/projects/proj_1770688342415_97wr9zk/brief.md",
                },
              },
            ],
          },
        ],
        status: { type: "idle" },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("READ")).toBeInTheDocument();
      expect(screen.getByText("brief.md")).toBeInTheDocument();
      expect(screen.getByText("[Not Found]")).toBeInTheDocument();
      expect(
        screen.queryByText(
          "/home/graham/github/QuillBot/data/projects/proj_1770688342415_97wr9zk/brief.md",
        ),
      ).not.toBeInTheDocument();
    });
  });

  it("renders apply_patch activity as UPDATE", async () => {
    const messages: Message[] = [
      {
        id: "m-apply-patch-pill",
        sessionId: "ses_1",
        role: "assistant",
        createdAt: 19,
        parts: [
          {
            id: "apply-patch-1",
            type: "tool",
            tool: "apply_patch",
            toolStatus: "completed",
            toolTitle: "draft.md",
            toolInput: {
              path: "draft.md",
            },
          },
        ],
      },
    ];

    render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", {
        messages: makeRawMessages(messages),
        status: { type: "idle" },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("UPDATE")).toBeInTheDocument();
      expect(screen.queryByText("APPLY_")).not.toBeInTheDocument();
    });
  });

  it("shows attempted URL for failed webfetch activity", async () => {
    const messages: Message[] = [
      {
        id: "m-webfetch-error",
        sessionId: "ses_1",
        role: "assistant",
        createdAt: 20,
        parts: [
          {
            id: "webfetch-error-1",
            type: "tool",
            tool: "webfetch",
            toolStatus: "error",
            toolTitle: "webfetch",
            toolInput: {
              url: "https://www.googggle.co.uk",
            },
          },
        ],
      },
    ];

    render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", {
        messages: makeRawMessages(messages),
        status: { type: "idle" },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("WEB")).toBeInTheDocument();
      expect(
        screen.getByText("https://www.googggle.co.uk"),
      ).toBeInTheDocument();
      expect(screen.queryByText("webfetch")).not.toBeInTheDocument();
    });
  });

  it("renders edit activities as UPDATE with orange styling", async () => {
    const messages: Message[] = [
      {
        id: "m-edit-pill",
        sessionId: "ses_1",
        role: "assistant",
        createdAt: 15,
        parts: [
          {
            id: "edit-1",
            type: "tool",
            tool: "edit",
            toolStatus: "completed",
            toolTitle: "docs/draft.md",
            toolInput: {
              filePath: "/repo/project/docs/draft.md",
              diff: "@@ -1,2 +1,3 @@\n line one\n-line two\n+line two updated\n+line three",
            },
          },
        ],
      },
    ];

    render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", {
        messages: makeRawMessages(messages),
        status: { type: "idle" },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("UPDATE")).toBeInTheDocument();
      expect(screen.getByText("draft.md")).toBeInTheDocument();
      expect(screen.queryByText("docs/draft.md")).not.toBeInTheDocument();
      expect(screen.getByText("+2")).toBeInTheDocument();
      expect(screen.getByText("-1")).toBeInTheDocument();
    });

    const updatePill = screen.getByText("UPDATE");
    expect(updatePill.className).toContain("bg-amber-600");
  });

  it("shows READ offset/limit metadata for partial file reads", async () => {
    const messages: Message[] = [
      {
        id: "m-read-slice",
        sessionId: "ses_1",
        role: "assistant",
        createdAt: 16,
        parts: [
          {
            id: "read-slice-1",
            type: "tool",
            tool: "read",
            toolStatus: "completed",
            toolTitle: "docs/large-file.md",
            toolInput: {
              filePath: "/repo/project/docs/large-file.md",
              offset: 120,
              limit: 40,
            },
          },
        ],
      },
    ];

    render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", {
        messages: makeRawMessages(messages),
        status: { type: "idle" },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("READ")).toBeInTheDocument();
      expect(screen.getByText("docs/large-file.md")).toBeInTheDocument();
      expect(screen.getByText("[Lines 120-160]")).toBeInTheDocument();
    });
  });

  it("shows only changed lines when expanding UPDATE diff", async () => {
    const user = userEvent.setup();
    const messages: Message[] = [
      {
        id: "m-update-diff-filter",
        sessionId: "ses_1",
        role: "assistant",
        createdAt: 16,
        parts: [
          {
            id: "edit-2",
            type: "tool",
            tool: "edit",
            toolStatus: "completed",
            toolTitle: "docs/draft.md",
            toolInput: {
              filePath: "/repo/project/docs/draft.md",
              diff: "--- a/docs/draft.md\n+++ b/docs/draft.md\n@@ -1,3 +1,3 @@\n line one\n-line two\n+line two updated\n line three",
            },
          },
        ],
      },
    ];

    render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", {
        messages: makeRawMessages(messages),
        status: { type: "idle" },
      });
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /expand update diff for draft\.md/i,
        }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", {
        name: /expand update diff for draft\.md/i,
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("-line two")).toBeInTheDocument();
      expect(screen.getByText("+line two updated")).toBeInTheDocument();
      expect(screen.queryByText("--- a/docs/draft.md")).not.toBeInTheDocument();
      expect(screen.queryByText("+++ b/docs/draft.md")).not.toBeInTheDocument();
      expect(screen.queryByText("@@ -1,3 +1,3 @@")).not.toBeInTheDocument();
      expect(screen.queryByText(" line one")).not.toBeInTheDocument();
      expect(screen.queryByText(" line three")).not.toBeInTheDocument();
    });
  });

  it("summarizes multi-file UPDATE activity and splits expanded output by filename", async () => {
    const user = userEvent.setup();
    const messages: Message[] = [
      {
        id: "m-update-multi-file",
        sessionId: "ses_1",
        role: "assistant",
        createdAt: 16,
        parts: [
          {
            id: "apply-patch-multi",
            type: "tool",
            tool: "apply_patch",
            toolStatus: "completed",
            toolTitle: "Success",
            toolInput: {
              patchText:
                "*** Begin Patch\n*** Update File: data/projects/proj_1/draft.md\n@@\n-old line\n+new line\n+extra line\n*** Update File: data/projects/proj_1/brief.md\n@@\n-old brief\n+new brief\n*** End Patch",
            },
          },
        ],
      },
    ];

    render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", {
        messages: makeRawMessages(messages),
        status: { type: "idle" },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("UPDATE")).toBeInTheDocument();
      expect(
        screen.getByText("Success. draft.md [+2/-1], brief.md [+1/-1]"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("data/projects/proj_1/draft.md"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("data/projects/proj_1/brief.md"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: /expand update diff for multiple files/i,
        }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", {
        name: /expand update diff for multiple files/i,
      }),
    );

    await waitFor(() => {
      expect(screen.getAllByText("draft.md").length).toBeGreaterThan(0);
      expect(screen.getAllByText("brief.md").length).toBeGreaterThan(0);
      expect(screen.getByText("-old line")).toBeInTheDocument();
      expect(screen.getByText("+new line")).toBeInTheDocument();
      expect(screen.getByText("+extra line")).toBeInTheDocument();
      expect(screen.getByText("-old brief")).toBeInTheDocument();
      expect(screen.getByText("+new brief")).toBeInTheDocument();
    });
  });

  it("uses write metadata diff stats in collapsed summary", async () => {
    render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", {
        messages: [
          {
            info: {
              id: "m-file-metadata",
              sessionID: "ses_1",
              role: "assistant",
              time: { created: 17, completed: 17 },
            },
            parts: [
              {
                id: "write-metadata",
                type: "tool",
                tool: "write",
                state: {
                  status: "completed",
                  title: "docs/spec.md",
                  input: {
                    filePath: "/repo/project/docs/spec.md",
                  },
                  metadata: {
                    diff: "--- a/docs/spec.md\n+++ b/docs/spec.md\n@@ -1,1 +1,1 @@\n-old\n+new",
                    filediff: {
                      file: "/repo/project/docs/spec.md",
                      additions: 12,
                      deletions: 5,
                    },
                  },
                },
              },
            ],
          },
        ],
        status: { type: "idle" },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("docs/spec.md")).toBeInTheDocument();
      expect(screen.getByText("+12")).toBeInTheDocument();
      expect(screen.getByText("-5")).toBeInTheDocument();
    });
  });

  it("shows write line-count fallback and expands to raw content when diff stats are unavailable", async () => {
    const user = userEvent.setup();
    const messages: Message[] = [
      {
        id: "m-file-no-stats",
        sessionId: "ses_1",
        role: "assistant",
        createdAt: 18,
        parts: [
          {
            id: "write-no-stats",
            type: "tool",
            tool: "write",
            toolStatus: "completed",
            toolTitle: "docs/notes.md",
            toolInput: {
              filePath: "/repo/project/docs/notes.md",
              content: "Hello world",
            },
          },
        ],
      },
    ];

    render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", {
        messages: makeRawMessages(messages),
        status: { type: "idle" },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("docs/notes.md")).toBeInTheDocument();
      expect(screen.getByText("+1")).toBeInTheDocument();
      expect(
        screen.queryByText("docs/notes.md [+0/-0]"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: /expand write content for docs\/notes\.md/i,
        }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Hello world")).not.toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", {
        name: /expand write content for docs\/notes\.md/i,
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("Hello world")).toBeInTheDocument();
    });
  });

  it("expands write activity to show line diff", async () => {
    const user = userEvent.setup();
    const messages: Message[] = [
      {
        id: "m-file-diff",
        sessionId: "ses_1",
        role: "assistant",
        createdAt: 16,
        parts: [
          {
            id: "write-2",
            type: "tool",
            tool: "write",
            toolStatus: "completed",
            toolTitle: "docs/draft.md",
            toolInput: {
              filePath: "/repo/project/docs/draft.md",
              diff: "--- a/docs/draft.md\n+++ b/docs/draft.md\n@@ -1,2 +1,3 @@\n line one\n-line two\n+line two updated\n+line three",
            },
          },
        ],
      },
    ];

    render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", {
        messages: makeRawMessages(messages),
        status: { type: "idle" },
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("@@ -1,2 +1,3 @@")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: /expand write diff for docs\/draft\.md/i,
        }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", {
        name: /expand write diff for docs\/draft\.md/i,
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("@@ -1,2 +1,3 @@")).toBeInTheDocument();
      expect(screen.getByText("-line two")).toBeInTheDocument();
      expect(screen.getByText("+line two updated")).toBeInTheDocument();
      expect(screen.getByText("+line three")).toBeInTheDocument();
    });
  });

  it("renders inline images in assistant markdown", async () => {
    const messages: Message[] = [
      {
        id: "m1",
        sessionId: "ses_1",
        role: "assistant",
        createdAt: 1,
        parts: [
          {
            id: "p1",
            type: "text",
            text: "Here is a diagram:\n\n![architecture diagram](https://example.com/diagram.png)\n\nAnd an inline ![icon](https://example.com/icon.svg) image.",
          },
        ],
      },
    ];

    render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", {
        messages: makeRawMessages(messages),
        status: { type: "idle" },
      });
    });

    await waitFor(() => {
      const images = screen.getAllByRole("img");
      expect(images).toHaveLength(2);
      expect(images[0]).toHaveAttribute(
        "src",
        "https://example.com/diagram.png",
      );
      expect(images[0]).toHaveAttribute("alt", "architecture diagram");
      expect(images[0]).toHaveAttribute("loading", "lazy");
      expect(images[1]).toHaveAttribute("src", "https://example.com/icon.svg");
      expect(images[1]).toHaveAttribute("alt", "icon");
    });
  });

  it("closes EventSource on unmount", async () => {
    const { unmount } = render(<AgentChat sessionId="ses_1" />);

    act(() => {
      emitSSE("snapshot", { messages: [], status: { type: "idle" } });
    });

    unmount();

    expect(mockESInstance.close).toHaveBeenCalled();
  });

  describe("question modal", () => {
    const singleQuestion = {
      id: "req_1",
      sessionID: "ses_1",
      questions: [
        {
          question: "Which framework do you prefer?",
          header: "Framework",
          options: [
            {
              label: "React",
              description: "A JavaScript library for building UIs",
            },
            {
              label: "Vue",
              description: "The progressive JavaScript framework",
            },
          ],
          multiple: false,
          custom: true,
        },
      ],
    };

    const multiQuestion = {
      id: "req_2",
      sessionID: "ses_1",
      questions: [
        {
          question: "Pick a language",
          header: "Language",
          options: [
            { label: "TypeScript", description: "Typed JavaScript" },
            { label: "Python", description: "General purpose" },
          ],
        },
        {
          question: "Pick a database",
          header: "Database",
          options: [
            { label: "PostgreSQL", description: "Relational" },
            { label: "MongoDB", description: "Document store" },
          ],
        },
      ],
    };

    it("renders question modal when question SSE event fires", async () => {
      render(<AgentChat sessionId="ses_1" />);

      act(() => {
        emitSSE("snapshot", {
          messages: [],
          status: { type: "idle" },
          question: null,
        });
      });

      act(() => {
        emitSSE("question", singleQuestion);
      });

      await waitFor(() => {
        expect(
          screen.getByText("Which framework do you prefer?"),
        ).toBeInTheDocument();
        expect(screen.getByText("React")).toBeInTheDocument();
        expect(screen.getByText("Vue")).toBeInTheDocument();
      });
    });

    it("renders question modal from snapshot", async () => {
      render(<AgentChat sessionId="ses_1" />);

      act(() => {
        emitSSE("snapshot", {
          messages: [],
          status: { type: "idle" },
          question: singleQuestion,
        });
      });

      await waitFor(() => {
        expect(
          screen.getByText("Which framework do you prefer?"),
        ).toBeInTheDocument();
      });
    });

    it("submits single question and creates pseudo-message", async () => {
      const user = userEvent.setup();
      render(<AgentChat sessionId="ses_1" />);

      act(() => {
        emitSSE("snapshot", {
          messages: [],
          status: { type: "idle" },
          question: singleQuestion,
        });
      });

      await waitFor(() => {
        expect(screen.getByText("React")).toBeInTheDocument();
      });

      // Select an option
      await user.click(screen.getByText("React"));

      // Submit
      await user.click(screen.getByRole("button", { name: /submit/i }));

      // Verify fetch was called with answer
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          "/api/questions/req_1/reply",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ answers: [["React"]] }),
          }),
        );
      });

      // Pseudo-message should appear
      await waitFor(() => {
        expect(screen.getByText("Question Answered")).toBeInTheDocument();
      });
    });

    it("keeps pseudo question-response bubble after remount for same session", async () => {
      const user = userEvent.setup();
      const firstRender = render(<AgentChat sessionId="ses_1" />);

      act(() => {
        emitSSE("snapshot", {
          messages: [],
          status: { type: "idle" },
          question: singleQuestion,
        });
      });

      await waitFor(() => {
        expect(screen.getByText("React")).toBeInTheDocument();
      });

      await user.click(screen.getByText("React"));
      await user.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText("Question Answered")).toBeInTheDocument();
      });

      firstRender.unmount();

      render(<AgentChat sessionId="ses_1" />);

      act(() => {
        emitSSE("snapshot", {
          messages: [],
          status: { type: "idle" },
          question: null,
        });
      });

      await waitFor(() => {
        expect(screen.getByText("Question Answered")).toBeInTheDocument();
      });
    });

    it("shows progress indicator for multi-question", async () => {
      render(<AgentChat sessionId="ses_1" />);

      act(() => {
        emitSSE("snapshot", {
          messages: [],
          status: { type: "idle" },
          question: multiQuestion,
        });
      });

      await waitFor(() => {
        expect(screen.getByText("Pick a language")).toBeInTheDocument();
        expect(screen.getByText("Database")).toBeInTheDocument();
        expect(screen.getByText("Confirm")).toBeInTheDocument();
      });
    });

    it("navigates between questions in multi-step", async () => {
      const user = userEvent.setup();
      render(<AgentChat sessionId="ses_1" />);

      act(() => {
        emitSSE("snapshot", {
          messages: [],
          status: { type: "idle" },
          question: multiQuestion,
        });
      });

      await waitFor(() => {
        expect(screen.getByText("Pick a language")).toBeInTheDocument();
      });

      // Select TypeScript
      await user.click(screen.getByText("TypeScript"));

      // Next button
      await user.click(screen.getByRole("button", { name: /next/i }));

      // Now on step 2
      await waitFor(() => {
        expect(screen.getByText("Pick a database")).toBeInTheDocument();
      });
    });

    it("cancels question via close button", async () => {
      const user = userEvent.setup();
      render(<AgentChat sessionId="ses_1" />);

      act(() => {
        emitSSE("snapshot", {
          messages: [],
          status: { type: "idle" },
          question: singleQuestion,
        });
      });

      await waitFor(() => {
        expect(
          screen.getByText("Which framework do you prefer?"),
        ).toBeInTheDocument();
      });

      // Click the × close button
      await user.click(screen.getByText("✕"));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          "/api/questions/req_1/reject",
          expect.objectContaining({ method: "POST" }),
        );
      });
    });

    it("hides modal when question SSE event sends null", async () => {
      render(<AgentChat sessionId="ses_1" />);

      act(() => {
        emitSSE("snapshot", {
          messages: [],
          status: { type: "idle" },
          question: singleQuestion,
        });
      });

      await waitFor(() => {
        expect(
          screen.getByText("Which framework do you prefer?"),
        ).toBeInTheDocument();
      });

      act(() => {
        emitSSE("question", null);
      });

      await waitFor(() => {
        expect(
          screen.queryByText("Which framework do you prefer?"),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("context items", () => {
    const mockContextItems: ContextItem[] = [
      {
        id: "ctx-1",
        type: "text-selection",
        label: "Selection from document (line 42)",
        content: "The quick brown fox jumps over the lazy dog.",
      },
      {
        id: "ctx-2",
        type: "text-selection",
        label: "Selection from document (line 99)",
        content: "Another text selection from a different section.",
      },
    ];

    it("renders context bar when contextItems are provided", async () => {
      render(
        <AgentChat
          sessionId="ses_1"
          contextItems={mockContextItems}
          onClearContext={vi.fn()}
        />,
      );

      act(() => {
        emitSSE("snapshot", { messages: [], status: { type: "idle" } });
      });

      await waitFor(() => {
        expect(
          screen.getByText("2 selections will be sent with next message"),
        ).toBeInTheDocument();
      });
    });

    it("renders singular text for single context item", async () => {
      render(
        <AgentChat
          sessionId="ses_1"
          contextItems={[mockContextItems[0]]}
          onClearContext={vi.fn()}
        />,
      );

      act(() => {
        emitSSE("snapshot", { messages: [], status: { type: "idle" } });
      });

      await waitFor(() => {
        expect(
          screen.getByText("1 selection will be sent with next message"),
        ).toBeInTheDocument();
      });
    });

    it("does not render context bar when contextItems is empty", async () => {
      render(
        <AgentChat
          sessionId="ses_1"
          contextItems={[]}
          onClearContext={vi.fn()}
        />,
      );

      act(() => {
        emitSSE("snapshot", { messages: [], status: { type: "idle" } });
      });

      await waitFor(() => {
        expect(
          screen.queryByText(/selections? will be sent/),
        ).not.toBeInTheDocument();
      });
    });

    it("calls onClearContext when clear button is clicked", async () => {
      const onClearContext = vi.fn();
      const user = userEvent.setup();

      render(
        <AgentChat
          sessionId="ses_1"
          contextItems={mockContextItems}
          onClearContext={onClearContext}
        />,
      );

      act(() => {
        emitSSE("snapshot", { messages: [], status: { type: "idle" } });
      });

      await waitFor(() => {
        expect(
          screen.getByLabelText("Clear context selections"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText("Clear context selections"));

      expect(onClearContext).toHaveBeenCalledOnce();
    });

    it("sends contextParts in POST body when message is sent with context", async () => {
      const user = userEvent.setup();
      const onClearContext = vi.fn();

      render(
        <AgentChat
          sessionId="ses_1"
          contextItems={mockContextItems}
          onClearContext={onClearContext}
        />,
      );

      act(() => {
        emitSSE("snapshot", { messages: [], status: { type: "idle" } });
      });

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Type a message..."),
        ).toBeInTheDocument();
      });

      await user.type(
        screen.getByPlaceholderText("Type a message..."),
        "Explain this code",
      );
      await user.click(screen.getByRole("button", { name: /send message/i }));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const calls = vi.mocked(fetch).mock.calls;
      const messageCall = calls.find((call) =>
        String(call[0]).includes("/api/sessions/ses_1/messages"),
      );
      expect(messageCall).toBeDefined();

      const body = JSON.parse(messageCall![1]!.body as string);
      expect(body.content).toBe("Explain this code");
      expect(body.contextParts).toHaveLength(2);
      expect(body.contextParts[0].label).toBe(
        "Selection from document (line 42)",
      );
      expect(body.contextParts[0].content).toBe(
        "The quick brown fox jumps over the lazy dog.",
      );
      expect(body.contextParts[1].label).toBe(
        "Selection from document (line 99)",
      );
    });

    it("calls onClearContext after sending message with context", async () => {
      const user = userEvent.setup();
      const onClearContext = vi.fn();

      render(
        <AgentChat
          sessionId="ses_1"
          contextItems={mockContextItems}
          onClearContext={onClearContext}
        />,
      );

      act(() => {
        emitSSE("snapshot", { messages: [], status: { type: "idle" } });
      });

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Type a message..."),
        ).toBeInTheDocument();
      });

      await user.type(
        screen.getByPlaceholderText("Type a message..."),
        "hello",
      );
      await user.click(screen.getByRole("button", { name: /send message/i }));

      await waitFor(() => {
        expect(onClearContext).toHaveBeenCalledOnce();
      });
    });

    it("does not send contextParts when contextItems is empty", async () => {
      const user = userEvent.setup();

      render(
        <AgentChat
          sessionId="ses_1"
          contextItems={[]}
          onClearContext={vi.fn()}
        />,
      );

      act(() => {
        emitSSE("snapshot", { messages: [], status: { type: "idle" } });
      });

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Type a message..."),
        ).toBeInTheDocument();
      });

      await user.type(
        screen.getByPlaceholderText("Type a message..."),
        "hello",
      );
      await user.click(screen.getByRole("button", { name: /send message/i }));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const calls = vi.mocked(fetch).mock.calls;
      const messageCall = calls.find((call) =>
        String(call[0]).includes("/api/sessions/ses_1/messages"),
      );
      expect(messageCall).toBeDefined();

      const body = JSON.parse(messageCall![1]!.body as string);
      expect(body.contextParts).toBeUndefined();
    });
  });

  describe("displayContent", () => {
    it("renders displayContent from server overrides instead of full parts text", async () => {
      const messages: Message[] = [
        {
          id: "m-display",
          sessionId: "ses_1",
          role: "user",
          createdAt: 1,
          parts: [
            { id: "p1", type: "text", text: "Explain this code" },
            {
              id: "p2",
              type: "text",
              text: "--- Selection (line 42) ---\nconst x = 1;",
            },
          ],
        },
      ];

      render(<AgentChat sessionId="ses_1" />);

      act(() => {
        emitSSE("snapshot", {
          messages: makeRawMessages(messages),
          status: { type: "idle" },
          displayOverrides: {
            "Explain this code": {
              displayContent: "Explain this code",
              contextItemCount: 1,
            },
          },
        });
      });

      await waitFor(() => {
        expect(screen.getByText("Explain this code")).toBeInTheDocument();
      });

      expect(
        screen.queryByText(/Selection \(line 42\)/),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/const x = 1/)).not.toBeInTheDocument();
      expect(screen.getByText("+ 1 item")).toBeInTheDocument();
    });

    it("renders context badge on user messages with contextItemCount", async () => {
      render(<AgentChat sessionId="ses_1" />);

      act(() => {
        emitSSE("snapshot", { messages: [], status: { type: "idle" } });
      });

      await waitFor(() => {
        expect(screen.getByText("Start a conversation")).toBeInTheDocument();
      });
    });

    it("applies display overrides from messages event after send", async () => {
      const user = userEvent.setup();

      render(
        <AgentChat
          sessionId="ses_1"
          contextItems={[
            {
              id: "ctx-1",
              type: "text-selection",
              label: "Selection from file.ts",
              content: "function hello() {}",
            },
          ]}
          onClearContext={vi.fn()}
        />,
      );

      act(() => {
        emitSSE("snapshot", { messages: [], status: { type: "idle" } });
      });

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Type a message..."),
        ).toBeInTheDocument();
      });

      await user.type(
        screen.getByPlaceholderText("Type a message..."),
        "Review this",
      );
      await user.click(screen.getByRole("button", { name: /send message/i }));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      act(() => {
        emitSSE("messages", {
          messages: makeRawMessages([
            {
              id: "m-ctx",
              sessionId: "ses_1",
              role: "user",
              createdAt: 1,
              parts: [
                { id: "p1", type: "text", text: "Review this" },
                {
                  id: "p2",
                  type: "text",
                  text: "--- Selection from file.ts ---\nfunction hello() {}",
                },
              ],
            },
          ]),
          displayOverrides: {
            "Review this": {
              displayContent: "Review this",
              contextItemCount: 1,
            },
          },
        });
      });

      await waitFor(() => {
        expect(screen.getByText("Review this")).toBeInTheDocument();
      });

      expect(
        screen.queryByText(/Selection from file\.ts/),
      ).not.toBeInTheDocument();
      expect(screen.getByText("+ 1 item")).toBeInTheDocument();
    });
  });
});
