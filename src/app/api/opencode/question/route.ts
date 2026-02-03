import { NextRequest } from "next/server";
import { getOpencodeClient } from "@/lib/opencode-client";
import { getProject } from "@/lib/storage";

interface QuestionReplyRequest {
  projectId: string;
  requestId: string;
  answers: string[][];
}

export async function POST(request: NextRequest) {
  try {
    const body: QuestionReplyRequest = await request.json();
    const { projectId, requestId, answers } = body;

    console.log("[Question API] Submitting answer:", {
      projectId,
      requestId,
      answersCount: answers.length,
    });

    const project = await getProject(projectId);
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

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

          const result = await client.question.reply({
            requestID: requestId,
            directory: project.directoryPath,
            answers,
          });

          if ("error" in result && result.error) {
            console.error("[Question API] Reply failed:", result.error);
            sendEvent({ type: "error", error: "Failed to submit answer" });
            controller.close();
            return;
          }

          console.log("[Question API] Answer submitted successfully");
          sendEvent({ type: "status", content: "Processing your answer..." });

          await new Promise((resolve) => setTimeout(resolve, 500));

          sendEvent({
            type: "done",
            sessionId: project.opencodeSessionId,
            answerSubmitted: true,
          });
          controller.close();

          console.log("[Question API] Answer flow completed");
        } catch (error) {
          console.error("[Question API] Stream error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                error: error instanceof Error ? error.message : String(error),
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
    console.error("[Question API] Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Failed to submit answer" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
