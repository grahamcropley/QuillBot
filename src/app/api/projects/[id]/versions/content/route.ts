import { NextResponse } from "next/server";
import { getProject } from "@/lib/storage";
import { readVersionContent } from "@/lib/version-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const filePath = url.searchParams.get("path") || "draft.md";
    const versionId = url.searchParams.get("versionId");

    if (!versionId) {
      return NextResponse.json({ error: "Missing versionId" }, { status: 400 });
    }

    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const content = await readVersionContent({
      projectDir: project.directoryPath,
      filePath,
      versionId,
    });

    if (content === null) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Failed to read version content:", error);
    return NextResponse.json(
      { error: "Failed to read version content" },
      { status: 500 },
    );
  }
}
