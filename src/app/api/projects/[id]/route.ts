import { NextResponse } from "next/server";
import {
  getProject,
  updateProject,
  deleteProject,
  addMessageToProject,
  addMessageObjectToProject,
  updateMessageInProject,
} from "@/lib/storage";
import type { Message } from "@/types";
import { getOpencodeClient } from "@/lib/opencode-client";
import { getEasyAuthUser } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const project = await getProject(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Failed to get project:", error);
    return NextResponse.json(
      { error: "Failed to get project" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const user = await getEasyAuthUser();
    const { id } = await params;
    const body = await request.json();

    if (body.message) {
      const hasFullMessage =
        body.message.role === "question" ||
        body.message.role === "question-answered" ||
        body.message.parts ||
        body.message.activities ||
        body.message.questionData ||
        body.message.id ||
        body.message.timestamp;

      if (hasFullMessage) {
        const project = await addMessageObjectToProject(
          id,
          body.message,
          user ?? undefined,
        );
        if (!project)
          return NextResponse.json(
            { error: "Project not found" },
            { status: 404 },
          );

        return NextResponse.json({ project });
      }

      const { role, content } = body.message;
      const project = await addMessageToProject(
        id,
        role,
        content,
        user ?? undefined,
      );

      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 },
        );
      }
      return NextResponse.json({ project });
    }

    if (body.messageUpdate) {
      const { id: messageId, updates } = body.messageUpdate as {
        id: string;
        updates: Partial<Message>;
      };

      const project = await updateMessageInProject(
        id,
        messageId,
        updates,
        user ?? undefined,
      );

      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 },
        );
      }

      return NextResponse.json({ project });
    }

    const project = await updateProject(id, body, user ?? undefined);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Get project to find OpenCode session ID
    const project = await getProject(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Delete OpenCode session if it exists
    if (project.opencodeSessionId) {
      try {
        const client = getOpencodeClient();
        await client.session.delete({
          sessionID: project.opencodeSessionId,
        });
        console.log(
          `[Project Delete] OpenCode session deleted: ${project.opencodeSessionId}`,
        );
      } catch (sessionError) {
        // Log but don't fail if session deletion fails (session may not exist)
        console.warn(
          `[Project Delete] Failed to delete OpenCode session: ${sessionError}`,
        );
      }
    }

    // Delete project from storage
    const deleted = await deleteProject(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete project" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 },
    );
  }
}
