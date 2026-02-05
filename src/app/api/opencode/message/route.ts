import { NextRequest } from "next/server";
import { getOpencodeClient } from "@/lib/opencode-client";
import { updateProject, getProject } from "@/lib/storage";
import { getOrCreateStreamBuffer } from "@/lib/stream-buffer";
import type {
  StreamEvent,
  StreamMessagePartUpdated,
  StreamQuestionAsked,
  StreamSessionStatus,
  StreamError,
  StreamDone,
  StreamFileEdited,
  StreamActivity,
  ProviderAuthError,
  UnknownError,
  MessageOutputLengthError,
  MessageAbortedError,
  ApiError,
} from "@/types/opencode-events";
import type { Event as SdkEvent } from "@opencode-ai/sdk/v2/client";

interface RequestBody {
  sessionId?: string;
  projectId: string;
  message: string;
  command?: string;
  agent?: string;
}

function formatSseEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

type SessionError =
  | ProviderAuthError
  | UnknownError
  | MessageOutputLengthError
  | MessageAbortedError
  | ApiError;

function extractErrorMessage(error: SessionError | undefined): string {
  if (!error) {
    return "Unknown error";
  }
  switch (error.name) {
    case "ProviderAuthError":
      return error.data.message;
    case "UnknownError":
      return error.data.message;
    case "MessageAbortedError":
      return error.data.message;
    case "APIError":
      return error.data.message;
    case "MessageOutputLengthError":
      return "Message output length exceeded";
    default:
      return "Unknown error";
  }
}

function isSessionNotFoundError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const normalized = message.toLowerCase();
  return (
    normalized.includes("session") &&
    (normalized.includes("not found") || normalized.includes("does not exist"))
  );
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { sessionId, projectId, message } = body;

    console.log("[OpenCode API] Request:", {
      projectId,
      command: body.command,
      hasSession: !!sessionId,
    });

    const project = await getProject(projectId);
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const client = getOpencodeClient(project.directoryPath);

    let effectiveSessionId = sessionId || project.opencodeSessionId;

    const createNewSession = async (): Promise<string> => {
      console.log("[OpenCode API] Creating new session...");
      const sessionResult = await client.session.create({
        directory: project.directoryPath,
        title: `Project ${projectId}`,
      });

      if ("error" in sessionResult && sessionResult.error) {
        throw new Error(`Failed to create session: ${sessionResult.error}`);
      }

      if (!("data" in sessionResult) || !sessionResult.data) {
        throw new Error("Session creation returned no data");
      }

      const newSessionId = sessionResult.data.id;
      console.log("[OpenCode API] Session created:", newSessionId);

      await updateProject(projectId, {
        opencodeSessionId: newSessionId,
      });

      return newSessionId;
    };

    if (!effectiveSessionId) {
      try {
        effectiveSessionId = await createNewSession();
      } catch (error) {
        console.error("[OpenCode API] Session creation failed:", error);
        return new Response(
          JSON.stringify({
            error:
              error instanceof Error
                ? error.message
                : "Failed to create session",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    let targetSessionId = effectiveSessionId;
    let aborted = false;
    let streamBuffer = getOrCreateStreamBuffer(targetSessionId);
    let seqCounter = 0;

    const encoder = new TextEncoder();

    const emitEvent = (
      event: StreamEvent,
      controller: ReadableStreamDefaultController,
    ) => {
      const stamped = { ...event, seq: seqCounter++ };
      if (!aborted) {
        controller.enqueue(encoder.encode(formatSseEvent(stamped)));
      }
      streamBuffer.events.push(stamped);
    };

    const stream = new ReadableStream({
      async start(controller) {
        request.signal.addEventListener("abort", async () => {
          console.log(
            "[OpenCode API] Client disconnected, streaming will continue in background",
          );
          aborted = true;
        });

        try {
          console.log("[OpenCode API] Subscribing to events...");

          const eventSubscription = await client.event.subscribe();

          const emitStatus = (sessionIdToEmit: string) => {
            const statusEvent: StreamSessionStatus = {
              type: "status",
              sessionStatus: { type: "busy" },
              sessionId: sessionIdToEmit,
            };
            emitEvent(statusEvent, controller);
          };

          emitStatus(targetSessionId);

          console.log("[OpenCode API] Sending async prompt...");

          const promptPromise = (async () => {
            try {
              if (body.command) {
                await client.session.command({
                  sessionID: targetSessionId,
                  directory: project.directoryPath,
                  agent: body.agent || "quillbot",
                  command: body.command,
                  arguments: message,
                });
              } else {
                await client.session.promptAsync({
                  sessionID: targetSessionId,
                  directory: project.directoryPath,
                  agent: body.agent || "quillbot",
                  parts: [
                    {
                      type: "text",
                      text: message,
                    },
                  ],
                });
              }
            } catch (error) {
              if (isSessionNotFoundError(error)) {
                console.warn(
                  "[OpenCode API] Session not found, recreating session...",
                );
                targetSessionId = await createNewSession();
                streamBuffer = getOrCreateStreamBuffer(targetSessionId);
                emitStatus(targetSessionId);

                if (body.command) {
                  await client.session.command({
                    sessionID: targetSessionId,
                    directory: project.directoryPath,
                    agent: body.agent || "quillbot",
                    command: body.command,
                    arguments: message,
                  });
                } else {
                  await client.session.promptAsync({
                    sessionID: targetSessionId,
                    directory: project.directoryPath,
                    agent: body.agent || "quillbot",
                    parts: [
                      {
                        type: "text",
                        text: message,
                      },
                    ],
                  });
                }
              } else {
                throw error;
              }
            }
          })().catch((error) => {
            if (aborted) {
              return;
            }
            console.error("[OpenCode API] Prompt async error:", error);
            const errorEvent: StreamError = {
              type: "error",
              error: error instanceof Error ? error.message : String(error),
              sessionId: targetSessionId,
            };
            emitEvent(errorEvent, controller);
            controller.close();
          });

          for await (const sdkEvent of eventSubscription.stream) {
            const streamEvent = transformSdkEvent(sdkEvent, targetSessionId);
            if (!streamEvent) continue;

            emitEvent(streamEvent, controller);

            if (streamEvent.type === "done" || streamEvent.type === "error") {
              streamBuffer.isComplete = true;
              break;
            }
          }

          await promptPromise;
          if (!aborted) {
            controller.close();
          }
        } catch (error) {
          console.error("[OpenCode API] Stream error:", error);
          const errorEvent: StreamError = {
            type: "error",
            error: error instanceof Error ? error.message : String(error),
            sessionId: targetSessionId,
          };
          emitEvent(errorEvent, controller);
          streamBuffer.isComplete = true;
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[OpenCode API] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to communicate with OpenCode server" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

function transformSdkEvent(
  sdkEvent: SdkEvent,
  targetSessionId: string,
): StreamEvent | null {
  switch (sdkEvent.type) {
    case "message.part.updated": {
      const { part, delta } = sdkEvent.properties;
      if (part.sessionID !== targetSessionId) {
        return null;
      }
      const event: StreamMessagePartUpdated = {
        type: "part",
        part,
        delta,
      };
      return event;
    }

    case "question.asked": {
      const questionRequest = sdkEvent.properties;
      if (questionRequest.sessionID !== targetSessionId) {
        return null;
      }
      const event: StreamQuestionAsked = {
        type: "question",
        data: {
          requestId: questionRequest.id,
          sessionId: questionRequest.sessionID,
          questions: questionRequest.questions.map((q) => ({
            question: q.question,
            header: q.header,
            options: q.options.map((opt) => ({
              label: opt.label,
              description: opt.description,
            })),
            multiple: q.multiple,
            custom: q.custom,
          })),
        },
      };
      return event;
    }

    case "session.status": {
      const { sessionID, status } = sdkEvent.properties;
      if (sessionID !== targetSessionId) {
        return null;
      }
      const event: StreamSessionStatus = {
        type: "status",
        sessionStatus: status,
        sessionId: sessionID,
      };
      return event;
    }

    case "session.error": {
      const { sessionID, error } = sdkEvent.properties;
      if (sessionID && sessionID !== targetSessionId) {
        return null;
      }
      const errorMessage = extractErrorMessage(error);
      const event: StreamError = {
        type: "error",
        error: errorMessage,
        sessionId: sessionID,
      };
      return event;
    }

    case "session.idle": {
      const { sessionID } = sdkEvent.properties;
      if (sessionID !== targetSessionId) {
        return null;
      }
      const event: StreamDone = {
        type: "done",
        sessionId: sessionID,
      };
      return event;
    }

    case "file.edited": {
      const { file } = sdkEvent.properties;
      const event: StreamFileEdited = {
        type: "file.edited",
        file,
      };
      return event;
    }

    case "tui.prompt.append": {
      const event: StreamActivity = {
        type: "activity",
        activityType: "tui.prompt.append",
        data: { text: sdkEvent.properties.text },
      };
      return event;
    }

    case "tui.command.execute": {
      const event: StreamActivity = {
        type: "activity",
        activityType: "tui.command.execute",
        data: { command: sdkEvent.properties.command },
      };
      return event;
    }

    case "tui.toast.show": {
      const { title, message, variant, duration } = sdkEvent.properties;
      const event: StreamActivity = {
        type: "activity",
        activityType: "tui.toast.show",
        data: { title, message, variant, duration },
      };
      return event;
    }

    case "command.executed": {
      const {
        name,
        arguments: args,
        sessionID,
        messageID,
      } = sdkEvent.properties;
      if (sessionID && sessionID !== targetSessionId) {
        return null;
      }
      const event: StreamActivity = {
        type: "activity",
        activityType: "command.executed",
        data: { name, arguments: args },
        sessionId: sessionID,
        messageId: messageID,
      };
      return event;
    }

    case "mcp.tools.changed": {
      const event: StreamActivity = {
        type: "activity",
        activityType: "mcp.tools.changed",
        data: { server: sdkEvent.properties.server },
      };
      return event;
    }

    case "mcp.browser.open.failed": {
      const { mcpName, url } = sdkEvent.properties;
      const event: StreamActivity = {
        type: "activity",
        activityType: "mcp.browser.open.failed",
        data: { mcpName, url },
      };
      return event;
    }

    case "permission.asked": {
      const permission = sdkEvent.properties;
      if (permission.sessionID !== targetSessionId) {
        return null;
      }
      const event: StreamActivity = {
        type: "activity",
        activityType: "permission.asked",
        data: permission,
        sessionId: permission.sessionID,
        messageId: permission.tool?.messageID,
      };
      return event;
    }

    case "permission.replied": {
      const { sessionID, requestID, reply } = sdkEvent.properties;
      if (sessionID !== targetSessionId) {
        return null;
      }
      const event: StreamActivity = {
        type: "activity",
        activityType: "permission.replied",
        data: { requestID, reply },
        sessionId: sessionID,
      };
      return event;
    }

    case "todo.updated": {
      const { sessionID, todos } = sdkEvent.properties;
      if (sessionID !== targetSessionId) {
        return null;
      }
      const event: StreamActivity = {
        type: "activity",
        activityType: "todo.updated",
        data: { todos },
        sessionId: sessionID,
      };
      return event;
    }

    default:
      return null;
  }
}
