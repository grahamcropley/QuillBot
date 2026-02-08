import type {
  ActivityKind,
  ActivityToggleLevel,
  Part,
  StreamEvent,
  StreamActivity,
  TextPart,
  ToolCategory,
} from "@/types/opencode-events";

export type StreamEventBucket =
  | "display"
  | "activity"
  | "question"
  | "status"
  | "file"
  | "ignore";

export function isDisplayableTextPart(part: Part): part is TextPart {
  if (part.type !== "text") return false;
  const maybeSynthetic = "synthetic" in part ? Boolean(part.synthetic) : false;
  return !maybeSynthetic;
}

export function classifyStreamEvent(event: StreamEvent): StreamEventBucket {
  switch (event.type) {
    case "part":
      return isDisplayableTextPart(event.part) ? "display" : "activity";
    case "question":
      return "question";
    case "status":
      return "status";
    case "error":
    case "done":
      return "status";
    case "file.edited":
      return "file";
    case "activity":
      return "activity";
    default:
      return "ignore";
  }
}

export function createFileEditedActivity(file: string): StreamActivity {
  return {
    type: "activity",
    activityType: "file.edited",
    data: { file },
  };
}

/** Tool taxonomy: maps tool names to their category */
const TOOL_TAXONOMY: Record<string, ToolCategory> = {
  read: "file",
  write: "file",
  edit: "file",
  apply_patch: "file",
  glob: "file",
  grep: "file",
  webfetch: "web",
  websearch_web_search_exa: "web",
  context7_resolve_library_id: "web",
  "context7_resolve-library-id": "web",
  context7_query_docs: "web",
  "context7_query-docs": "web",
  question: "question",
  delegate_task: "delegation",
  task: "delegation",
};

export function classifyTool(toolName: string): ToolCategory {
  return TOOL_TAXONOMY[toolName] ?? "tool";
}

/** Map tool category to activity kind for styling */
export function toolCategoryToActivityKind(
  category: ToolCategory,
): ActivityKind {
  switch (category) {
    case "file":
      return "tool-file";
    case "web":
      return "tool-web";
    case "delegation":
      return "delegating";
    case "question":
      return "tool";
    case "tool":
      return "tool";
  }
}

/** Determine the minimum toggle level for a part type */
export function getPartToggleLevel(partType: string): ActivityToggleLevel {
  switch (partType) {
    case "tool":
    case "subtask":
    case "agent":
      return "main-activities";
    case "reasoning":
    case "retry":
    case "compaction":
    case "step-start":
    case "step-finish":
    case "snapshot":
    case "patch":
    case "file":
      return "all-activities";
    case "text":
    default:
      return "all-activities";
  }
}

/** Generate a human-readable status label for a tool */
export function getToolStatusLabel(
  toolName: string,
  toolCategory: ToolCategory,
  input?: Record<string, unknown>,
): string {
  switch (toolCategory) {
    case "file": {
      const filePath =
        typeof input?.filePath === "string" ? input.filePath : undefined;
      const fileName = filePath
        ? filePath.split("/").pop() || filePath
        : undefined;
      if (toolName === "read")
        return fileName ? `Reading ${fileName}` : "Reading file...";
      if (toolName === "write")
        return fileName ? `Writing to ${fileName}` : "Writing file...";
      if (toolName === "edit" || toolName === "apply_patch")
        return fileName ? `Editing ${fileName}` : "Editing file...";
      if (toolName === "grep") {
        const query =
          typeof input?.pattern === "string"
            ? input.pattern
            : typeof input?.query === "string"
              ? input.query
              : undefined;
        return query ? `Searching for "${query}"` : "Searching files...";
      }
      if (toolName === "glob") return "Finding files...";
      return `File operation: ${toolName}`;
    }
    case "web": {
      if (toolName === "webfetch") {
        const url = typeof input?.url === "string" ? input.url : undefined;
        return url ? `Fetching ${url}` : "Fetching URL...";
      }
      if (toolName === "websearch_web_search_exa") {
        const query =
          typeof input?.query === "string" ? input.query : undefined;
        return query ? `Searching for "${query}"` : "Web search...";
      }
      return `Web: ${toolName}`;
    }
    case "delegation":
      return "Delegating task...";
    case "question":
      return "Waiting for answer...";
    case "tool":
    default:
      return `Running tool: ${toolName}`;
  }
}
