import { NextResponse } from "next/server";
import { getProject } from "@/lib/storage";
import { requireAuth } from "@/lib/auth";
import { branchToVersion } from "@/lib/version-history";

async function getActorForBranch(): Promise<{
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
      versionId?: string;
      restoreWorkingFile?: boolean;
    } | null;

    const filePath = body?.path || "draft.md";
    const versionId = body?.versionId;
    const restoreWorkingFile = Boolean(body?.restoreWorkingFile);

    if (!versionId) {
      return NextResponse.json({ error: "Missing versionId" }, { status: 400 });
    }

    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const actor = await getActorForBranch();

    const result = await branchToVersion({
      projectDir: project.directoryPath,
      filePath,
      versionId,
      restoreWorkingFile,
      actor,
    });

    return NextResponse.json({
      record: result.record,
      content: result.content,
    });
  } catch (error) {
    console.error("Failed to branch to version:", error);
    return NextResponse.json(
      { error: "Failed to branch to version" },
      { status: 500 },
    );
  }
}
