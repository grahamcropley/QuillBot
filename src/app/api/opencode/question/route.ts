import { NextRequest } from "next/server";
import { getOpencodeClient } from "@/lib/opencode-client";
import { getProject } from "@/lib/storage";

interface QuestionReplyRequest {
  projectId: string;
  requestId: string;
  answers: string[][];
}

function isUnknownRequestError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const normalized = message.toLowerCase();
  return (
    normalized.includes("unknown request") ||
    normalized.includes("unknown question") ||
    normalized.includes("request not found")
  );
}

function extractReplyError(result: unknown): unknown | null {
  if (typeof result !== "object" || result === null) {
    return null;
  }

  if (!("error" in result)) {
    return null;
  }

  const { error } = result as { error?: unknown };
  return error ?? null;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const body: QuestionReplyRequest = await request.json();
    const { projectId, requestId, answers } = body;

    console.log("[Question API] Submitting answer:", {
      projectId,
      requestId,
      answersCount: answers.length,
      answers: JSON.stringify(answers),
      timestamp: new Date().toISOString(),
    });

    const project = await getProject(projectId);
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("[Question API] Project found:", {
      projectId,
      opencodeSessionId: project.opencodeSessionId ?? null,
      directoryPath: project.directoryPath,
    });

    const client = getOpencodeClient(project.directoryPath);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const sendEvent = (data: object) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
            );
          };

          sendEvent({ type: "status", content: "Submitting your answer..." });

          console.log("[Question API] Calling client.question.reply:", {
            requestID: requestId,
            directory: project.directoryPath,
            answersCount: answers.length,
            opencodeSessionId: project.opencodeSessionId ?? null,
          });

          const result = await client.question.reply({
            requestID: requestId,
            directory: project.directoryPath,
            answers,
          });

          console.log("[Question API] Reply result:", {
            requestId,
            result: JSON.stringify(result),
            elapsed: `${Date.now() - startTime}ms`,
          });

          const replyError = extractReplyError(result);
          if (replyError) {
            const errorStr =
              typeof replyError === "string"
                ? replyError
                : JSON.stringify(replyError);
            console.error("[Question API] Reply failed:", {
              requestId,
              error: errorStr,
              elapsed: `${Date.now() - startTime}ms`,
            });
            sendEvent({
              type: "error",
              error: `Failed to submit answer: ${errorStr}`,
              code: "QUESTION_REPLY_FAILED",
            });
            controller.close();
            return;
          }

          console.log("[Question API] Answer submitted successfully:", {
            requestId,
            elapsed: `${Date.now() - startTime}ms`,
          });
          sendEvent({ type: "status", content: "Processing your answer..." });

          await new Promise((resolve) => setTimeout(resolve, 500));

          sendEvent({
            type: "done",
            sessionId: project.opencodeSessionId,
            answerSubmitted: true,
          });
          controller.close();

          console.log("[Question API] Answer flow completed:", {
            requestId,
            elapsed: `${Date.now() - startTime}ms`,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const isUnknown = isUnknownRequestError(error);

          console.error("[Question API] Stream error:", {
            requestId,
            error: errorMessage,
            isUnknownRequest: isUnknown,
            elapsed: `${Date.now() - startTime}ms`,
            stack: error instanceof Error ? error.stack : undefined,
          });

          const userMessage = isUnknown
            ? "This question is no longer valid. The AI may have moved on or the session was reset. Please continue the conversation to proceed."
            : `Failed to submit answer: ${errorMessage}`;

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                error: userMessage,
                code: isUnknown ? "QUESTION_UNKNOWN" : "QUESTION_REPLY_FAILED",
              })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Question API] Unexpected error:", {
      error: error instanceof Error ? error.message : String(error),
      elapsed: `${Date.now() - startTime}ms`,
    });
    return new Response(JSON.stringify({ error: "Failed to submit answer" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
