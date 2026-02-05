import { NextRequest } from "next/server";
import { getStreamBuffer, clearStreamBuffer } from "@/lib/stream-buffer";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const lastEventIndex = request.nextUrl.searchParams.get("lastEventIndex");
    const shouldClear = request.nextUrl.searchParams.get("clear") === "true";

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const buffer = getStreamBuffer(sessionId);

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

    if (shouldClear && buffer.isComplete) {
      clearStreamBuffer(sessionId);
    }

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
