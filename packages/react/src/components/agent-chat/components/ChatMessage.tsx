import { useState, useEffect, type ReactNode } from "react";
import { cn } from "../../../lib/cn";
import { useTodoModal } from "../context/TodoModalContext";
import { MarkdownRenderer } from "./MarkdownRenderer";
import type { Message, MessagePart, QaEntry } from "../AgentChat.types";

interface ChatMessageProps {
  message: Message;
}

const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const INLINE_ACTIVITY_VISIBLE_COUNT = 20;
const SHOW_START_STOP_PARTS = false;
const ROLLUP_ACTIVITIES = false;

function BrailleSpinner() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % BRAILLE_FRAMES.length);
    }, 80);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="inline-block font-mono text-base text-zinc-400 dark:text-zinc-500">
      {BRAILLE_FRAMES[frame]}
    </span>
  );
}

function BouncingBallSpinner() {
  return (
    <span className="inline-flex items-end gap-1">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce-ball dark:bg-zinc-500" />
    </span>
  );
}

function CircularSpinner() {
  return (
    <span className="inline-flex items-center justify-center">
      <svg
        className="h-4 w-4 animate-spin-circle"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        aria-label="Loading"
      >
        <title>Loading</title>
        <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
        <path
          fill="none"
          strokeLinecap="round"
          d="M 12 2 A 10 10 0 0 1 22 12"
          strokeOpacity={1}
        />
      </svg>
    </span>
  );
}

function PulsingThrobSpinner() {
  return (
    <span className="inline-flex items-center justify-center">
      <span className="inline-block h-2 w-2 rounded-full bg-zinc-400 animate-pulse-throb dark:bg-zinc-500" />
    </span>
  );
}

function hasVisibleContent(parts: MessagePart[]): boolean {
  return parts.some((p) => {
    if (p.type === "text" || p.type === "reasoning") return !!p.text;
    if (
      p.type === "tool" ||
      p.type === "step-start" ||
      p.type === "step-finish"
    )
      return true;
    return false;
  });
}

function isActivityPart(part: MessagePart): boolean {
  return (
    part.type === "tool" ||
    part.type === "step-start" ||
    part.type === "step-finish"
  );
}

function isVisiblePart(part: MessagePart): boolean {
  if (isActivityPart(part)) return true;
  if (part.type === "text" || part.type === "reasoning") {
    return !!part.text?.trim();
  }
  return false;
}

function compactPathLikeText(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "tool";
  if (!normalized.includes("/") && !normalized.includes("\\"))
    return normalized;
  if (normalized.includes(" ")) return normalized;

  const parts = normalized.split(/[\\/]/).filter(Boolean);
  if (parts.length === 0) return normalized;
  return parts[parts.length - 1];
}

function TextPartView({
  part,
  role,
  bubbleAssistantText,
}: {
  part: MessagePart;
  role: "user" | "assistant";
  bubbleAssistantText: boolean;
}) {
  if (!part.text?.trim()) return null;
  if (role === "assistant") {
    if (bubbleAssistantText) {
      return (
        <div className="overflow-hidden rounded-2xl bg-zinc-100 px-4 py-2.5 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
          <MarkdownRenderer content={part.text} />
        </div>
      );
    }
    return <MarkdownRenderer content={part.text} />;
  }
  return <p className="whitespace-pre-wrap break-words">{part.text}</p>;
}

interface TodoItem {
  content: string;
  status: string;
  priority: string;
  id: string;
}

interface DiffLine {
  kind: "add" | "remove" | "meta" | "context";
  text: string;
}

function TodoPartView({ part }: { part: MessagePart }) {
  const todos = (part.toolInput?.todos as TodoItem[] | undefined) ?? [];
  const { openTodoModal } = useTodoModal();

  const statusCounts = todos.reduce(
    (acc, todo) => {
      acc[todo.status] = (acc[todo.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const added = statusCounts.pending || 0;
  const inProgress = statusCounts.in_progress || 0;
  const completed = statusCounts.completed || 0;
  const cancelled = statusCounts.cancelled || 0;
  const total = todos.length;

  let summaryText = "";
  if (total === 0) {
    summaryText = "View todos";
  } else if (completed > 0 && completed === total) {
    summaryText = `Completed ${completed} ${completed === 1 ? "task" : "tasks"}`;
  } else if (cancelled > 0 && cancelled === total) {
    summaryText = `Cancelled ${cancelled} ${cancelled === 1 ? "task" : "tasks"}`;
  } else if (added > 0 && added === total) {
    summaryText = `Added ${added} new ${added === 1 ? "task" : "tasks"}`;
  } else if (inProgress > 0 && inProgress === total) {
    summaryText = `Working on ${inProgress} ${inProgress === 1 ? "task" : "tasks"}`;
  } else {
    const parts: string[] = [];
    if (added > 0) parts.push(`${added} added`);
    if (inProgress > 0) parts.push(`${inProgress} in progress`);
    if (completed > 0) parts.push(`${completed} done`);
    if (cancelled > 0) parts.push(`${cancelled} cancelled`);
    summaryText = parts.length > 0 ? parts.join(", ") : `${total} todos`;
  }

  const renderStatusIcon = (status: string | undefined) => {
    if (status === "pending") {
      return <PulsingThrobSpinner />;
    }
    if (status === "running") {
      return <span className="animate-spin">◌</span>;
    }
    if (status === "completed") {
      return (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <title>Completed</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      );
    }
    if (status === "error") {
      return "!";
    }
    return "◌";
  };

  return (
    <button
      type="button"
      onClick={() => openTodoModal(todos)}
      aria-expanded={false}
      aria-label={`Todo update: ${summaryText}. Click to expand`}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-mono transition-colors hover:opacity-80 sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs",
        part.toolStatus === "error"
          ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400"
          : "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
      )}
    >
      <span className="inline-flex items-center justify-center">
        {renderStatusIcon(part.toolStatus)}
      </span>
      <span className="shrink-0 rounded bg-purple-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white dark:bg-purple-500 sm:text-[10px]">
        TODO
      </span>
      <span className="truncate">{summaryText}</span>
    </button>
  );
}

function getToolPillLabel(toolName?: string): string {
  if (!toolName) return "TOOL";

  const toolMap: Record<string, string> = {
    read: "FILE",
    write: "FILE",
    edit: "EDIT",
    bash: "BASH",
    glob: "FIND",
    grep: "GREP",
    task: "TASK",
    lsp_goto_definition: "LSP",
    lsp_find_references: "LSP",
    lsp_symbols: "LSP",
    lsp_diagnostics: "LSP",
    lsp_prepare_rename: "LSP",
    lsp_rename: "LSP",
    ast_grep_search: "AST",
    ast_grep_replace: "AST",
    question: "Q&A",
    webfetch: "WEB",
    websearch: "WEB",
  };

  return toolMap[toolName] ?? toolName.toUpperCase().slice(0, 6);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFileToolName(toolName?: string): boolean {
  return (
    toolName === "read" ||
    toolName === "write" ||
    toolName === "edit" ||
    toolName === "glob" ||
    toolName === "grep" ||
    toolName === "ast_grep_search" ||
    toolName === "ast_grep_replace"
  );
}

function getFileActivityPillLabel(toolName?: string): string {
  if (toolName === "read") return "READ";
  if (toolName === "edit") return "UPDATE";
  if (toolName === "write" || toolName === "ast_grep_replace") return "WRITE";
  if (
    toolName === "glob" ||
    toolName === "grep" ||
    toolName === "ast_grep_search"
  )
    return "FIND";
  return getToolPillLabel(toolName);
}

function getStringValue(
  input: Record<string, unknown> | undefined,
  keys: string[],
): string | null {
  if (!input) return null;
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function getNumberValue(
  input: Record<string, unknown> | undefined,
  keys: string[],
): number | null {
  if (!input) return null;
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function isAbsolutePathLike(value: string): boolean {
  return value.startsWith("/") || /^[A-Za-z]:\//.test(value);
}

function splitPathSegments(value: string): string[] {
  return value.split("/").filter(Boolean);
}

function getPathDrivePrefix(value: string): string | null {
  const match = value.match(/^[A-Za-z]:/);
  return match ? match[0].toLowerCase() : null;
}

function toRelativeFromCwd(pathValue: string, cwdValue: string): string | null {
  if (!isAbsolutePathLike(pathValue) || !isAbsolutePathLike(cwdValue)) {
    return null;
  }

  const pathDrive = getPathDrivePrefix(pathValue);
  const cwdDrive = getPathDrivePrefix(cwdValue);
  if (pathDrive !== cwdDrive) {
    return null;
  }

  const pathWithoutDrive = pathDrive
    ? pathValue.slice(pathDrive.length)
    : pathValue;
  const cwdWithoutDrive = cwdDrive ? cwdValue.slice(cwdDrive.length) : cwdValue;
  const pathSegments = splitPathSegments(pathWithoutDrive);
  const cwdSegments = splitPathSegments(cwdWithoutDrive);

  let common = 0;
  while (
    common < pathSegments.length &&
    common < cwdSegments.length &&
    pathSegments[common] === cwdSegments[common]
  ) {
    common += 1;
  }

  const upwards = Array.from(
    { length: cwdSegments.length - common },
    () => "..",
  );
  const downwards = pathSegments.slice(common);
  const relative = [...upwards, ...downwards].join("/");
  return relative || ".";
}

function normalizeRelativePath(pathValue: string, cwdValue?: string): string {
  const normalizedPath = pathValue.replace(/\\/g, "/").trim();
  if (!normalizedPath) return "file";

  if (!isAbsolutePathLike(normalizedPath)) {
    return normalizedPath.replace(/^\.\//, "");
  }

  const normalizedCwd = cwdValue
    ?.replace(/\\/g, "/")
    .trim()
    .replace(/\/+$/, "");
  if (normalizedCwd) {
    const relative = toRelativeFromCwd(normalizedPath, normalizedCwd);
    if (relative) {
      return relative;
    }
  }

  const parts = splitPathSegments(normalizedPath);
  return parts[parts.length - 1] ?? "file";
}

function parseUnifiedDiff(diffText: string): DiffLine[] {
  const lines = diffText.replace(/\r/g, "").split("\n");
  return lines
    .filter((line) => line.length > 0)
    .map((line) => {
      if (
        line.startsWith("+++") ||
        line.startsWith("---") ||
        line.startsWith("@@")
      ) {
        return { kind: "meta", text: line } satisfies DiffLine;
      }
      if (line.startsWith("+")) {
        return { kind: "add", text: line } satisfies DiffLine;
      }
      if (line.startsWith("-")) {
        return { kind: "remove", text: line } satisfies DiffLine;
      }
      return { kind: "context", text: line } satisfies DiffLine;
    });
}

function buildSimpleDiff(beforeText: string, afterText: string): DiffLine[] {
  const beforeLines = beforeText.replace(/\r/g, "").split("\n");
  const afterLines = afterText.replace(/\r/g, "").split("\n");
  const max = Math.max(beforeLines.length, afterLines.length);
  const diffLines: DiffLine[] = [];

  for (let index = 0; index < max; index += 1) {
    const beforeLine = beforeLines[index];
    const afterLine = afterLines[index];

    if (beforeLine === afterLine) {
      if (beforeLine !== undefined) {
        diffLines.push({ kind: "context", text: ` ${beforeLine}` });
      }
      continue;
    }

    if (beforeLine !== undefined) {
      diffLines.push({ kind: "remove", text: `-${beforeLine}` });
    }
    if (afterLine !== undefined) {
      diffLines.push({ kind: "add", text: `+${afterLine}` });
    }
  }

  return diffLines;
}

function countDiffLines(diffLines: DiffLine[]): {
  additions: number;
  deletions: number;
} {
  return diffLines.reduce(
    (acc, line) => {
      if (line.kind === "add") acc.additions += 1;
      if (line.kind === "remove") acc.deletions += 1;
      return acc;
    },
    { additions: 0, deletions: 0 },
  );
}

function getNestedRecord(
  input: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> | undefined {
  if (!input) return undefined;
  const value = input[key];
  return isRecord(value) ? value : undefined;
}

function parseFileActivityPart(part: MessagePart): {
  label: string;
  path: string;
  readRangeSummary: string | null;
  additions: number;
  deletions: number;
  hasCountSummary: boolean;
  contentLineCount: number | null;
  contentText: string | null;
  diffLines: DiffLine[];
  expandable: boolean;
} {
  const input = isRecord(part.toolInput) ? part.toolInput : undefined;
  const nestedMetadata = getNestedRecord(input, "metadata");
  const nestedDiff =
    getNestedRecord(input, "diff") ?? getNestedRecord(nestedMetadata, "diff");
  const nestedFileDiff =
    getNestedRecord(input, "fileDiff") ??
    getNestedRecord(input, "filediff") ??
    getNestedRecord(nestedMetadata, "fileDiff") ??
    getNestedRecord(nestedMetadata, "filediff");

  const titlePath = part.toolTitle?.trim() ?? null;
  const inputPath =
    getStringValue(input, [
      "filePath",
      "path",
      "file",
      "filepath",
      "target",
      "to",
      "from",
    ]) ??
    getStringValue(nestedDiff, ["file", "path", "filePath"]) ??
    getStringValue(nestedFileDiff, ["file", "path", "filePath", "filepath"]) ??
    getStringValue(nestedMetadata, ["filepath", "filePath", "path", "file"]);

  const rawPath =
    titlePath && !isAbsolutePathLike(titlePath)
      ? titlePath
      : (inputPath ?? titlePath ?? part.tool ?? "file");

  const cwd =
    getStringValue(input, ["cwd", "directory", "workdir", "root"]) ??
    getStringValue(getNestedRecord(input, "path"), ["cwd", "root"]);

  const relativePath = normalizeRelativePath(rawPath, cwd ?? undefined);
  const label = getFileActivityPillLabel(part.tool);
  const readOffset =
    getNumberValue(input, ["offset", "lineOffset", "startLine", "start"]) ??
    getNumberValue(nestedMetadata, [
      "offset",
      "lineOffset",
      "startLine",
      "start",
    ]);
  const readLimit =
    getNumberValue(input, ["limit", "lineLimit", "maxLines", "count"]) ??
    getNumberValue(nestedMetadata, ["limit", "lineLimit", "maxLines", "count"]);

  let readRangeSummary: string | null = null;
  if (label === "READ") {
    if (readOffset !== null && readLimit !== null) {
      const endLine = readOffset + readLimit;
      readRangeSummary = `Lines ${readOffset}-${endLine}`;
    }
  }

  const unifiedDiff =
    getStringValue(input, [
      "diff",
      "patch",
      "unifiedDiff",
      "unified",
      "changes",
    ]) ??
    getStringValue(nestedDiff, ["patch", "text", "unified", "diff"]) ??
    getStringValue(nestedMetadata, [
      "diff",
      "patch",
      "unifiedDiff",
      "unified",
      "changes",
    ]) ??
    getStringValue(nestedFileDiff, ["patch", "text", "unified", "diff"]);

  const beforeText =
    getStringValue(input, ["before", "beforeText", "oldText", "oldContent"]) ??
    getStringValue(nestedDiff, ["before", "old", "oldText"]) ??
    getStringValue(nestedMetadata, [
      "before",
      "old",
      "oldText",
      "oldContent",
    ]) ??
    getStringValue(nestedFileDiff, ["before", "old", "oldText"]);
  const afterText =
    getStringValue(input, [
      "after",
      "afterText",
      "newText",
      "newContent",
      "content",
    ]) ??
    getStringValue(nestedDiff, ["after", "new", "newText"]) ??
    getStringValue(nestedMetadata, [
      "after",
      "new",
      "newText",
      "newContent",
      "content",
    ]) ??
    getStringValue(nestedFileDiff, ["after", "new", "newText"]);
  const contentText = getStringValue(input, ["content"]);

  const diffLines = unifiedDiff
    ? parseUnifiedDiff(unifiedDiff)
    : beforeText !== null && afterText !== null
      ? buildSimpleDiff(beforeText, afterText)
      : [];

  const counted = countDiffLines(diffLines);
  const additionsFromPayload =
    getNumberValue(input, ["additions", "added", "insertions"]) ??
    getNumberValue(nestedDiff, ["additions", "added", "insertions"]) ??
    getNumberValue(nestedMetadata, ["additions", "added", "insertions"]) ??
    getNumberValue(nestedFileDiff, ["additions", "added", "insertions"]);
  const deletionsFromPayload =
    getNumberValue(input, ["deletions", "removed", "deletes"]) ??
    getNumberValue(nestedDiff, ["deletions", "removed", "deletes"]) ??
    getNumberValue(nestedMetadata, ["deletions", "removed", "deletes"]) ??
    getNumberValue(nestedFileDiff, ["deletions", "removed", "deletes"]);

  const additions = additionsFromPayload ?? counted.additions;
  const deletions = deletionsFromPayload ?? counted.deletions;
  const contentLineCount =
    typeof input?.content === "string"
      ? input.content.length === 0
        ? 0
        : input.content.replace(/\r/g, "").split("\n").length
      : null;
  const hasDiffSource =
    unifiedDiff !== null || (beforeText !== null && afterText !== null);
  const hasCountSummary =
    (label === "WRITE" || label === "UPDATE") &&
    (additionsFromPayload !== null ||
      deletionsFromPayload !== null ||
      hasDiffSource);

  const hasDiffDetails =
    (label === "WRITE" || label === "UPDATE") && diffLines.length > 0;
  const hasContentDetails = label === "WRITE" && contentText !== null;
  const expandable = hasDiffDetails || hasContentDetails;

  return {
    label,
    path: relativePath,
    readRangeSummary,
    additions,
    deletions,
    hasCountSummary,
    contentLineCount,
    contentText,
    diffLines,
    expandable,
  };
}

function ToolStatusIcon({ status }: { status: MessagePart["toolStatus"] }) {
  if (status === "pending") {
    return <PulsingThrobSpinner />;
  }

  if (status === "running") {
    return (
      <span className="inline-flex items-center justify-center animate-spin">
        <BrailleSpinner />
      </span>
    );
  }

  if (status === "completed") {
    return (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={3}
      >
        <title>Completed</title>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }

  if (status === "error") {
    return <span>!</span>;
  }

  return <span>◌</span>;
}

function FilePartView({ part }: { part: MessagePart }) {
  const [expanded, setExpanded] = useState(false);
  const parsed = parseFileActivityPart(part);
  const summaryView =
    parsed.label === "READ" && parsed.readRangeSummary !== null ? (
      <span className="italic"> [{parsed.readRangeSummary}]</span>
    ) : parsed.hasCountSummary ? (
      <span className="italic">
        {" ["}
        <span className="text-emerald-800 dark:text-emerald-300">
          +{parsed.additions}
        </span>
        <span>/</span>
        <span className="text-red-800 dark:text-red-300">
          -{parsed.deletions}
        </span>
        {"]"}
      </span>
    ) : parsed.label === "WRITE" && parsed.contentLineCount !== null ? (
      <span className="italic">
        {" ["}
        <span className="text-emerald-800 dark:text-emerald-300">
          +{parsed.contentLineCount}
        </span>
        {"]"}
      </span>
    ) : null;

  const isRead = parsed.label === "READ";
  const isWriteLike = parsed.label === "WRITE" || parsed.label === "UPDATE";
  const renderedDiffLines =
    parsed.label === "UPDATE"
      ? parsed.diffLines.filter(
          (line) => line.kind === "add" || line.kind === "remove",
        )
      : parsed.diffLines;
  const hasDiffDetails = renderedDiffLines.length > 0;
  const hasContentDetails =
    parsed.label === "WRITE" && parsed.contentText !== null && !hasDiffDetails;
  const canExpand = parsed.expandable && (hasDiffDetails || hasContentDetails);

  const containerClasses = cn(
    "rounded-lg border text-[11px] font-mono sm:text-xs",
    part.toolStatus === "error"
      ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400"
      : isRead
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-300"
        : isWriteLike
          ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300"
          : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300",
  );

  const pillClasses = cn(
    "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white sm:text-[10px]",
    isRead
      ? "bg-emerald-600 dark:bg-emerald-500"
      : isWriteLike
        ? "bg-amber-600 dark:bg-amber-500"
        : "bg-zinc-600 dark:bg-zinc-500",
  );

  const row = (
    <div className="flex w-full items-center gap-1.5 px-2.5 py-1 sm:gap-2 sm:px-3 sm:py-1.5">
      <span className="inline-flex items-center justify-center">
        <ToolStatusIcon status={part.toolStatus} />
      </span>
      <span className={pillClasses}>{parsed.label}</span>
      <span className="truncate">
        <span>{parsed.path}</span>
        {summaryView}
      </span>
    </div>
  );

  const expandLabel = hasContentDetails
    ? `${expanded ? "Collapse" : "Expand"} write content for ${parsed.path}`
    : `${expanded ? "Collapse" : "Expand"} ${parsed.label.toLowerCase()} diff for ${parsed.path}`;

  return (
    <div className={containerClasses}>
      {canExpand ? (
        <button
          type="button"
          className="w-full text-left"
          aria-expanded={expanded}
          aria-label={expandLabel}
          onClick={() => setExpanded((value) => !value)}
        >
          {row}
        </button>
      ) : (
        row
      )}
      {canExpand && expanded && (
        <div className="border-t border-zinc-200 px-2.5 pb-2.5 pt-2 dark:border-zinc-700 sm:px-3">
          {hasDiffDetails ? (
            <pre className="max-h-72 overflow-auto rounded border border-zinc-200 bg-zinc-100 p-2 text-[10px] leading-relaxed dark:border-zinc-700 dark:bg-zinc-900/40 sm:text-[11px]">
              {renderedDiffLines.map((line, index) => (
                <div
                  key={`${part.id}-diff-${index}`}
                  className={cn(
                    "whitespace-pre",
                    line.kind === "add" &&
                      "text-emerald-700 dark:text-emerald-400",
                    line.kind === "remove" &&
                      "text-rose-700 dark:text-rose-400",
                    line.kind === "meta" && "text-zinc-500 dark:text-zinc-400",
                  )}
                >
                  {line.text}
                </div>
              ))}
            </pre>
          ) : (
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded border border-zinc-200 bg-zinc-100 p-2 text-[10px] leading-relaxed text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-100 sm:text-[11px]">
              {parsed.contentText}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function ToolPartView({ part }: { part: MessagePart }) {
  const rawLabel = part.toolTitle ?? part.tool ?? "tool";
  const label = compactPathLikeText(rawLabel);
  const pillLabel = getToolPillLabel(part.tool);

  return (
    <output
      aria-live={part.toolStatus === "running" ? "polite" : "off"}
      aria-label={`Tool ${label} ${part.toolStatus ?? "pending"}`}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-mono sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs",
        part.toolStatus === "error"
          ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400"
          : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400",
      )}
    >
      {part.toolStatus === "pending" ? (
        <PulsingThrobSpinner />
      ) : (
        <ToolStatusIcon status={part.toolStatus} />
      )}
      <span className="shrink-0 rounded bg-zinc-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white dark:bg-zinc-600 sm:text-[10px]">
        {pillLabel}
      </span>
      <span className="truncate">{label}</span>
    </output>
  );
}

function StepPartView({ part }: { part: MessagePart }) {
  if (!SHOW_START_STOP_PARTS) return null;
  const isStart = part.type === "step-start";
  const text =
    part.text?.trim() || (isStart ? "Step started" : "Step finished");

  return (
    <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 sm:text-xs">
      <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
      <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-medium uppercase tracking-wide dark:border-zinc-700 dark:bg-zinc-800/50">
        {isStart ? "Step" : "Done"}
      </span>
      <span className="max-w-[45%] truncate">{text}</span>
      <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
    </div>
  );
}

function PartView({
  part,
  role,
  bubbleAssistantText,
}: {
  part: MessagePart;
  role: "user" | "assistant";
  bubbleAssistantText: boolean;
}) {
  switch (part.type) {
    case "text":
      return (
        <TextPartView
          part={part}
          role={role}
          bubbleAssistantText={bubbleAssistantText}
        />
      );
    case "tool":
      if (part.tool === "todowrite") {
        return <TodoPartView part={part} />;
      }
      if (isFileToolName(part.tool)) {
        return <FilePartView part={part} />;
      }
      return <ToolPartView part={part} />;
    case "reasoning":
      if (!part.text) return null;
      return (
        <p className="whitespace-pre-wrap break-words italic text-zinc-500 dark:text-zinc-400">
          {part.text}
        </p>
      );
    case "step-start":
    case "step-finish":
      return <StepPartView part={part} />;
    default:
      return null;
  }
}

function ActivityGroupView({
  parts,
  role,
}: {
  parts: MessagePart[];
  role: "user" | "assistant";
}) {
  const [expanded, setExpanded] = useState(false);

  if (ROLLUP_ACTIVITIES && !expanded) {
    const toolCount = parts.filter((p) => p.type === "tool").length;
    const stepCount = parts.filter(
      (p) => p.type === "step-start" || p.type === "step-finish",
    ).length;
    const runningCount = parts.filter(
      (p) => p.type === "tool" && p.toolStatus === "running",
    ).length;

    const labels: string[] = [];
    if (toolCount > 0) {
      labels.push(`${toolCount} ${toolCount === 1 ? "tool" : "tools"}`);
    }
    if (stepCount > 0) {
      labels.push(`${stepCount} ${stepCount === 1 ? "step" : "steps"}`);
    }

    const summary = labels.join(", ") || `${parts.length} actions`;

    return (
      <div className="my-1">
        <button
          type="button"
          aria-expanded={false}
          aria-label={`Show ${summary}`}
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:text-xs"
        >
          {runningCount > 0 && <BrailleSpinner />}
          <span>{summary}</span>
        </button>
      </div>
    );
  }

  const hasOverflow = parts.length > INLINE_ACTIVITY_VISIBLE_COUNT;
  const overflowCount = Math.max(
    parts.length - INLINE_ACTIVITY_VISIBLE_COUNT,
    0,
  );
  const visibleParts =
    hasOverflow && !expanded
      ? parts.slice(0, INLINE_ACTIVITY_VISIBLE_COUNT)
      : parts;
  const hiddenCount = parts.length - visibleParts.length;

  return (
    <div className="my-1">
      <div className="space-y-0.5">
        {visibleParts.map((part) => (
          <PartView
            key={part.id}
            part={part}
            role={role}
            bubbleAssistantText={false}
          />
        ))}
      </div>
      {hasOverflow && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={
            expanded
              ? "Hide additional activity items"
              : `Show ${overflowCount} more activity items`
          }
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1 inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:text-xs"
        >
          {expanded ? "Hide activity" : `Show ${hiddenCount} more actions`}
        </button>
      )}
    </div>
  );
}

function MessagePartsView({
  parts,
  role,
  bubbleAssistantText,
}: {
  parts: MessagePart[];
  role: "user" | "assistant";
  bubbleAssistantText: boolean;
}) {
  const content: ReactNode[] = [];
  let i = 0;

  while (i < parts.length) {
    const part = parts[i];
    if (isActivityPart(part)) {
      const start = i;
      while (i < parts.length && isActivityPart(parts[i])) {
        i += 1;
      }
      const group = parts.slice(start, i);
      content.push(
        <ActivityGroupView
          key={`activity-${group[0].id}`}
          parts={group}
          role={role}
        />,
      );
      continue;
    }

    content.push(
      <PartView
        key={part.id}
        part={part}
        role={role}
        bubbleAssistantText={bubbleAssistantText}
      />,
    );
    i += 1;
  }

  return <>{content}</>;
}

function splitPartsByActivityBoundary(
  parts: MessagePart[],
): Array<{ isActivity: boolean; parts: MessagePart[] }> {
  const groups: Array<{ isActivity: boolean; parts: MessagePart[] }> = [];

  for (const part of parts) {
    const activity = isActivityPart(part);
    const prev = groups[groups.length - 1];

    if (!prev || prev.isActivity !== activity) {
      groups.push({ isActivity: activity, parts: [part] });
      continue;
    }

    prev.parts.push(part);
  }

  return groups;
}

function QaSummaryView({ entries }: { entries: QaEntry[] }) {
  return (
    <div className="space-y-1.5">
      {entries.map((entry) => (
        <div
          key={`${entry.header}-${entry.answers.join("|")}`}
          className="flex items-baseline gap-2"
        >
          <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-indigo-400/70 dark:text-indigo-400/60">
            {entry.header}
          </span>
          <div className="flex flex-wrap gap-1">
            {entry.answers.length > 0 ? (
              entry.answers.map((a) => (
                <span
                  key={`${entry.header}-${a}`}
                  className="inline-flex rounded-md bg-indigo-100/60 px-1.5 py-0.5 text-xs font-medium text-indigo-700/90 dark:bg-indigo-800/30 dark:text-indigo-300/80"
                >
                  {a}
                </span>
              ))
            ) : (
              <span className="text-xs italic text-indigo-300 dark:text-indigo-500">
                skipped
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ContextBadge({ count }: { count: number }) {
  return (
    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <title>Context items</title>
        <path
          d="M1 3h8M1 5h5M1 7h6"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
      + {count} {count === 1 ? "item" : "items"}
    </span>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const showSpinner =
    !isUser && !message.completedAt && !hasVisibleContent(message.parts);
  const isPseudo = message.pseudo;
  const hasQa = isPseudo && message.qaAnswers && message.qaAnswers.length > 0;
  const visibleParts = message.parts.filter((part) => isVisiblePart(part));
  const hasActivityParts = visibleParts.some((part) => isActivityPart(part));
  const partSections = splitPartsByActivityBoundary(visibleParts);
  const isActivityOnly =
    !isUser &&
    !hasQa &&
    visibleParts.length > 0 &&
    visibleParts.every((part) => isActivityPart(part));

  return (
    <div
      className={cn(
        "flex w-full flex-col",
        isUser ? "items-end" : "items-start",
      )}
    >
      {isPseudo && (
        <span
          className={cn(
            "mb-0.5 text-[10px] uppercase tracking-wider text-indigo-600/60 dark:text-indigo-400/40",
            isUser ? "mr-1" : "ml-1",
          )}
        >
          {hasQa
            ? message.qaAnswers!.length === 1
              ? "Question Answered"
              : "Questions Answered"
            : "Auto-response"}
        </span>
      )}
      {isActivityOnly ? (
        <div className="max-w-[95%] text-sm leading-relaxed text-zinc-900 dark:text-zinc-100">
          <MessagePartsView
            parts={message.parts}
            role={message.role}
            bubbleAssistantText={!isUser}
          />
          {message.error && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">
              {message.error}
            </p>
          )}
        </div>
      ) : hasActivityParts ? (
        <div className="max-w-[95%] text-sm leading-relaxed text-zinc-900 dark:text-zinc-100">
          {partSections.map((section, index) => (
            <div
              key={`section-${message.id}-${section.parts[0].id}`}
              className={cn(index > 0 && "mt-3")}
            >
              <MessagePartsView
                parts={section.parts}
                role={message.role}
                bubbleAssistantText={!isUser && !section.isActivity}
              />
            </div>
          ))}
          {message.error && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">
              {message.error}
            </p>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "max-w-[80%] overflow-hidden rounded-2xl text-sm leading-relaxed",
            isPseudo
              ? "border border-indigo-100 bg-indigo-50/50 px-3.5 py-2 dark:border-indigo-800/40 dark:bg-indigo-950/20"
              : isUser
                ? "bg-blue-600 px-4 py-2.5 text-white"
                : "bg-zinc-100 px-4 py-2.5 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100",
          )}
        >
          {hasQa ? (
            <QaSummaryView entries={message.qaAnswers!} />
          ) : showSpinner ? (
            <BrailleSpinner />
          ) : isUser && message.displayContent ? (
            <>
              <p className="whitespace-pre-wrap break-words">
                {message.displayContent}
              </p>
              {message.contextItemCount && message.contextItemCount > 0 && (
                <ContextBadge count={message.contextItemCount} />
              )}
            </>
          ) : (
            <>
              <MessagePartsView
                parts={message.parts}
                role={message.role}
                bubbleAssistantText={false}
              />
              {isUser &&
                message.contextItemCount &&
                message.contextItemCount > 0 && (
                  <ContextBadge count={message.contextItemCount} />
                )}
            </>
          )}
          {message.error && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">
              {message.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
