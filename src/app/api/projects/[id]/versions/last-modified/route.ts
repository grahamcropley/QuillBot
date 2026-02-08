import { NextResponse } from "next/server";
import { getProject } from "@/lib/storage";
import { setLastModified, type VersionActor } from "@/lib/version-history";

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
      actor?: VersionActor;
      modifiedAt?: string;
    } | null;

    const filePath = body?.path || "draft.md";
    const actor = body?.actor;

    if (!actor) {
      return NextResponse.json({ error: "Missing actor" }, { status: 400 });
    }

    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await setLastModified({
      projectDir: project.directoryPath,
      filePath,
      actor,
      modifiedAt: body?.modifiedAt,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to set last modified:", error);
    return NextResponse.json(
      { error: "Failed to set last modified" },
      { status: 500 },
    );
  }
}
