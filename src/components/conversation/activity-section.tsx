"use client";

import { clsx } from "clsx";
import type { ActivityKind, RenderItemActivity } from "@/types/opencode-events";

const ACTIVITY_KIND_STYLES: Record<
  ActivityKind,
  {
    label: string;
    badge: string;
    border: string;
    text: string;
    content: string;
  }
> = {
  thinking: {
    label: "Thinking",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
    border:
      "border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/40",
    text: "text-blue-800 dark:text-blue-100",
    content: "text-blue-700 dark:text-blue-200",
  },
  tool: {
    label: "Tool",
    badge:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200",
    border:
      "border-purple-200 dark:border-purple-900/60 bg-purple-50/70 dark:bg-purple-950/40",
    text: "text-purple-800 dark:text-purple-100",
    content: "text-purple-700 dark:text-purple-200",
  },
  "tool-web": {
    label: "Web",
    badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-200",
    border:
      "border-cyan-200 dark:border-cyan-900/60 bg-cyan-50/70 dark:bg-cyan-950/40",
    text: "text-cyan-800 dark:text-cyan-100",
    content: "text-cyan-700 dark:text-cyan-200",
  },
  "tool-file": {
    label: "File",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
    border:
      "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/40",
    text: "text-emerald-800 dark:text-emerald-100",
    content: "text-emerald-700 dark:text-emerald-200",
  },
  delegating: {
    label: "Delegate",
    badge:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200",
    border:
      "border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/40",
    text: "text-indigo-800 dark:text-indigo-100",
    content: "text-indigo-700 dark:text-indigo-200",
  },
  system: {
    label: "System",
    badge: "bg-gray-100 text-gray-700 dark:bg-gray-900/50 dark:text-gray-300",
    border:
      "border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40",
    text: "text-gray-700 dark:text-gray-200",
    content: "text-gray-600 dark:text-gray-400",
  },
  mcp: {
    label: "MCP",
    badge: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200",
    border:
      "border-teal-200 dark:border-teal-900/60 bg-teal-50/70 dark:bg-teal-950/40",
    text: "text-teal-800 dark:text-teal-100",
    content: "text-teal-700 dark:text-teal-200",
  },
  command: {
    label: "Command",
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
    border:
      "border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/40",
    text: "text-amber-800 dark:text-amber-100",
    content: "text-amber-700 dark:text-amber-200",
  },
  retry: {
    label: "Retry",
    badge:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200",
    border:
      "border-orange-200 dark:border-orange-900/60 bg-orange-50/70 dark:bg-orange-950/40",
    text: "text-orange-800 dark:text-orange-100",
    content: "text-orange-700 dark:text-orange-200",
  },
  compaction: {
    label: "Compaction",
    badge:
      "bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
    border:
      "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40",
    text: "text-slate-700 dark:text-slate-200",
    content: "text-slate-600 dark:text-slate-400",
  },
  step: {
    label: "Step",
    badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-200",
    border:
      "border-cyan-200 dark:border-cyan-900/60 bg-cyan-50/70 dark:bg-cyan-950/40",
    text: "text-cyan-800 dark:text-cyan-100",
    content: "text-cyan-700 dark:text-cyan-200",
  },
  file: {
    label: "File",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
    border:
      "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/40",
    text: "text-emerald-800 dark:text-emerald-100",
    content: "text-emerald-700 dark:text-emerald-200",
  },
  permission: {
    label: "Permission",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
    border:
      "border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/40",
    text: "text-rose-800 dark:text-rose-100",
    content: "text-rose-700 dark:text-rose-200",
  },
  todo: {
    label: "Todo",
    badge: "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-200",
    border:
      "border-lime-200 dark:border-lime-900/60 bg-lime-50/70 dark:bg-lime-950/40",
    text: "text-lime-800 dark:text-lime-100",
    content: "text-lime-700 dark:text-lime-200",
  },
  other: {
    label: "Activity",
    badge: "bg-gray-100 text-gray-700 dark:bg-gray-900/50 dark:text-gray-300",
    border:
      "border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40",
    text: "text-gray-700 dark:text-gray-200",
    content: "text-gray-600 dark:text-gray-400",
  },
};

const STATUS_BADGES: Record<RenderItemActivity["status"], string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-900/60 dark:text-gray-300",
  running: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200",
  completed:
    "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-200",
  error: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200",
};

const STATUS_LABELS: Record<RenderItemActivity["status"], string> = {
  pending: "pending",
  running: "progressing...",
  completed: "complete",
  error: "error",
};

interface ActivitySectionProps {
  item: RenderItemActivity;
}

export function ActivitySection({ item }: ActivitySectionProps) {
  const style = ACTIVITY_KIND_STYLES[item.kind] ?? ACTIVITY_KIND_STYLES.other;
  const isTruncatable = item.kind === "tool-web";
  const hasContent =
    item.expandedContent && item.expandedContent.trim().length > 0;

  return (
    <details
      className={clsx("w-full rounded-lg border px-3 py-2", style.border)}
    >
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={clsx(
              "text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full",
              style.badge,
            )}
          >
            {style.label}
          </span>
          <span
            className={clsx(
              "text-xs font-medium",
              style.text,
              isTruncatable && "max-w-sm break-words",
            )}
            title={
              isTruncatable
                ? typeof item.title === "string"
                  ? item.title
                  : undefined
                : undefined
            }
          >
            {item.title}
          </span>
          <span
            className={clsx(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full",
              STATUS_BADGES[item.status],
            )}
          >
            ({STATUS_LABELS[item.status]})
          </span>
        </div>
      </summary>
      {hasContent ? (
        <pre
          className={clsx(
            "mt-2 whitespace-pre-wrap text-xs italic",
            style.content,
          )}
        >
          {item.expandedContent}
        </pre>
      ) : (
        <div className={clsx("mt-2 text-xs italic opacity-50", style.content)}>
          (No details available)
        </div>
      )}
    </details>
  );
}

export { ACTIVITY_KIND_STYLES, STATUS_BADGES };
