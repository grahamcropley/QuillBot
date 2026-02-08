import { NextResponse } from "next/server";
import { getProject } from "@/lib/storage";
import {
  ensureInitialVersion,
  readVersionContent,
  type VersionActor,
} from "@/lib/version-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function getDefaultInitialActor(): VersionActor {
  return {
    id: "opencode",
    name: "OpenCode",
    kind: "ai",
  };
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const filePath = url.searchParams.get("path") || "draft.md";

    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const record = await ensureInitialVersion({
      projectDir: project.directoryPath,
      filePath,
      createdBy: getDefaultInitialActor(),
      label: "Version 1",
    });

    const baselineContent = record.latestVersionId
      ? await readVersionContent({
          projectDir: project.directoryPath,
          filePath,
          versionId: record.latestVersionId,
        })
      : null;

    return NextResponse.json({
      record,
      baselineContent,
    });
  } catch (error) {
    console.error("Failed to get versions:", error);
    return NextResponse.json(
      { error: "Failed to get versions" },
      { status: 500 },
    );
  }
}
