import { NextRequest } from "next/server";
import { getOpencodeClient } from "@/lib/opencode-client";
import { getProject, updateProject } from "@/lib/storage";
import { hashContent } from "@/lib/analysis";
import { promises as fs } from "fs";
import path from "path";
import type { Event as SdkEvent } from "@opencode-ai/sdk/v2/client";
import type { BriefPoint } from "@/types";

interface AnalysisResult {
  adherenceScore: number;
  pointsCovered: BriefPoint[];
}

interface StreamEvent {
  type: "status" | "streaming" | "done" | "error";
  status?: string;
  chunk?: string;
  result?: AnalysisResult;
  error?: string;
}

function formatSseEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: NextRequest) {
  const { projectId, forceRefresh } = await request.json();

  if (!projectId) {
    return new Response(
      formatSseEvent({ type: "error", error: "Project ID is required" }),
      {
        status: 400,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      },
    );
  }

  const project = await getProject(projectId);
  if (!project) {
    return new Response(
      formatSseEvent({ type: "error", error: "Project not found" }),
      {
        status: 404,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(formatSseEvent(event)));
      };

      try {
        sendEvent({ type: "status", status: "Reading files..." });

        const briefPath = path.join(project.directoryPath, "brief.md");
        const draftPath = path.join(project.directoryPath, "draft.md");

        let briefContent: string;
        let draftContent: string;

        try {
          briefContent = await fs.readFile(briefPath, "utf-8");
        } catch (fileError) {
          console.error("[Analyze Brief] Brief file read error:", fileError);
          sendEvent({
            type: "error",
            error: "Could not read brief.md file",
          });
          controller.close();
          return;
        }

        try {
          draftContent = await fs.readFile(draftPath, "utf-8");
        } catch (fileError) {
          console.error("[Analyze Brief] Draft file read error:", fileError);
          sendEvent({
            type: "error",
            error: "Could not read draft.md. Please generate content first.",
          });
          controller.close();
          return;
        }

        const draftHash = hashContent(draftContent);

        if (
          !forceRefresh &&
          project.briefAdherenceCache &&
          project.briefAdherenceCache.draftHash === draftHash
        ) {
          console.log("[Analyze Brief] Using cached result");
          sendEvent({
            type: "done",
            result: {
              adherenceScore: project.briefAdherenceCache.adherenceScore,
              pointsCovered: project.briefAdherenceCache.pointsCovered,
            },
          });
          controller.close();
          return;
        }

        console.log("[Analyze Brief] Files read successfully");
        sendEvent({ type: "status", status: "Creating analysis session..." });

        const client = getOpencodeClient(project.directoryPath);
        const sessionResult = await client.session.create({
          directory: project.directoryPath,
          title: "Brief Adherence Analysis",
        });

        if ("error" in sessionResult && sessionResult.error) {
          console.error(
            "[Analyze Brief] Session creation error:",
            sessionResult,
          );
          sendEvent({
            type: "error",
            error: "Failed to create OpenCode session",
          });
          controller.close();
          return;
        }

        const sessionId = sessionResult.data.id;
        console.log("[Analyze Brief] Session created:", sessionId);

        const analysisPrompt = `You have already been provided with the brief and draft content below. Analyze the adherence WITHOUT using any tools - just analyze the text directly.

**Brief:**
${briefContent}

**Draft Content:**
${draftContent}

**Your task:**
Extract key points from the brief and check if each is covered in the draft. For covered points, provide short excerpts as citations.

**CRITICAL: Your response must be ONLY the JSON object below with NO other text:**

{
  "adherenceScore": 85,
  "pointsCovered": [
    {
      "point": "Brief requirement description",
      "status": "covered",
      "citations": [
        {
          "excerpt": "short quote from draft",
          "context": "2-3 sentences showing context"
        }
      ]
    }
  ]
}`;

        sendEvent({ type: "status", status: "Sending to AI..." });

        await client.session.promptAsync({
          sessionID: sessionId,
          directory: project.directoryPath,
          model: {
            providerID: "github-copilot",
            modelID: "claude-haiku-4.5",
          },
          parts: [{ type: "text", text: analysisPrompt }],
        });

        console.log(
          "[Analyze Brief] Sent to claude-haiku-4.5 (fast analysis model), waiting for events...",
        );
        sendEvent({ type: "status", status: "AI is analyzing..." });

        const eventStream = await client.event.subscribe();

        let accumulatedText = "";
        let hasReceivedContent = false;
        let userMessageID: string | undefined;

        for await (const event of eventStream.stream) {
          const sdkEvent = event as SdkEvent;

          if (sdkEvent.type === "message.part.updated") {
            const { part } = sdkEvent.properties;
            if (part.sessionID !== sessionId) {
              continue;
            }

            if (
              !userMessageID &&
              part.type === "text" &&
              part.text === analysisPrompt
            ) {
              userMessageID = part.messageID;
              console.log(
                "[Analyze Brief] Detected user messageID:",
                userMessageID,
              );
              continue;
            }

            if (part.messageID === userMessageID) {
              console.log("[Analyze Brief] Skipping user message echo");
              continue;
            }

            console.log("[Analyze Brief] Part received:", {
              type: part.type,
              messageID: part.messageID,
            });

            if (part.type === "text" || part.type === "reasoning") {
              const newText = part.text || "";
              console.log("[Analyze Brief] Text part length:", newText.length);
              if (newText !== accumulatedText) {
                const chunk = newText.slice(accumulatedText.length);
                if (chunk) {
                  sendEvent({ type: "streaming", chunk });
                }
                accumulatedText = newText;
                hasReceivedContent = true;
              }
            }
          }

          if (sdkEvent.type === "session.idle") {
            const { sessionID } = sdkEvent.properties;
            if (sessionID !== sessionId) {
              continue;
            }
            console.log("[Analyze Brief] Session idle, processing response");
            break;
          }

          if (sdkEvent.type === "session.error") {
            const { sessionID } = sdkEvent.properties;
            if (sessionID && sessionID !== sessionId) {
              continue;
            }
            console.error("[Analyze Brief] Session error:", sdkEvent);
            sendEvent({
              type: "error",
              error: "OpenCode session encountered an error",
            });
            break;
          }
        }

        await client.session.delete({
          sessionID: sessionId,
          directory: project.directoryPath,
        });

        if (!hasReceivedContent) {
          console.error("[Analyze Brief] No content received from AI");
          sendEvent({
            type: "error",
            error: "No response received from AI",
          });
          controller.close();
          return;
        }

        sendEvent({ type: "status", status: "Parsing response..." });

        console.log(
          "[Analyze Brief] Raw response:",
          accumulatedText.substring(0, 200),
        );

        let jsonText = accumulatedText.replace(/```json\n?|\n?```/g, "").trim();

        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }

        let analysis: AnalysisResult;
        try {
          analysis = JSON.parse(jsonText);
        } catch (parseError) {
          console.error("[Analyze Brief] JSON parse error:", parseError);
          console.error("[Analyze Brief] Full response:", accumulatedText);
          sendEvent({
            type: "error",
            error: `Failed to parse AI response as JSON. Response started with: ${jsonText.substring(0, 100)}...`,
          });
          controller.close();
          return;
        }

        if (
          typeof analysis.adherenceScore !== "number" ||
          !Array.isArray(analysis.pointsCovered)
        ) {
          console.error(
            "[Analyze Brief] Invalid analysis structure:",
            analysis,
          );
          sendEvent({
            type: "error",
            error: "Invalid response structure from AI",
          });
          controller.close();
          return;
        }

        console.log(
          "[Analyze Brief] Analysis complete, score:",
          analysis.adherenceScore,
          "points:",
          analysis.pointsCovered.length,
        );

        await updateProject(projectId, {
          briefAdherenceCache: {
            draftHash,
            adherenceScore: analysis.adherenceScore,
            pointsCovered: analysis.pointsCovered,
            timestamp: new Date(),
          },
        });
        console.log("[Analyze Brief] Cache updated");

        sendEvent({ type: "done", result: analysis });
        controller.close();
      } catch (error) {
        console.error("[Analyze Brief] Error:", error);
        controller.enqueue(
          encoder.encode(
            formatSseEvent({
              type: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown error occurred",
            }),
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
}
