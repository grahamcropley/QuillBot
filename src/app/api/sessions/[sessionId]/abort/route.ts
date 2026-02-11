import { NextResponse } from "next/server";

import {
  opencode,
  getTrackedSession,
  getSessionPreferences,
  setSessionPreferences,
} from "@agent-chat/server-core";

interface SessionContext {
  params: Promise<{ sessionId: string }>;
}

export async function POST(request: Request, context: SessionContext) {
  const { sessionId } = await context.params;
  const url = new URL(request.url);
  const directoryParam = url.searchParams.get("directory")?.trim() || undefined;

  let preferences = getSessionPreferences(sessionId);
  if (!preferences.directory && directoryParam) {
    preferences = { ...preferences, directory: directoryParam };
  }

  if (directoryParam && getTrackedSession(sessionId)) {
    setSessionPreferences(sessionId, preferences);
  }

  try {
    const { error } = await opencode.session.abort({
      sessionID: sessionId,
      directory: preferences.directory,
    });

    if (error) {
      return NextResponse.json(
        { error: "Failed to interrupt session" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
