import { describe, it, expect } from "vitest";
import {
  getRelativePath,
  formatToolInputSummary,
  deriveActivityItems,
  filterByToggleLevel,
} from "./conversation-render-model";
import type { Message } from "@/types";
import type { Part } from "@opencode-ai/sdk/v2/client";
import type {
  RenderItemActivity,
  RenderItemThinking,
  StreamActivity,
} from "@/types/opencode-events";

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    role: "assistant",
    content: "",
    timestamp: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("getRelativePath", () => {
  it("strips /data/projects/{id}/ prefix", () => {
    expect(getRelativePath("/data/projects/abc-123/draft.md")).toBe("draft.md");
  });

  it("strips nested project paths", () => {
    expect(getRelativePath("/data/projects/p1/subdir/file.ts")).toBe(
      "subdir/file.ts",
    );
  });

  it("falls back to filename for non-project paths", () => {
    expect(getRelativePath("/usr/local/bin/node")).toBe("node");
  });

  it("returns empty string for empty input", () => {
    expect(getRelativePath("")).toBe("");
  });

  it("handles paths with only a filename", () => {
    expect(getRelativePath("file.txt")).toBe("file.txt");
  });
});

describe("formatToolInputSummary", () => {
  it("returns null for null input", () => {
    expect(formatToolInputSummary("read", null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(formatToolInputSummary("read", undefined)).toBeNull();
  });

  it("formats url field", () => {
    expect(
      formatToolInputSummary("webfetch", { url: "https://example.com" }),
    ).toBe("url: https://example.com");
  });

  it("formats filePath with relative path", () => {
    expect(
      formatToolInputSummary("read", {
        filePath: "/data/projects/p1/draft.md",
      }),
    ).toBe("file: draft.md");
  });

  it("formats command field", () => {
    expect(formatToolInputSummary("bash", { command: "ls -la" })).toBe(
      "command: ls -la",
    );
  });

  it("formats query field", () => {
    expect(formatToolInputSummary("grep", { query: "useState" })).toBe(
      "query: useState",
    );
  });

  it("truncates long text fields to 140 chars", () => {
    const longText = "a".repeat(200);
    const result = formatToolInputSummary("write", { text: longText });
    expect(result).toBe(`text: ${"a".repeat(140)}...`);
  });

  it("does not truncate short text fields", () => {
    expect(formatToolInputSummary("write", { text: "short" })).toBe(
      "text: short",
    );
  });

  it("formats multiple fields joined by newlines", () => {
    const result = formatToolInputSummary("tool", {
      url: "https://x.com",
      query: "test",
    });
    expect(result).toBe("url: https://x.com\nquery: test");
  });

  it("returns 'url: (missing)' for webfetch without url", () => {
    expect(formatToolInputSummary("webfetch", {})).toBe("url: (missing)");
  });

  it("returns null for empty input on non-webfetch tools", () => {
    expect(formatToolInputSummary("read", {})).toBeNull();
  });

  it("formats paths array", () => {
    const result = formatToolInputSummary("glob", {
      paths: ["/data/projects/p1/a.ts", "/data/projects/p1/b.ts"],
    });
    expect(result).toBe("paths: a.ts, b.ts");
  });

  it("formats element field", () => {
    expect(formatToolInputSummary("click", { element: "#button" })).toBe(
      "element: #button",
    );
  });
});

describe("deriveActivityItems", () => {
  it("returns empty array for message with no parts or activities", () => {
    const msg = makeMessage({ parts: [], activities: [] });
    expect(deriveActivityItems(msg)).toEqual([]);
  });

  it("creates thinking item from reasoning part", () => {
    const msg = makeMessage({
      parts: [
        {
          type: "reasoning",
          id: "r1",
          text: "Let me think about this...",
        } as Part,
      ],
    });

    const items = deriveActivityItems(msg);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("thinking");
    const thinking = items[0] as RenderItemThinking;
    expect(thinking.text).toBe("Let me think about this...");
    expect(thinking.minToggleLevel).toBe("all-activities");
  });

  it("skips reasoning parts with empty text", () => {
    const msg = makeMessage({
      parts: [{ type: "reasoning", id: "r1", text: "   " } as Part],
    });
    expect(deriveActivityItems(msg)).toHaveLength(0);
  });

  it("creates system activity from synthetic text part", () => {
    const msg = makeMessage({
      parts: [
        {
          type: "text",
          id: "t1",
          text: "System prompt text",
          synthetic: true,
        } as unknown as Part,
      ],
    });

    const items = deriveActivityItems(msg);
    expect(items).toHaveLength(1);
    const activity = items[0] as RenderItemActivity;
    expect(activity.type).toBe("activity");
    expect(activity.toolName).toBe("system");
    expect(activity.kind).toBe("system");
    expect(activity.title).toBe("System instructions");
    expect(activity.expandedContent).toBe("System prompt text");
    expect(activity.minToggleLevel).toBe("all-activities");
  });

  it("creates tool activity from tool part", () => {
    const msg = makeMessage({
      parts: [
        {
          type: "tool",
          id: "tool1",
          tool: "grep",
          state: {
            status: "completed",
            input: { pattern: "TODO" },
            output: "found 3 results",
          },
        } as unknown as Part,
      ],
    });

    const items = deriveActivityItems(msg);
    expect(items).toHaveLength(1);
    const activity = items[0] as RenderItemActivity;
    expect(activity.toolCategory).toBe("file");
    expect(activity.toolName).toBe("grep");
    expect(activity.kind).toBe("tool-file");
    expect(activity.status).toBe("completed");
    expect(activity.minToggleLevel).toBe("main-activities");
  });

  it("generates friendly title for grep tool with pattern", () => {
    const msg = makeMessage({
      parts: [
        {
          type: "tool",
          id: "t1",
          tool: "grep",
          state: {
            status: "completed",
            input: { pattern: "TODO" },
            output: "found 3 results",
          },
        } as unknown as Part,
      ],
    });

    const items = deriveActivityItems(msg);
    const activity = items[0] as RenderItemActivity;
    expect(activity.title).toBe('Searching for "TODO"');
  });

  it("generates friendly title for glob tool", () => {
    const msg = makeMessage({
      parts: [
        {
          type: "tool",
          id: "t1",
          tool: "glob",
          state: {
            status: "completed",
            input: { pattern: "**/*.ts" },
            output: "file list",
          },
        } as unknown as Part,
      ],
    });

    const items = deriveActivityItems(msg);
    const activity = items[0] as RenderItemActivity;
    expect(activity.title).toBe("Finding files...");
  });

  it("skips apply_patch and edit tool parts", () => {
    const msg = makeMessage({
      parts: [
        {
          type: "tool",
          id: "t1",
          tool: "apply_patch",
          state: { status: "completed", input: {} },
        } as unknown as Part,
        {
          type: "tool",
          id: "t2",
          tool: "edit",
          state: { status: "completed", input: {} },
        } as unknown as Part,
      ],
    });
    expect(deriveActivityItems(msg)).toHaveLength(0);
  });

  it("skips question tool parts from assistant", () => {
    const msg = makeMessage({
      role: "assistant",
      parts: [
        {
          type: "tool",
          id: "t1",
          tool: "question",
          state: { status: "completed", input: {} },
        } as unknown as Part,
      ],
    });
    expect(deriveActivityItems(msg)).toHaveLength(0);
  });

  it("generates title with filename and line count for read tool", () => {
    const msg = makeMessage({
      parts: [
        {
          type: "tool",
          id: "t1",
          tool: "read",
          state: {
            status: "completed",
            input: { filePath: "/data/projects/p1/src/index.ts" },
            output: "content here\n(total 42 lines)",
          },
        } as unknown as Part,
      ],
    });

    const items = deriveActivityItems(msg);
    const activity = items[0] as RenderItemActivity;
    expect(activity.title).toBe("Reading src/index.ts (42 lines)");
  });

  it("generates title with URL for webfetch tool", () => {
    const msg = makeMessage({
      parts: [
        {
          type: "tool",
          id: "t1",
          tool: "webfetch",
          state: {
            status: "completed",
            input: { url: "https://docs.example.com/api" },
            output: "page content",
          },
        } as unknown as Part,
      ],
    });

    const items = deriveActivityItems(msg);
    const activity = items[0] as RenderItemActivity;
    expect(activity.title).toBe("https://docs.example.com/api");
  });

  it("generates title with query for websearch tool", () => {
    const msg = makeMessage({
      parts: [
        {
          type: "tool",
          id: "t1",
          tool: "websearch_web_search_exa",
          state: {
            status: "completed",
            input: { query: "react hooks best practices" },
            output: "results",
          },
        } as unknown as Part,
      ],
    });

    const items = deriveActivityItems(msg);
    const activity = items[0] as RenderItemActivity;
    expect(activity.title).toBe("react hooks best practices");
  });

  it("creates delegating activity from subtask part", () => {
    const msg = makeMessage({
      parts: [
        {
          type: "subtask",
          id: "st1",
          description: "Explore auth module",
          prompt: "Find all auth-related files",
        } as unknown as Part,
      ],
    });

    const items = deriveActivityItems(msg);
    expect(items).toHaveLength(1);
    const activity = items[0] as RenderItemActivity;
    expect(activity.kind).toBe("delegating");
    expect(activity.title).toBe("Delegating: Explore auth module");
    expect(activity.expandedContent).toBe("Find all auth-related files");
    expect(activity.minToggleLevel).toBe("main-activities");
  });

  it("creates delegating activity from agent part", () => {
    const msg = makeMessage({
      parts: [
        {
          type: "agent",
          id: "a1",
          name: "oracle",
          source: { value: "Consulting on architecture" },
        } as unknown as Part,
      ],
    });

    const items = deriveActivityItems(msg);
    const activity = items[0] as RenderItemActivity;
    expect(activity.kind).toBe("delegating");
    expect(activity.title).toBe("Using agent: oracle");
    expect(activity.minToggleLevel).toBe("main-activities");
  });

  it("creates retry activity from retry part", () => {
    const msg = makeMessage({
      parts: [
        {
          type: "retry",
          id: "ret1",
          attempt: 2,
          error: { data: { message: "Rate limited" } },
        } as unknown as Part,
      ],
    });

    const items = deriveActivityItems(msg);
    const activity = items[0] as RenderItemActivity;
    expect(activity.kind).toBe("retry");
    expect(activity.title).toBe("Retrying (attempt 2)");
    expect(activity.expandedContent).toBe("Rate limited");
  });

  it("creates compaction activity", () => {
    const msg = makeMessage({
      parts: [
        {
          type: "compaction",
          id: "c1",
          auto: true,
        } as unknown as Part,
      ],
    });

    const items = deriveActivityItems(msg);
    const activity = items[0] as RenderItemActivity;
    expect(activity.kind).toBe("compaction");
    expect(activity.title).toBe("Compaction");
    expect(activity.expandedContent).toBe("Auto compaction enabled");
  });

  it("appends step-finish to last tool activity", () => {
    const msg = makeMessage({
      parts: [
        {
          type: "tool",
          id: "t1",
          tool: "grep",
          state: { status: "completed", input: { pattern: "x" }, output: "y" },
        } as unknown as Part,
        {
          type: "step-finish",
          id: "sf1",
          reason: "end_turn",
          tokens: { input: 100, output: 50 },
        } as unknown as Part,
      ],
    });

    const items = deriveActivityItems(msg);
    expect(items).toHaveLength(1);
    const activity = items[0] as RenderItemActivity;
    expect(activity.expandedContent).toContain("Step finished (end_turn)");
    expect(activity.expandedContent).toContain("Tokens: input 100, output 50");
  });

  it("creates standalone step activity when no prior tool activity exists", () => {
    const msg = makeMessage({
      parts: [
        {
          type: "step-finish",
          id: "sf1",
          reason: "end_turn",
          tokens: { input: 100, output: 50 },
        } as unknown as Part,
      ],
    });

    const items = deriveActivityItems(msg);
    expect(items).toHaveLength(1);
    const activity = items[0] as RenderItemActivity;
    expect(activity.kind).toBe("step");
    expect(activity.title).toBe("Step finished (end_turn)");
  });

  it("skips patch parts", () => {
    const msg = makeMessage({
      parts: [{ type: "patch", id: "p1" } as unknown as Part],
    });
    expect(deriveActivityItems(msg)).toHaveLength(0);
  });

  it("derives activities from message.activities (StreamActivity)", () => {
    const activities: StreamActivity[] = [
      {
        type: "activity",
        activityType: "todo.updated",
        data: { todos: ["item1"] },
      },
    ];
    const msg = makeMessage({ activities, parts: [] });

    const items = deriveActivityItems(msg);
    expect(items).toHaveLength(1);
    const activity = items[0] as RenderItemActivity;
    expect(activity.kind).toBe("todo");
    expect(activity.title).toBe("Todo list updated");
  });

  it("returns null for file.edited activities (filtered out)", () => {
    const activities: StreamActivity[] = [
      {
        type: "activity",
        activityType: "file.edited",
        data: { file: "/data/projects/p1/draft.md" },
      },
    ];
    const msg = makeMessage({ activities, parts: [] });
    expect(deriveActivityItems(msg)).toHaveLength(0);
  });
});

describe("filterByToggleLevel", () => {
  const items: (RenderItemActivity | RenderItemThinking)[] = [
    {
      type: "activity",
      id: "a1",
      timestamp: new Date(),
      toolCategory: "file",
      toolName: "read",
      title: "Reading file",
      status: "completed",
      minToggleLevel: "main-activities",
      kind: "tool-file",
    },
    {
      type: "thinking",
      id: "t1",
      timestamp: new Date(),
      text: "Thinking...",
      minToggleLevel: "all-activities",
    },
    {
      type: "activity",
      id: "a2",
      timestamp: new Date(),
      toolCategory: "tool",
      toolName: "system",
      title: "System",
      status: "completed",
      minToggleLevel: "all-activities",
      kind: "system",
    },
  ];

  it("returns empty array for messages-only", () => {
    expect(filterByToggleLevel(items, "messages-only")).toEqual([]);
  });

  it("returns all items for all-activities", () => {
    expect(filterByToggleLevel(items, "all-activities")).toEqual(items);
  });

  it("returns only main-activities items for main-activities", () => {
    const filtered = filterByToggleLevel(items, "main-activities");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("a1");
  });
});
