import { describe, it, expect } from "vitest";
import {
  classifyTool,
  toolCategoryToActivityKind,
  getPartToggleLevel,
  getToolStatusLabel,
  classifyStreamEvent,
  isDisplayableTextPart,
  createFileEditedActivity,
} from "./stream-classifier";
import type { StreamEvent } from "@/types/opencode-events";
import type { Part, TextPart } from "@opencode-ai/sdk/v2/client";

// ---------------------------------------------------------------------------
// classifyTool
// ---------------------------------------------------------------------------

describe("classifyTool", () => {
  it.each([
    ["read", "file"],
    ["write", "file"],
    ["edit", "file"],
    ["apply_patch", "file"],
    ["glob", "file"],
    ["grep", "file"],
  ] as const)("classifies %s as %s", (tool, expected) => {
    expect(classifyTool(tool)).toBe(expected);
  });

  it.each([
    ["webfetch", "web"],
    ["websearch_web_search_exa", "web"],
    ["context7_resolve_library_id", "web"],
    ["context7_resolve-library-id", "web"],
    ["context7_query_docs", "web"],
    ["context7_query-docs", "web"],
  ] as const)("classifies %s as %s", (tool, expected) => {
    expect(classifyTool(tool)).toBe(expected);
  });

  it("classifies question as question", () => {
    expect(classifyTool("question")).toBe("question");
  });

  it.each(["delegate_task", "task"] as const)(
    "classifies %s as delegation",
    (tool) => {
      expect(classifyTool(tool)).toBe("delegation");
    },
  );

  it("falls back to 'tool' for unknown tools", () => {
    expect(classifyTool("some_unknown_tool")).toBe("tool");
    expect(classifyTool("bash")).toBe("tool");
    expect(classifyTool("")).toBe("tool");
  });
});

// ---------------------------------------------------------------------------
// toolCategoryToActivityKind
// ---------------------------------------------------------------------------

describe("toolCategoryToActivityKind", () => {
  it.each([
    ["file", "tool-file"],
    ["web", "tool-web"],
    ["delegation", "delegating"],
    ["question", "tool"],
    ["tool", "tool"],
  ] as const)("maps %s → %s", (category, expected) => {
    expect(toolCategoryToActivityKind(category)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// getPartToggleLevel
// ---------------------------------------------------------------------------

describe("getPartToggleLevel", () => {
  it.each(["tool", "subtask", "agent"])(
    "returns main-activities for %s",
    (partType) => {
      expect(getPartToggleLevel(partType)).toBe("main-activities");
    },
  );

  it.each([
    "reasoning",
    "retry",
    "compaction",
    "step-start",
    "step-finish",
    "snapshot",
    "patch",
    "file",
  ])("returns all-activities for %s", (partType) => {
    expect(getPartToggleLevel(partType)).toBe("all-activities");
  });

  it("returns all-activities for text", () => {
    expect(getPartToggleLevel("text")).toBe("all-activities");
  });

  it("returns all-activities for unknown part types", () => {
    expect(getPartToggleLevel("unknown_type")).toBe("all-activities");
  });
});

// ---------------------------------------------------------------------------
// getToolStatusLabel
// ---------------------------------------------------------------------------

describe("getToolStatusLabel", () => {
  describe("file category", () => {
    it("shows filename for read", () => {
      const label = getToolStatusLabel("read", "file", {
        filePath: "/data/projects/abc/draft.md",
      });
      expect(label).toBe("Reading draft.md");
    });

    it("shows generic message when read has no filePath", () => {
      expect(getToolStatusLabel("read", "file")).toBe("Reading file...");
    });

    it("shows filename for write", () => {
      const label = getToolStatusLabel("write", "file", {
        filePath: "/foo/bar.txt",
      });
      expect(label).toBe("Writing to bar.txt");
    });

    it("shows generic message when write has no filePath", () => {
      expect(getToolStatusLabel("write", "file")).toBe("Writing file...");
    });

    it("shows filename for edit", () => {
      const label = getToolStatusLabel("edit", "file", {
        filePath: "/src/index.ts",
      });
      expect(label).toBe("Editing index.ts");
    });

    it("shows filename for apply_patch", () => {
      const label = getToolStatusLabel("apply_patch", "file", {
        filePath: "/a/b.ts",
      });
      expect(label).toBe("Editing b.ts");
    });

    it("shows generic message when edit has no filePath", () => {
      expect(getToolStatusLabel("edit", "file")).toBe("Editing file...");
    });

    it("shows search pattern for grep with pattern input", () => {
      const label = getToolStatusLabel("grep", "file", { pattern: "TODO" });
      expect(label).toBe('Searching for "TODO"');
    });

    it("shows search query for grep with query input", () => {
      const label = getToolStatusLabel("grep", "file", {
        query: "useEffect",
      });
      expect(label).toBe('Searching for "useEffect"');
    });

    it("shows generic message when grep has no pattern/query", () => {
      expect(getToolStatusLabel("grep", "file")).toBe("Searching files...");
    });

    it("shows finding files for glob", () => {
      expect(getToolStatusLabel("glob", "file")).toBe("Finding files...");
    });

    it("shows generic label for unknown file tools", () => {
      expect(getToolStatusLabel("unknown_file_op", "file")).toBe(
        "File operation: unknown_file_op",
      );
    });
  });

  describe("web category", () => {
    it("shows URL for webfetch", () => {
      const label = getToolStatusLabel("webfetch", "web", {
        url: "https://example.com",
      });
      expect(label).toBe("Fetching https://example.com");
    });

    it("shows generic message when webfetch has no URL", () => {
      expect(getToolStatusLabel("webfetch", "web")).toBe("Fetching URL...");
    });

    it("shows search query for websearch", () => {
      const label = getToolStatusLabel("websearch_web_search_exa", "web", {
        query: "react hooks",
      });
      expect(label).toBe('Searching for "react hooks"');
    });

    it("shows generic message for websearch with no query", () => {
      expect(getToolStatusLabel("websearch_web_search_exa", "web")).toBe(
        "Web search...",
      );
    });

    it("shows generic label for unknown web tools", () => {
      expect(getToolStatusLabel("some_web_tool", "web")).toBe(
        "Web: some_web_tool",
      );
    });
  });

  describe("other categories", () => {
    it("shows delegation label", () => {
      expect(getToolStatusLabel("delegate_task", "delegation")).toBe(
        "Delegating task...",
      );
    });

    it("shows waiting label for question", () => {
      expect(getToolStatusLabel("question", "question")).toBe(
        "Waiting for answer...",
      );
    });

    it("shows running tool for generic tools", () => {
      expect(getToolStatusLabel("bash", "tool")).toBe("Running tool: bash");
    });
  });
});

// ---------------------------------------------------------------------------
// isDisplayableTextPart
// ---------------------------------------------------------------------------

describe("isDisplayableTextPart", () => {
  it("returns true for normal text parts", () => {
    const part = { type: "text", id: "1", text: "hello" } as TextPart;
    expect(isDisplayableTextPart(part)).toBe(true);
  });

  it("returns false for synthetic text parts", () => {
    const part = {
      type: "text",
      id: "1",
      text: "system",
      synthetic: true,
    } as Part;
    expect(isDisplayableTextPart(part)).toBe(false);
  });

  it("returns false for non-text parts", () => {
    const part = { type: "tool", id: "1" } as Part;
    expect(isDisplayableTextPart(part)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// classifyStreamEvent
// ---------------------------------------------------------------------------

describe("classifyStreamEvent", () => {
  it("classifies displayable text parts as display", () => {
    const event: StreamEvent = {
      type: "part",
      part: { type: "text", id: "1", text: "hello" } as TextPart,
    };
    expect(classifyStreamEvent(event)).toBe("display");
  });

  it("classifies synthetic text parts as activity", () => {
    const event: StreamEvent = {
      type: "part",
      part: {
        type: "text",
        id: "1",
        text: "system",
        synthetic: true,
      } as unknown as Part,
    };
    expect(classifyStreamEvent(event)).toBe("activity");
  });

  it("classifies tool parts as activity", () => {
    const event: StreamEvent = {
      type: "part",
      part: { type: "tool", id: "1" } as Part,
    };
    expect(classifyStreamEvent(event)).toBe("activity");
  });

  it("classifies question events as question", () => {
    const event: StreamEvent = {
      type: "question",
      data: {
        requestId: "r1",
        sessionId: "s1",
        questions: [],
      },
    };
    expect(classifyStreamEvent(event)).toBe("question");
  });

  it("classifies status events as status", () => {
    const event: StreamEvent = {
      type: "status",
      sessionStatus:
        "running" as unknown as import("@opencode-ai/sdk/v2/client").SessionStatus,
      sessionId: "s1",
    };
    expect(classifyStreamEvent(event)).toBe("status");
  });

  it("classifies error events as status", () => {
    const event: StreamEvent = {
      type: "error",
      error: "something went wrong",
    };
    expect(classifyStreamEvent(event)).toBe("status");
  });

  it("classifies done events as status", () => {
    const event: StreamEvent = {
      type: "done",
      sessionId: "s1",
    };
    expect(classifyStreamEvent(event)).toBe("status");
  });

  it("classifies file.edited events as file", () => {
    const event: StreamEvent = {
      type: "file.edited",
      file: "/data/projects/abc/draft.md",
    };
    expect(classifyStreamEvent(event)).toBe("file");
  });

  it("classifies activity events as activity", () => {
    const event: StreamEvent = {
      type: "activity",
      activityType: "todo.updated",
      data: {},
    };
    expect(classifyStreamEvent(event)).toBe("activity");
  });
});

// ---------------------------------------------------------------------------
// createFileEditedActivity
// ---------------------------------------------------------------------------

describe("createFileEditedActivity", () => {
  it("creates a file.edited StreamActivity", () => {
    const activity = createFileEditedActivity("/data/projects/p1/draft.md");
    expect(activity).toEqual({
      type: "activity",
      activityType: "file.edited",
      data: { file: "/data/projects/p1/draft.md" },
    });
  });
});
