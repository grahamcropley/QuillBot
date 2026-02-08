import { NextResponse } from "next/server";
import { getProject } from "@/lib/storage";
import { projectFileEventsManager } from "@/lib/project-file-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const project = await getProject(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        const writer = new WritableStream<Uint8Array>({
          write: async (chunk) => {
            controller.enqueue(chunk);
          },
          close: () => {
            controller.close();
          },
          abort: (reason) => {
            controller.error(reason);
          },
        }).getWriter();

        const unsubscribePromise = projectFileEventsManager.subscribe({
          projectId: id,
          directoryPath: project.directoryPath,
          writer,
        });

        const heartbeat = setInterval(() => {
          writer.write(encoder.encode(": heartbeat\n\n")).catch(() => {
            clearInterval(heartbeat);
          });
        }, 30000);

        request.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          void unsubscribePromise
            .then((unsubscribe) => unsubscribe())
            .finally(() => {
              writer.close().catch(() => undefined);
            });
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Content-Encoding": "none",
      },
    });
  } catch (error) {
    console.error("Failed to create project events stream:", error);
    return NextResponse.json(
      { error: "Failed to create events stream" },
      { status: 500 },
    );
  }
}
