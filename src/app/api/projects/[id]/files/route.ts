import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getProject } from "@/lib/storage";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const filePath = url.searchParams.get("path");

    const project = await getProject(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // If no path provided, list all files
    if (!filePath) {
      try {
        const files = await fs.readdir(project.directoryPath);
        const fileDetails = await Promise.all(
          files.map(async (file) => {
            const fullPath = path.join(project.directoryPath, file);
            const stats = await fs.stat(fullPath);
            return {
              name: file,
              path: file,
              isDirectory: stats.isDirectory(),
              size: stats.size,
              modifiedAt: stats.mtime,
            };
          }),
        );

        return NextResponse.json({ files: fileDetails });
      } catch (error) {
        console.error("Failed to list files:", error);
        return NextResponse.json(
          { error: "Failed to list files" },
          { status: 500 },
        );
      }
    }

    // If path provided, read specific file
    const fullPath = path.join(project.directoryPath, filePath);

    if (!fullPath.startsWith(project.directoryPath)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
    }

    try {
      const content = await fs.readFile(fullPath, "utf-8");
      return NextResponse.json({ content, path: filePath });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      throw error;
    }
  } catch (error) {
    console.error("Failed to read file:", error);
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
