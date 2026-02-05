"use client";

import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  Loader2,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Pencil,
  FileText,
  Search,
  FolderOpen,
  Terminal,
  HelpCircle,
  Clock,
  Globe,
  Users,
} from "lucide-react";
import { useProjectStore } from "@/stores/project-store";
import type {
  ToolState,
  StreamStatus,
  ToolCategory,
} from "@/types/opencode-events";

// --- Tool icon mapping ---

const TOOL_ICONS: Record<string, LucideIcon> = {
  read: FileText,
  write: Pencil,
  edit: Pencil,
  apply_patch: Pencil,
  grep: Search,
  glob: FolderOpen,
  bash: Terminal,
  question: HelpCircle,
  webfetch: Globe,
  websearch_web_search_exa: Globe,
  context7_resolve_library_id: Globe,
  "context7_resolve-library-id": Globe,
  context7_query_docs: Globe,
  "context7_query-docs": Globe,
  delegate_task: Users,
  task: Users,
};

function getToolIcon(
  toolName?: string,
  toolCategory?: ToolCategory,
): LucideIcon {
  if (toolName && TOOL_ICONS[toolName]) {
    return TOOL_ICONS[toolName];
  }
  switch (toolCategory) {
    case "file":
      return FileText;
    case "web":
      return Globe;
    case "delegation":
      return Users;
    case "question":
      return HelpCircle;
    default:
      return Terminal;
  }
}

// --- Visual config per StreamStatus.kind ---

interface StatusVisualConfig {
  icon: LucideIcon;
  text: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  animate?: boolean;
}

function getStatusVisualConfig(status: StreamStatus): StatusVisualConfig {
  switch (status.kind) {
    case "idle":
      return {
        icon: CheckCircle2,
        text: "Your turn",
        bgColor: "bg-transparent",
        borderColor: "border-transparent",
        textColor: "text-gray-400 dark:text-gray-600",
      };

    case "connecting":
      return {
        icon: Loader2,
        text:
          status.label || "Connecting to OpenCode... this can take a moment",
        bgColor: "bg-blue-50 dark:bg-blue-950",
        borderColor: "border-blue-200 dark:border-blue-800",
        textColor: "text-blue-700 dark:text-blue-300",
        animate: true,
      };

    case "thinking":
      return {
        icon: Loader2,
        text: status.label || "Working on it...",
        bgColor: "bg-blue-50 dark:bg-blue-950",
        borderColor: "border-blue-200 dark:border-blue-800",
        textColor: "text-blue-700 dark:text-blue-300",
        animate: true,
      };

    case "replying":
      return {
        icon: Loader2,
        text: status.label || "Replying...",
        bgColor: "bg-blue-50 dark:bg-blue-950",
        borderColor: "border-blue-200 dark:border-blue-800",
        textColor: "text-blue-700 dark:text-blue-300",
        animate: true,
      };

    case "tool": {
      const icon = getToolIcon(status.toolName, status.toolCategory);
      return {
        icon,
        text: status.label || "Using a tool...",
        bgColor: "bg-purple-50 dark:bg-purple-950",
        borderColor: "border-purple-200 dark:border-purple-800",
        textColor: "text-purple-700 dark:text-purple-300",
        animate: status.toolName !== "question",
      };
    }

    case "waiting-for-answer":
      return {
        icon: MessageSquare,
        text: status.label || "Waiting for your response so I can continue",
        bgColor: "bg-amber-50 dark:bg-amber-950",
        borderColor: "border-amber-200 dark:border-amber-800",
        textColor: "text-amber-700 dark:text-amber-300",
      };

    case "processing-answer":
      return {
        icon: Loader2,
        text: status.label || "Got it—processing your answer...",
        bgColor: "bg-blue-50 dark:bg-blue-950",
        borderColor: "border-blue-200 dark:border-blue-800",
        textColor: "text-blue-700 dark:text-blue-300",
        animate: true,
      };

    case "complete":
      return {
        icon: CheckCircle2,
        text: status.label || "All set",
        bgColor: "bg-green-50 dark:bg-green-950",
        borderColor: "border-green-200 dark:border-green-800",
        textColor: "text-green-700 dark:text-green-300",
      };

    case "error":
      return {
        icon: AlertCircle,
        text: status.label || "Something went wrong—try again",
        bgColor: "bg-red-50 dark:bg-red-950",
        borderColor: "border-red-200 dark:border-red-800",
        textColor: "text-red-700 dark:text-red-300",
      };
  }
}

// --- Tool state display (per-tool status from store) ---

interface ToolStateIconConfig {
  icon: LucideIcon;
  bgColor: string;
  borderColor: string;
  textColor: string;
  animate: boolean;
}

function getToolStateIconConfig(state: ToolState): ToolStateIconConfig {
  switch (state.status) {
    case "pending":
      return {
        icon: Clock,
        bgColor: "bg-gray-50 dark:bg-gray-900",
        borderColor: "border-gray-200 dark:border-gray-700",
        textColor: "text-gray-600 dark:text-gray-400",
        animate: false,
      };
    case "running":
      return {
        icon: Loader2,
        bgColor: "bg-blue-50 dark:bg-blue-950",
        borderColor: "border-blue-200 dark:border-blue-800",
        textColor: "text-blue-700 dark:text-blue-300",
        animate: true,
      };
    case "completed":
      return {
        icon: CheckCircle2,
        bgColor: "bg-green-50 dark:bg-green-950",
        borderColor: "border-green-200 dark:border-green-800",
        textColor: "text-green-700 dark:text-green-300",
        animate: false,
      };
    case "error":
      return {
        icon: AlertCircle,
        bgColor: "bg-red-50 dark:bg-red-950",
        borderColor: "border-red-200 dark:border-red-800",
        textColor: "text-red-700 dark:text-red-300",
        animate: false,
      };
  }
}

interface ToolStatusLineProps {
  toolState: ToolState;
  toolName: string;
}

function ToolStatusLine({ toolState, toolName }: ToolStatusLineProps) {
  const config = getToolStateIconConfig(toolState);
  const IconComponent = config.icon;
  const ToolIconComponent = TOOL_ICONS[toolName] || Terminal;

  return (
    <div
      className={clsx(
        "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200",
        config.bgColor,
        config.borderColor,
      )}
      role="status"
      aria-live="polite"
    >
      <ToolIconComponent
        className={clsx("w-4 h-4 flex-shrink-0", config.textColor)}
      />
      <span className={clsx("text-xs font-medium", config.textColor)}>
        {toolName}
      </span>
      <IconComponent
        className={clsx(
          "w-3 h-3 flex-shrink-0",
          config.textColor,
          config.animate && "animate-spin",
        )}
      />
      <span className={clsx("text-xs", config.textColor)}>
        {toolState.status}
      </span>
    </div>
  );
}

function ToolStatesDisplay() {
  const { currentToolStates } = useProjectStore();

  if (currentToolStates.size === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {Array.from(currentToolStates.entries()).map(
        ([, { state, toolName }]) => (
          <ToolStatusLine
            key={state.status}
            toolState={state}
            toolName={toolName}
          />
        ),
      )}
    </div>
  );
}

function SessionStatusDisplay() {
  const { sessionStatus, retryAttempt } = useProjectStore();

  if (sessionStatus === "idle") {
    return null;
  }

  if (sessionStatus === "retry") {
    return (
      <div
        className={clsx(
          "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200",
          "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800",
        )}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="w-4 h-4 flex-shrink-0 text-yellow-700 dark:text-yellow-300 animate-spin" />
        <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
          Retrying... (Attempt {retryAttempt ?? 1})
        </span>
      </div>
    );
  }

  if (sessionStatus === "busy") {
    return (
      <div
        className={clsx(
          "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200",
          "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
        )}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="w-4 h-4 flex-shrink-0 text-blue-700 dark:text-blue-300 animate-spin" />
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          Working on it...
        </span>
      </div>
    );
  }

  return null;
}

// --- Primary StatusLine component ---

interface StatusLineProps {
  streamStatus: StreamStatus;
  showToolStates?: boolean;
}

export function StatusLine({
  streamStatus,
  showToolStates = true,
}: StatusLineProps) {
  const config = getStatusVisualConfig(streamStatus);
  const IconComponent = config.icon;

  if (streamStatus.kind === "idle" && showToolStates) {
    return (
      <div>
        <SessionStatusDisplay />
        <ToolStatesDisplay />
        <div className="mt-2">
          <div
            className={clsx(
              "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200",
              config.bgColor,
              config.borderColor,
            )}
            role="status"
            aria-live="polite"
          >
            <IconComponent
              className={clsx(
                "w-4 h-4 flex-shrink-0",
                config.textColor,
                config.animate && "animate-spin",
              )}
            />
            <span className={clsx("text-sm font-medium", config.textColor)}>
              {config.text}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        className={clsx(
          "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200",
          config.bgColor,
          config.borderColor,
        )}
        role="status"
        aria-live="polite"
      >
        <IconComponent
          className={clsx(
            "w-4 h-4 flex-shrink-0",
            config.textColor,
            config.animate && "animate-spin",
          )}
        />
        <span className={clsx("text-sm font-medium", config.textColor)}>
          {config.text}
        </span>
      </div>
      {showToolStates && (
        <div className="mt-2 space-y-2">
          <SessionStatusDisplay />
          <ToolStatesDisplay />
        </div>
      )}
    </div>
  );
}
