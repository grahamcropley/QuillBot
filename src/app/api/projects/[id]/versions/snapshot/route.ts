import { NextResponse } from "next/server";
import { getProject } from "@/lib/storage";
import { requireAuth } from "@/lib/auth";
import { createSnapshot, listVersions } from "@/lib/version-history";

async function getActorForSnapshot(): Promise<{
  id: string;
  name: string;
  email: string;
  kind: "user";
}> {
  try {
    const user = await requireAuth();
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      kind: "user",
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      return {
        id: "local-dev",
        name: "Local Developer",
        email: "dev@localhost",
        kind: "user",
      };
    }
    throw error;
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as {
      path?: string;
      content?: string;
      label?: string;
    } | null;

    const filePath = body?.path || "draft.md";
    const content = typeof body?.content === "string" ? body.content : null;
    if (content === null) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }

    let label = body?.label;

    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const actor = await getActorForSnapshot();

    if (!label) {
      const existing = await listVersions({
        projectDir: project.directoryPath,
        filePath,
      });
      const nextNumber = (existing?.versions.length ?? 0) + 1;
      label = `Version ${nextNumber}`;
    }

    const record = await createSnapshot({
      projectDir: project.directoryPath,
      filePath,
      content,
      label,
      createdBy: actor,
    });

    return NextResponse.json({ record });
  } catch (error) {
    console.error("Failed to create snapshot:", error);
    return NextResponse.json(
      { error: "Failed to create snapshot" },
      { status: 500 },
    );
  }
}
