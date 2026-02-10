import { NextResponse } from "next/server";
import {
  opencode,
  ensureEventListener,
  trackSession,
  setMessages,
  listTrackedSessions,
  getSessionPreferences,
  getSessionPreferencesByQuestionRequest,
  getTrackedSession,
  getMessages,
  getSessionStatus,
  getPendingQuestion,
  subscribe,
  untrackSession,
  setDisplayOverride,
  getDisplayOverrides,
} from "@agent-chat/server-core";
import type { SessionEvent } from "@agent-chat/server-core";

interface SessionContext {
  params: Promise<{ sessionId: string }>;
}

interface RequestContext {
  params: Promise<{ requestId: string }>;
}

interface SessionCreateBody {
  title?: string;
  agent?: string;
  directory?: string;
}

interface MessagePostBody {
  content: string;
  displayContent?: string;
  contextParts?: Array<{ type: string; label: string; content: string }>;
}

interface QuestionReplyBody {
  answers: string[][];
}

function internalError(err: unknown) {
  const message = err instanceof Error ? err.message : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}

export function createAgentChatNextHandlers() {
  const agents = {
    GET: async (request: Request) => {
      try {
        const { searchParams } = new URL(request.url);
        const directory = searchParams.get("directory")?.trim() || undefined;

        const { data, error } = await opencode.app.agents(
          directory ? { directory } : undefined,
        );

        if (error || !data) {
          return NextResponse.json(
            { error: "Failed to list agents" },
            { status: 502 },
          );
        }

        const filtered = data
          .filter((agent) => !agent.hidden)
          .map((agent) => ({
            name: agent.name,
            description: agent.description,
            mode: agent.mode,
          }));

        return NextResponse.json(filtered);
      } catch (err) {
        return internalError(err);
      }
    },
  };

  const sessions = {
    GET: async () => NextResponse.json(listTrackedSessions()),
    POST: async (request: Request) => {
      try {
        const body = (await request.json()) as SessionCreateBody;
        const directory = body.directory?.trim() || undefined;
        const agent = body.agent?.trim() || undefined;

        await ensureEventListener(directory);

        const { data: session, error } = await opencode.session.create({
          directory,
          title: body.title,
        });

        if (error || !session) {
          return NextResponse.json(
            { error: "Failed to create session" },
            { status: 502 },
          );
        }

        trackSession(session, { agent, directory });

        const { data: messagesData } = await opencode.session.messages({
          sessionID: session.id,
          directory,
        });

        if (messagesData) {
          setMessages(session.id, messagesData);
        }

        return NextResponse.json(session, { status: 201 });
      } catch (err) {
        return internalError(err);
      }
    },
  };

  const session = {
    DELETE: async (_request: Request, context: SessionContext) => {
      const { sessionId } = await context.params;
      const preferences = getSessionPreferences(sessionId);

      try {
        const { error } = await opencode.session.delete({
          sessionID: sessionId,
          directory: preferences.directory,
        });

        if (error) {
          return NextResponse.json(
            { error: "Failed to delete session" },
            { status: 502 },
          );
        }

        untrackSession(sessionId);
        return new NextResponse(null, { status: 204 });
      } catch (err) {
        return internalError(err);
      }
    },
  };

  const messages = {
    GET: async (_request: Request, context: SessionContext) => {
      const { sessionId } = await context.params;
      const preferences = getSessionPreferences(sessionId);

      await ensureEventListener(preferences.directory);

      if (!getTrackedSession(sessionId)) {
        const { data: foundSession, error } = await opencode.session.get({
          sessionID: sessionId,
          directory: preferences.directory,
        });

        if (error || !foundSession) {
          return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        trackSession(foundSession);

        const { data: messagesData } = await opencode.session.messages({
          sessionID: sessionId,
          directory: preferences.directory,
        });

        if (messagesData) {
          setMessages(sessionId, messagesData);
        }
      }

      return NextResponse.json({
        messages: getMessages(sessionId),
        status: getSessionStatus(sessionId),
        displayOverrides: getDisplayOverrides(sessionId),
      });
    },
    POST: async (request: Request, context: SessionContext) => {
      const { sessionId } = await context.params;
      const url = new URL(request.url);
      const directoryParam = url.searchParams.get("directory");
      
      let preferences = getSessionPreferences(sessionId);
      // If not in store, use directory from query param (for cross-request recovery)
      if (!preferences.directory && directoryParam) {
        preferences = { ...preferences, directory: directoryParam };
      }

      try {
        const body = (await request.json()) as MessagePostBody;

        if (!body.content?.trim()) {
          return NextResponse.json(
            { error: "Message content is required" },
            { status: 400 },
          );
        }

        await ensureEventListener(preferences.directory);

        if (!getTrackedSession(sessionId)) {
          const { data: foundSession, error } = await opencode.session.get({
            sessionID: sessionId,
            directory: preferences.directory,
          });

          if (error || !foundSession) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
          }

          trackSession(foundSession);
        }

        const parts: Array<{ type: "text"; text: string }> = [
          { type: "text", text: body.content.trim() },
        ];

        if (body.contextParts && body.contextParts.length > 0) {
          for (const ctx of body.contextParts) {
            parts.push({
              type: "text",
              text: `--- ${ctx.label} ---\n${ctx.content}`,
            });
          }

          setDisplayOverride(sessionId, body.content.trim(), {
            displayContent: body.displayContent ?? body.content.trim(),
            contextItemCount: body.contextParts.length,
          });
        }

        const { error } = await opencode.session.promptAsync({
          sessionID: sessionId,
          directory: preferences.directory,
          agent: preferences.agent,
          parts,
        });

        if (error) {
          return NextResponse.json(
            { error: "Failed to send message" },
            { status: 502 },
          );
        }

        return new NextResponse(null, { status: 202 });
      } catch (err) {
        return internalError(err);
      }
    },
  };

  const events = {
    GET: async (request: Request, context: SessionContext) => {
      const { sessionId } = await context.params;
      const url = new URL(request.url);
      const directoryParam = url.searchParams.get("directory");
      
      let preferences = getSessionPreferences(sessionId);
      // If not in store, use directory from query param (for cross-request recovery)
      if (!preferences.directory && directoryParam) {
        preferences = { ...preferences, directory: directoryParam };
      }

      await ensureEventListener(preferences.directory);

      if (!getTrackedSession(sessionId)) {
        const { data: foundSession, error } = await opencode.session.get({
          sessionID: sessionId,
          directory: preferences.directory,
        });

        if (error || !foundSession) {
          return new Response(JSON.stringify({ error: "Session not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        trackSession(foundSession);

        const { data: messagesData } = await opencode.session.messages({
          sessionID: sessionId,
          directory: preferences.directory,
        });

        if (messagesData) {
          setMessages(sessionId, messagesData);
        }
      }

      const encoder = new TextEncoder();
      let unsubscribe: (() => void) | null = null;

      const stream = new ReadableStream({
        start(controller) {
          const send = (event: string, data: unknown) => {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
            );
          };

          send("snapshot", {
            messages: getMessages(sessionId),
            status: getSessionStatus(sessionId),
            question: getPendingQuestion(sessionId),
            displayOverrides: getDisplayOverrides(sessionId),
          });

          unsubscribe = subscribe(sessionId, (event: SessionEvent) => {
            try {
              if (event.type === "messages") {
                send("messages", {
                  messages: event.messages,
                  displayOverrides: getDisplayOverrides(sessionId),
                });
              } else if (event.type === "status") {
                send("status", event.status);
              } else if (event.type === "question") {
                send("question", event.question);
              }
            } catch {
              unsubscribe?.();
            }
          });
        },
        cancel() {
          unsubscribe?.();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    },
  };

  const questions = {
    reply: {
      POST: async (request: Request, context: RequestContext) => {
        const { requestId } = await context.params;
        const preferences = getSessionPreferencesByQuestionRequest(requestId);

        try {
          const body = (await request.json()) as QuestionReplyBody;

          if (!Array.isArray(body.answers)) {
            return NextResponse.json(
              { error: "answers must be an array" },
              { status: 400 },
            );
          }

          const { error } = await opencode.question.reply({
            requestID: requestId,
            directory: preferences.directory,
            answers: body.answers,
          });

          if (error) {
            return NextResponse.json(
              { error: "Failed to submit answers" },
              { status: 502 },
            );
          }

          return NextResponse.json({ ok: true });
        } catch (err) {
          return internalError(err);
        }
      },
    },
    reject: {
      POST: async (_request: Request, context: RequestContext) => {
        const { requestId } = await context.params;
        const preferences = getSessionPreferencesByQuestionRequest(requestId);

        try {
          const { error } = await opencode.question.reject({
            requestID: requestId,
            directory: preferences.directory,
          });

          if (error) {
            return NextResponse.json(
              { error: "Failed to reject question" },
              { status: 502 },
            );
          }

          return NextResponse.json({ ok: true });
        } catch (err) {
          return internalError(err);
        }
      },
    },
  };

  return {
    agents,
    sessions,
    session,
    messages,
    events,
    questions,
  };
}
