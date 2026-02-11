export interface MessagePart {
  id: string;
  type:
    | "text"
    | "tool"
    | "reasoning"
    | "file"
    | "step-start"
    | "step-finish"
    | string;
  text?: string;
  tool?: string;
  toolStatus?: "pending" | "running" | "completed" | "error";
  toolTitle?: string;
  toolInput?: {
    [key: string]: unknown;
  };
}

export interface ContextItem {
  id: string;
  type: "text-selection" | "image" | "file" | string;
  label: string;
  content: string;
}

export interface QaEntry {
  header: string;
  answers: string[];
}

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  createdAt: number;
  completedAt?: number;
  parts: MessagePart[];
  error?: string;
  pseudo?: boolean;
  qaAnswers?: QaEntry[];
  displayContent?: string;
  contextItemCount?: number;
}

export type SessionStatus = "idle" | "busy" | "retry";

export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionInfo {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
}

export interface QuestionRequest {
  id: string;
  sessionId: string;
  questions: QuestionInfo[];
}

export interface AgentChatProps {
  sessionId: string;
  backendUrl?: string;
  placeholder?: string;
  className?: string;
  directory?: string;
  showThinking?: boolean;
  onMessagesChange?: (messages: Message[]) => void;
  onStatusChange?: (status: SessionStatus) => void;
  contextItems?: ContextItem[];
  onClearContext?: () => void;
}
