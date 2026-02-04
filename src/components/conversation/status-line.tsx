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
} from "lucide-react";
import { useProjectStore } from "@/stores/project-store";
import type { ToolState } from "@/types/opencode-events";

type StatusType =
  | "idle"
  | "connecting"
  | "thinking"
  | "tool"
  | "waiting-for-answer"
  | "processing-answer"
  | "complete"
  | "error";

interface StatusLineProps {
  status: StatusType;
  message?: string;
  toolName?: string;
  showToolStates?: boolean;
}

const TOOL_ICONS: Record<string, LucideIcon> = {
  read: FileText,
  write: Pencil,
  edit: Pencil,
  grep: Search,
  glob: FolderOpen,
  bash: Terminal,
  question: HelpCircle,
};

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

interface StatusConfig {
  icon: LucideIcon;
  text: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  animate?: boolean;
}

const BASE_STATUS_CONFIG: Record<Exclude<StatusType, "tool">, StatusConfig> = {
  idle: {
    icon: CheckCircle2,
    text: "Your turn",
    bgColor: "bg-transparent",
    borderColor: "border-transparent",
    textColor: "text-gray-400 dark:text-gray-600",
  },
  connecting: {
    icon: Loader2,
    text: "Connecting to OpenCode... this can take a moment",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-200 dark:border-blue-800",
    textColor: "text-blue-700 dark:text-blue-300",
    animate: true,
  },
  thinking: {
    icon: Loader2,
    text: "Working on it...",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-200 dark:border-blue-800",
    textColor: "text-blue-700 dark:text-blue-300",
    animate: true,
  },
  "waiting-for-answer": {
    icon: MessageSquare,
    text: "Waiting for your response so I can continue",
    bgColor: "bg-amber-50 dark:bg-amber-950",
    borderColor: "border-amber-200 dark:border-amber-800",
    textColor: "text-amber-700 dark:text-amber-300",
  },
  "processing-answer": {
    icon: Loader2,
    text: "Got it—processing your answer...",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-200 dark:border-blue-800",
    textColor: "text-blue-700 dark:text-blue-300",
    animate: true,
  },
  complete: {
    icon: CheckCircle2,
    text: "All set",
    bgColor: "bg-green-50 dark:bg-green-950",
    borderColor: "border-green-200 dark:border-green-800",
    textColor: "text-green-700 dark:text-green-300",
  },
  error: {
    icon: AlertCircle,
    text: "Something went wrong—try again",
    bgColor: "bg-red-50 dark:bg-red-950",
    borderColor: "border-red-200 dark:border-red-800",
    textColor: "text-red-700 dark:text-red-300",
  },
};

function getStatusConfig(
  status: StatusType,
  toolName?: string,
  message?: string,
): StatusConfig {
  if (status === "tool") {
    const icon = toolName ? TOOL_ICONS[toolName] || Loader2 : Loader2;
    return {
      icon,
      text: message || "Using a tool...",
      bgColor: "bg-purple-50 dark:bg-purple-950",
      borderColor: "border-purple-200 dark:border-purple-800",
      textColor: "text-purple-700 dark:text-purple-300",
      animate: toolName !== "question",
    };
  }

  const config = BASE_STATUS_CONFIG[status];
  return {
    ...config,
    text: message || config.text,
  };
}

interface ToolStatusLineProps {
  toolState: ToolState;
  toolName: string;
}

function ToolStatusLine({ toolState, toolName }: ToolStatusLineProps) {
  const config = getToolStateIconConfig(toolState);
  const IconComponent = config.icon;
  const toolIcon = TOOL_ICONS[toolName] || Terminal;
  const ToolIconComponent = toolIcon;

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
          Working...
        </span>
      </div>
    );
  }

  return null;
}

export function StatusLine({
  status,
  message,
  toolName,
  showToolStates = true,
}: StatusLineProps) {
  if (status === "idle" && showToolStates) {
    return (
      <div>
        <SessionStatusDisplay />
        <ToolStatesDisplay />
        <div className="mt-2">
          <IdleStatusLine />
        </div>
      </div>
    );
  }

  const config = getStatusConfig(status, toolName, message);
  const IconComponent = config.icon;

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

function IdleStatusLine() {
  const config = BASE_STATUS_CONFIG.idle;
  const IconComponent = config.icon;

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
  );
}

export function parseStatusMessage(statusMessage: string): {
  status: StatusType;
  message: string;
  toolName?: string;
} {
  if (!statusMessage) {
    return { status: "idle", message: "" };
  }

  const lowerMessage = statusMessage.toLowerCase();

  if (lowerMessage.includes("connecting")) {
    return { status: "connecting", message: statusMessage };
  }

  if (
    lowerMessage.includes("thinking") ||
    lowerMessage.includes("processing")
  ) {
    return { status: "thinking", message: statusMessage };
  }

  if (lowerMessage.includes("waiting for your")) {
    return { status: "waiting-for-answer", message: statusMessage };
  }

  if (lowerMessage.includes("processing your answer")) {
    return { status: "processing-answer", message: statusMessage };
  }

  const toolPatterns: Array<{ pattern: RegExp; tool: string }> = [
    { pattern: /creating\s+/i, tool: "write" },
    { pattern: /editing\s+/i, tool: "edit" },
    { pattern: /reading\s+/i, tool: "read" },
    { pattern: /searching/i, tool: "grep" },
    { pattern: /finding files/i, tool: "glob" },
    { pattern: /running/i, tool: "bash" },
    { pattern: /using tool/i, tool: "unknown" },
  ];

  for (const { pattern, tool } of toolPatterns) {
    if (pattern.test(statusMessage)) {
      return { status: "tool", message: statusMessage, toolName: tool };
    }
  }

  return { status: "thinking", message: statusMessage };
}
