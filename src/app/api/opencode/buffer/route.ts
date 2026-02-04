import { NextRequest } from "next/server";
import type { StreamEvent } from "@/types/opencode-events";

const streamBuffers = new Map<
  string,
  { events: StreamEvent[]; isComplete: boolean }
>();

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const lastEventIndex = request.nextUrl.searchParams.get("lastEventIndex");

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const buffer = streamBuffers.get(sessionId);

    if (!buffer) {
      return new Response(
        JSON.stringify({
          events: [],
          isComplete: false,
          nextEventIndex: 0,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const startIndex = lastEventIndex ? parseInt(lastEventIndex, 10) : 0;
    const events = buffer.events.slice(startIndex);

    return new Response(
      JSON.stringify({
        events,
        isComplete: buffer.isComplete,
        nextEventIndex: startIndex + events.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[OpenCode Buffer API] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to retrieve buffered events" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export function registerStreamBuffer(
  sessionId: string,
  buffer: { events: StreamEvent[]; isComplete: boolean },
): void {
  streamBuffers.set(sessionId, buffer);
}

export function getStreamBuffer(
  sessionId: string,
): { events: StreamEvent[]; isComplete: boolean } | undefined {
  return streamBuffers.get(sessionId);
}
