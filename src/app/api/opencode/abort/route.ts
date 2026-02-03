import { NextRequest } from "next/server";
import { getOpencodeClient } from "@/lib/opencode-client";
import { getProject } from "@/lib/storage";

interface AbortRequest {
  sessionId: string;
  projectId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: AbortRequest = await request.json();
    const { sessionId, projectId } = body;

    console.log("[Abort API] Attempting to abort session:", {
      sessionId,
      projectId,
    });

    const project = await getProject(projectId);
    if (!project) {
      return new Response(
        JSON.stringify({ error: "Project not found", success: false }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const client = getOpencodeClient(project.directoryPath);

    const result = await client.session.abort({
      sessionID: sessionId,
      directory: project.directoryPath,
    });

    console.log("[Abort API] Abort result:", result);

    if ("error" in result && result.error) {
      console.error("[Abort API] Abort failed:", result.error);
      return new Response(
        JSON.stringify({
          error: result.error,
          success: false,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    console.log("[Abort API] Session aborted successfully:", sessionId);
    return new Response(
      JSON.stringify({
        success: true,
        message: "Session aborted successfully",
        sessionId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[Abort API] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Failed to abort session",
        success: false,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
