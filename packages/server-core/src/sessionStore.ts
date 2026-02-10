import type {
  Session as OcSession,
  Message as OcMessage,
  Part as OcPart,
  SessionStatus as OcSessionStatus,
  QuestionRequest as OcQuestionRequest,
} from "@opencode-ai/sdk/v2";

export interface StoredMessage {
  info: OcMessage;
  parts: OcPart[];
}

export interface DisplayOverride {
  displayContent: string;
  contextItemCount: number;
}

interface TrackedSession {
  session: OcSession;
  messages: StoredMessage[];
  status: OcSessionStatus;
  pendingQuestion: OcQuestionRequest | null;
  preferences: SessionPreferences;
  displayOverrides: Map<string, DisplayOverride>;
}

export interface SessionPreferences {
  agent?: string;
  directory?: string;
}

export interface TrackedSessionSummary {
  id: string;
  title: string;
  time: OcSession["time"];
  agent?: string;
  directory?: string;
}

const store = new Map<string, TrackedSession>();

export type SessionEvent =
  | { type: "messages"; sessionId: string; messages: StoredMessage[] }
  | { type: "status"; sessionId: string; status: OcSessionStatus }
  | { type: "question"; sessionId: string; question: OcQuestionRequest | null };

type Listener = (event: SessionEvent) => void;

const listeners = new Map<string, Set<Listener>>();

export function subscribe(sessionId: string, listener: Listener): () => void {
  let set = listeners.get(sessionId);
  if (!set) {
    set = new Set();
    listeners.set(sessionId, set);
  }
  set.add(listener);

  return () => {
    set!.delete(listener);
    if (set!.size === 0) {
      listeners.delete(sessionId);
    }
  };
}

function emitMessages(sessionId: string): void {
  const set = listeners.get(sessionId);
  if (!set || set.size === 0) return;
  const messages = getMessages(sessionId);
  const event: SessionEvent = { type: "messages", sessionId, messages };
  for (const fn of set) fn(event);
}

function emitStatus(sessionId: string, status: OcSessionStatus): void {
  const set = listeners.get(sessionId);
  if (!set || set.size === 0) return;
  const event: SessionEvent = { type: "status", sessionId, status };
  for (const fn of set) fn(event);
}

export function trackSession(
  session: OcSession,
  preferences?: SessionPreferences,
): void {
  if (store.has(session.id)) return;
  store.set(session.id, {
    session,
    messages: [],
    status: { type: "idle" },
    pendingQuestion: null,
    displayOverrides: new Map(),
    preferences: {
      agent: preferences?.agent,
      directory: preferences?.directory,
    },
  });
}

export function getTrackedSession(sessionId: string): TrackedSession | undefined {
  return store.get(sessionId);
}

export function untrackSession(sessionId: string): boolean {
  listeners.delete(sessionId);
  return store.delete(sessionId);
}

export function listTrackedSessions(): TrackedSessionSummary[] {
  return Array.from(store.values()).map((t) => ({
    id: t.session.id,
    title: t.session.title,
    time: t.session.time,
    agent: t.preferences.agent,
    directory: t.preferences.directory,
  }));
}

export function updateSessionInfo(session: OcSession): void {
  const tracked = store.get(session.id);
  if (tracked) {
    tracked.session = session;
  }
}

export function setSessionPreferences(
  sessionId: string,
  preferences: SessionPreferences,
): void {
  const tracked = store.get(sessionId);
  if (!tracked) return;

  tracked.preferences = {
    agent: preferences.agent,
    directory: preferences.directory,
  };
}

export function getSessionPreferences(sessionId: string): SessionPreferences {
  const tracked = store.get(sessionId);
  if (!tracked) return {};
  return tracked.preferences;
}

export function getSessionPreferencesByQuestionRequest(
  requestId: string,
): SessionPreferences {
  for (const tracked of store.values()) {
    if (tracked.pendingQuestion?.id === requestId) {
      return tracked.preferences;
    }
  }
  return {};
}

export function setMessages(sessionId: string, messages: StoredMessage[]): void {
  const tracked = store.get(sessionId);
  if (tracked) {
    tracked.messages = messages;
    emitMessages(sessionId);
  }
}

export function upsertMessage(sessionId: string, info: OcMessage): void {
  const tracked = store.get(sessionId);
  if (!tracked) return;

  const idx = tracked.messages.findIndex((m) => m.info.id === info.id);
  if (idx >= 0) {
    tracked.messages[idx].info = info;
  } else {
    tracked.messages.push({ info, parts: [] });
  }
  emitMessages(sessionId);
}

export function removeMessage(sessionId: string, messageId: string): void {
  const tracked = store.get(sessionId);
  if (!tracked) return;
  tracked.messages = tracked.messages.filter((m) => m.info.id !== messageId);
  emitMessages(sessionId);
}

export function getMessages(sessionId: string): StoredMessage[] {
  return store.get(sessionId)?.messages ?? [];
}

export function upsertPart(sessionId: string, part: OcPart): void {
  const tracked = store.get(sessionId);
  if (!tracked) return;

  const msg = tracked.messages.find((m) => m.info.id === part.messageID);
  if (!msg) return;

  const idx = msg.parts.findIndex((p) => p.id === part.id);
  if (idx >= 0) {
    msg.parts[idx] = part;
  } else {
    msg.parts.push(part);
  }
  emitMessages(sessionId);
}

export function removePart(
  sessionId: string,
  messageId: string,
  partId: string,
): void {
  const tracked = store.get(sessionId);
  if (!tracked) return;

  const msg = tracked.messages.find((m) => m.info.id === messageId);
  if (!msg) return;
  msg.parts = msg.parts.filter((p) => p.id !== partId);
  emitMessages(sessionId);
}

export function setSessionStatus(
  sessionId: string,
  status: OcSessionStatus,
): void {
  const tracked = store.get(sessionId);
  if (tracked) {
    tracked.status = status;
    emitStatus(sessionId, status);
  }
}

export function getSessionStatus(sessionId: string): OcSessionStatus {
  return store.get(sessionId)?.status ?? { type: "idle" };
}

function emitQuestion(sessionId: string, question: OcQuestionRequest | null): void {
  const set = listeners.get(sessionId);
  if (!set || set.size === 0) return;
  const event: SessionEvent = { type: "question", sessionId, question };
  for (const fn of set) fn(event);
}

export function setQuestion(sessionId: string, question: OcQuestionRequest): void {
  const tracked = store.get(sessionId);
  if (!tracked) return;
  tracked.pendingQuestion = question;
  emitQuestion(sessionId, question);
}

export function clearQuestion(sessionId: string): void {
  const tracked = store.get(sessionId);
  if (!tracked) return;
  tracked.pendingQuestion = null;
  emitQuestion(sessionId, null);
}

export function getPendingQuestion(sessionId: string): OcQuestionRequest | null {
  return store.get(sessionId)?.pendingQuestion ?? null;
}

export function setDisplayOverride(
  sessionId: string,
  contentPrefix: string,
  override: DisplayOverride,
): void {
  const tracked = store.get(sessionId);
  if (!tracked) return;
  tracked.displayOverrides.set(contentPrefix, override);
}

export function getDisplayOverrides(
  sessionId: string,
): Record<string, DisplayOverride> {
  const tracked = store.get(sessionId);
  if (!tracked) return {};
  return Object.fromEntries(tracked.displayOverrides);
}
