import { NextResponse } from "next/server";
import { getAllProjects, createProject } from "@/lib/storage";
import type { StarterFormData } from "@/types";

export async function GET() {
  try {
    const projects = await getAllProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Failed to get projects:", error);
    return NextResponse.json(
      { error: "Failed to get projects" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, formData } = body as {
      name: string;
      formData: StarterFormData;
    };

    if (!name || !formData) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const project = await createProject(name, formData);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 },
    );
  }
}
