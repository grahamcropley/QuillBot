/**
 * OpenCode SDK Event Types - Aligned with SDK v2
 *
 * Re-exports types from @opencode-ai/sdk and defines SSE event structures
 * for streaming responses to the frontend.
 */

// Re-export SDK types that are actually used
export type {
  TextPart,
  ToolPart,
  Part,
  ToolState,
  SessionStatus,
  ProviderAuthError,
  UnknownError,
  MessageOutputLengthError,
  MessageAbortedError,
  ApiError,
} from "@opencode-ai/sdk/v2/client";

// SSE Event Types for frontend-backend communication

export interface StreamMessagePartUpdated {
  type: "part";
  part: import("@opencode-ai/sdk/v2/client").Part;
  delta?: string;
}

export interface StreamQuestionAsked {
  type: "question";
  data: QuestionRequest;
}

export interface StreamSessionStatus {
  type: "status";
  sessionStatus: import("@opencode-ai/sdk/v2/client").SessionStatus;
  sessionId: string;
}

export interface StreamError {
  type: "error";
  error: string;
  sessionId?: string;
}

export interface StreamDone {
  type: "done";
  sessionId: string;
}

export interface StreamFileEdited {
  type: "file.edited";
  file: string;
}

export interface StreamActivity {
  type: "activity";
  activityType:
    | "tui.prompt.append"
    | "tui.command.execute"
    | "tui.toast.show"
    | "command.executed"
    | "mcp.tools.changed"
    | "mcp.browser.open.failed"
    | "permission.asked"
    | "permission.replied"
    | "todo.updated"
    | "file.edited";
  data: Record<string, unknown>;
  sessionId?: string;
  messageId?: string;
}

export type StreamEvent =
  | StreamMessagePartUpdated
  | StreamQuestionAsked
  | StreamSessionStatus
  | StreamError
  | StreamDone
  | StreamFileEdited
  | StreamActivity;

// Question types

export interface QuestionOption {
  label: string;
  description?: string;
}

export interface QuestionInfo {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
}

export interface QuestionRequest {
  requestId: string;
  sessionId: string;
  questions: QuestionInfo[];
}

export interface QuestionAnswer {
  requestId: string;
  sessionId: string;
  answers: string[][];
}

// Type guard functions

export function isStreamMessagePartUpdated(
  event: StreamEvent,
): event is StreamMessagePartUpdated {
  return event.type === "part";
}

export function isStreamQuestionAsked(
  event: StreamEvent,
): event is StreamQuestionAsked {
  return event.type === "question";
}

export function isStreamSessionStatus(
  event: StreamEvent,
): event is StreamSessionStatus {
  return event.type === "status";
}

export function isStreamError(event: StreamEvent): event is StreamError {
  return event.type === "error";
}

export function isStreamDone(event: StreamEvent): event is StreamDone {
  return event.type === "done";
}

export function isStreamFileEdited(
  event: StreamEvent,
): event is StreamFileEdited {
  return event.type === "file.edited";
}

export function isStreamActivity(event: StreamEvent): event is StreamActivity {
  return event.type === "activity";
}
