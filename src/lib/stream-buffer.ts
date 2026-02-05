import type { StreamEvent } from "@/types/opencode-events";

export interface StreamBuffer {
  events: StreamEvent[];
  isComplete: boolean;
}

declare global {
  var __streamBuffers: Map<string, StreamBuffer> | undefined;
}

const streamBuffers =
  globalThis.__streamBuffers ??
  (globalThis.__streamBuffers = new Map<string, StreamBuffer>());

export function getOrCreateStreamBuffer(sessionId: string): StreamBuffer {
  if (!streamBuffers.has(sessionId)) {
    streamBuffers.set(sessionId, { events: [], isComplete: false });
  }
  return streamBuffers.get(sessionId)!;
}

export function getStreamBuffer(sessionId: string): StreamBuffer | undefined {
  return streamBuffers.get(sessionId);
}

export function clearStreamBuffer(sessionId: string): void {
  streamBuffers.delete(sessionId);
}

export function hasStreamBuffer(sessionId: string): boolean {
  return streamBuffers.has(sessionId);
}
