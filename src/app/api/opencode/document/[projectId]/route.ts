import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getProject } from "@/lib/storage";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;

  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const filePath = path.join(project.directoryPath, "draft.md");
    const content = await fs.readFile(filePath, "utf-8");
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ content: "" });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;

  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const { content } = await request.json();
    const filePath = path.join(project.directoryPath, "draft.md");
    await fs.writeFile(filePath, content, "utf-8");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving document:", error);
    return NextResponse.json(
      { error: "Failed to save document" },
      { status: 500 },
    );
  }
}
