import type { Message } from "@/types";
import type {
  ActivityToggleLevel,
  RenderItemActivity,
  RenderItemThinking,
  StreamActivity,
  ToolCategory,
} from "@/types/opencode-events";
import {
  classifyTool,
  getPartToggleLevel,
  getToolStatusLabel,
  toolCategoryToActivityKind,
} from "@/utils/stream-classifier";

export function getRelativePath(filePath: string): string {
  if (!filePath) return filePath;
  const projectMatch = filePath.match(/\/data\/projects\/[^/]+\/(.+)$/);
  if (projectMatch) {
    return projectMatch[1];
  }
  return filePath.split("/").pop() || filePath;
}

export function formatToolInputSummary(
  tool: string,
  input: Record<string, unknown> | null | undefined,
): string | null {
  if (!input) return null;

  const lines: string[] = [];

  if (typeof input.url === "string") {
    lines.push(`url: ${input.url}`);
  }

  if (typeof input.filePath === "string") {
    lines.push(`file: ${getRelativePath(input.filePath)}`);
  }

  if (Array.isArray(input.paths) && input.paths.length > 0) {
    lines.push(`paths: ${input.paths.map(getRelativePath).join(", ")}`);
  }

  if (typeof input.command === "string") {
    lines.push(`command: ${input.command}`);
  }

  if (typeof input.query === "string") {
    lines.push(`query: ${input.query}`);
  }

  if (typeof input.text === "string" && input.text.trim()) {
    const trimmed = input.text.trim();
    const preview =
      trimmed.length > 140 ? `${trimmed.slice(0, 140)}...` : trimmed;
    lines.push(`text: ${preview}`);
  }

  if (typeof input.element === "string") {
    lines.push(`element: ${input.element}`);
  }

  if (!lines.length) {
    if (tool === "webfetch" && typeof input.url !== "string") {
      return "url: (missing)";
    }
    return null;
  }

  return lines.join("\n");
}

/**
 * Derive activity and thinking render items from a Message's parts and activities.
 * This replaces the old getActivityItems() function.
 */
export function deriveActivityItems(
  message: Message,
): (RenderItemActivity | RenderItemThinking)[] {
  const items: (RenderItemActivity | RenderItemThinking)[] = [];

  for (const part of message.parts ?? []) {
    if (part.type === "reasoning") {
      if (part.text && part.text.trim()) {
        items.push({
          type: "thinking",
          id: part.id,
          timestamp: message.timestamp,
          text: part.text,
          minToggleLevel: "all-activities",
        });
      }
      continue;
    }

    if (part.type === "text" && part.synthetic) {
      items.push({
        type: "activity",
        id: part.id,
        timestamp: message.timestamp,
        toolCategory: "tool",
        toolName: "system",
        title: "System instructions",
        status: "completed",
        minToggleLevel: "all-activities",
        kind: "system",
        expandedContent: part.text,
      });
      continue;
    }

    if (part.type === "tool") {
      if (part.tool === "apply_patch" || part.tool === "edit") continue;
      if (part.tool === "question" && message.role === "assistant") continue;

      const toolCategory = classifyTool(part.tool);
      const kind = toolCategoryToActivityKind(toolCategory);
      const status = part.state.status;
      const input = part.state.input as Record<string, unknown> | undefined;
      const inputSummary = formatToolInputSummary(part.tool, input);
      const inputDetails = input
        ? JSON.stringify(input, null, 2)
        : "(no input)";
      const output =
        part.state.status === "completed" ? part.state.output : undefined;
      const error =
        part.state.status === "error" ? part.state.error : undefined;
      const detail = output || error || inputDetails;
      const expandedContent = inputSummary
        ? `${inputSummary}\n\n${detail}`
        : detail;

      let title = getToolStatusLabel(part.tool, toolCategory, input);
      if (part.tool === "webfetch" && typeof input?.url === "string") {
        title = input.url;
      } else if (
        part.tool === "websearch_web_search_exa" &&
        typeof input?.query === "string"
      ) {
        title = input.query;
      } else if (
        (part.tool === "read" || part.tool === "write") &&
        typeof input?.filePath === "string"
      ) {
        const filename = getRelativePath(input.filePath);
        const lineMatch =
          typeof output === "string"
            ? output.match(/\(total (\d+) lines?\)/)
            : null;
        const lineCount = lineMatch ? lineMatch[1] : null;
        const verb = part.tool === "read" ? "Reading" : "Writing to";
        title = `${verb} ${filename}${lineCount ? ` (${lineCount} lines)` : ""}`;
      }

      items.push({
        type: "activity",
        id: part.id,
        timestamp: message.timestamp,
        toolCategory,
        toolName: part.tool,
        title,
        status,
        minToggleLevel: getPartToggleLevel("tool"),
        kind,
        inputSummary: inputSummary ?? undefined,
        expandedContent,
      });
      continue;
    }

    if (part.type === "subtask") {
      items.push({
        type: "activity",
        id: part.id,
        timestamp: message.timestamp,
        toolCategory: "delegation",
        toolName: "subtask",
        title: `Delegating: ${part.description}`,
        status: "running",
        minToggleLevel: getPartToggleLevel("subtask"),
        kind: "delegating",
        expandedContent: part.prompt,
      });
      continue;
    }

    if (part.type === "agent") {
      items.push({
        type: "activity",
        id: part.id,
        timestamp: message.timestamp,
        toolCategory: "delegation",
        toolName: "agent",
        title: `Using agent: ${part.name}`,
        status: "running",
        minToggleLevel: getPartToggleLevel("agent"),
        kind: "delegating",
        expandedContent: part.source?.value,
      });
      continue;
    }

    if (part.type === "retry") {
      items.push({
        type: "activity",
        id: part.id,
        timestamp: message.timestamp,
        toolCategory: "tool",
        toolName: "retry",
        title: `Retrying (attempt ${part.attempt})`,
        status: "running",
        minToggleLevel: getPartToggleLevel("retry"),
        kind: "retry",
        expandedContent: part.error?.data?.message,
      });
      continue;
    }

    if (part.type === "compaction") {
      items.push({
        type: "activity",
        id: part.id,
        timestamp: message.timestamp,
        toolCategory: "tool",
        toolName: "compaction",
        title: "Compaction",
        status: "completed",
        minToggleLevel: getPartToggleLevel("compaction"),
        kind: "compaction",
        expandedContent: part.auto
          ? "Auto compaction enabled"
          : "Manual compaction",
      });
      continue;
    }

    if (part.type === "step-finish") {
      const tokens = `Tokens: input ${part.tokens.input}, output ${part.tokens.output}`;
      const lastToolIdx = findLastToolActivityIndex(items);
      if (lastToolIdx !== null) {
        const existing = items[lastToolIdx] as RenderItemActivity;
        const suffix = `Step finished (${part.reason})\n${tokens}`;
        items[lastToolIdx] = {
          ...existing,
          expandedContent: existing.expandedContent
            ? `${existing.expandedContent}\n\n${suffix}`
            : suffix,
        };
      } else {
        items.push({
          type: "activity",
          id: part.id,
          timestamp: message.timestamp,
          toolCategory: "tool",
          toolName: "step",
          title: `Step finished (${part.reason})`,
          status: "completed",
          minToggleLevel: getPartToggleLevel("step-finish"),
          kind: "step",
          expandedContent: tokens,
        });
      }
      continue;
    }

    if (part.type === "file") {
      const fileLabel = getRelativePath(part.filename ?? part.url ?? "");
      items.push({
        type: "activity",
        id: part.id,
        timestamp: message.timestamp,
        toolCategory: "file",
        toolName: "file",
        title: "File",
        status: "completed",
        minToggleLevel: getPartToggleLevel("file"),
        kind: "file",
        expandedContent: fileLabel,
      });
      continue;
    }

    if (part.type === "patch") continue;
  }

  for (const activity of message.activities ?? []) {
    const activityItem = deriveActivityFromStreamActivity(
      activity,
      message.timestamp,
      items.length,
    );
    if (activityItem) {
      items.push(activityItem);
    }
  }

  return items;
}

export function deriveRenderItems(
  message: Message,
): (RenderItemActivity | RenderItemThinking)[] {
  return deriveActivityItems(message);
}

function findLastToolActivityIndex(
  items: (RenderItemActivity | RenderItemThinking)[],
): number | null {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].type === "activity") return i;
  }
  return null;
}

function deriveActivityFromStreamActivity(
  activity: StreamActivity,
  timestamp: Date,
  index: number,
): RenderItemActivity | null {
  const baseProps = {
    type: "activity" as const,
    timestamp,
    toolCategory: "tool" as ToolCategory,
    toolName: "system",
    status: "completed" as const,
    minToggleLevel: "all-activities" as ActivityToggleLevel,
  };

  switch (activity.activityType) {
    case "tui.prompt.append":
      return {
        ...baseProps,
        id: `${activity.activityType}-${index}`,
        title: "Prompt augmented",
        kind: "system",
        expandedContent: String(activity.data.text ?? ""),
      };
    case "tui.command.execute":
      return {
        ...baseProps,
        id: `${activity.activityType}-${index}`,
        title: "Command executed",
        kind: "command",
        expandedContent: String(activity.data.command ?? ""),
      };
    case "command.executed":
      return {
        ...baseProps,
        id: `${activity.activityType}-${index}`,
        title: `Command executed: ${String(activity.data.name ?? "")}`,
        kind: "command",
        expandedContent: String(activity.data.arguments ?? ""),
      };
    case "mcp.tools.changed":
      return {
        ...baseProps,
        id: `${activity.activityType}-${index}`,
        title: "MCP tools updated",
        kind: "mcp",
        expandedContent: String(activity.data.server ?? ""),
      };
    case "mcp.browser.open.failed":
      return {
        ...baseProps,
        id: `${activity.activityType}-${index}`,
        title: "MCP browser open failed",
        kind: "mcp",
        expandedContent: String(activity.data.url ?? ""),
      };
    case "permission.asked":
      return {
        ...baseProps,
        id: `${activity.activityType}-${index}`,
        title: "Permission requested",
        kind: "permission",
        expandedContent: String(activity.data.permission ?? ""),
      };
    case "permission.replied":
      return {
        ...baseProps,
        id: `${activity.activityType}-${index}`,
        title: "Permission response",
        kind: "permission",
        expandedContent: String(activity.data.response ?? ""),
      };
    case "todo.updated":
      return {
        ...baseProps,
        id: `${activity.activityType}-${index}`,
        title: "Todo list updated",
        kind: "todo",
        expandedContent: JSON.stringify(activity.data.todos ?? [], null, 2),
      };
    case "tui.toast.show":
      return {
        ...baseProps,
        id: `${activity.activityType}-${index}`,
        title: "Server notice",
        kind: "other",
        expandedContent: String(activity.data.message ?? ""),
      };
    case "file.edited":
      return null;
    default:
      return {
        ...baseProps,
        id: `${activity.activityType}-${index}`,
        title: "Activity",
        kind: "other",
        expandedContent: JSON.stringify(activity.data ?? {}, null, 2),
      };
  }
}

/** Filter render items based on activity toggle level */
export function filterByToggleLevel(
  items: (RenderItemActivity | RenderItemThinking)[],
  level: ActivityToggleLevel,
): (RenderItemActivity | RenderItemThinking)[] {
  if (level === "messages-only") return [];
  if (level === "all-activities") return items;
  return items.filter((item) => item.minToggleLevel === "main-activities");
}
