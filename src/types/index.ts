import type { Part, StreamActivity } from "@/types/opencode-events";

export type ContentType = "blog" | "white-paper" | "social-post" | "email";

export type MessageRole = "user" | "assistant" | "system" | "question";
export type MessageStatus = "pending" | "sent" | "failed" | "retrying";

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

export interface QuestionData {
  requestId: string;
  sessionId: string;
  questions: QuestionInfo[];
  answers?: string[][];
  answered?: boolean;
}

export interface Message {
  readonly id: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly timestamp: Date;
  readonly questionData?: QuestionData;
  readonly parts?: Part[];
  readonly activities?: StreamActivity[];
  readonly error?: boolean;
  readonly errorMessage?: string;
  readonly status?: MessageStatus;
  readonly retryAttempts?: number;
}

export interface Project {
  id: string;
  name: string;
  contentType: ContentType;
  brief: string;
  wordCount: number;
  styleHints: string;
  documentContent: string;
  messages: Message[];
  opencodeSessionId?: string;
  directoryPath: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StarterFormData {
  contentType: ContentType;
  wordCount: number;
  styleHints: string;
  brief: string;
}

export interface TextSelection {
  text: string;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
}

export interface AnalysisMetrics {
  readabilityScore: number;
  wordCount: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
  briefAdherenceScore: number;
}

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export interface OpenCodeSession {
  sessionId: string;
  projectId: string;
  isActive: boolean;
  lastActivity: Date;
}

export interface StreamChunk {
  type: "content" | "status" | "done" | "error" | "question";
  content?: string;
  error?: string;
  sessionId?: string;
  questionData?: QuestionData;
}
