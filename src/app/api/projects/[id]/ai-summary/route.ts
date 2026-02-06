import { promises as fs } from "fs";
import path from "path";

import { NextResponse } from "next/server";
import type { Event as SdkEvent } from "@opencode-ai/sdk/v2/client";

import { getEasyAuthUser } from "@/lib/auth";
import { getOpencodeClient } from "@/lib/opencode-client";
import { getProject, updateProject } from "@/lib/storage";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const SUMMARY_PROMPT_HEADER = [
  "Create a compact project summary snippet for list and card previews.",
  "Return exactly 1-2 plain sentences (no bullet points).",
  "Focus on key outcomes and why the draft matters.",
  "Do not include instructions, preamble, headings, or labels.",
  "Do not repeat the input text and do not include markdown title lines.",
  "Do not include bullet points or numbering.",
  "Do not use any tools. Do not edit files. Do not ask questions.",
].join("\n");

function sanitizeSummary(raw: string): string {
  const cleanedLines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("You are "))
    .filter((line) => !line.startsWith("Do not "))
    .filter((line) => !line.startsWith("Return exactly"))
    .filter((line) => !line.startsWith("Focus on "))
    .filter((line) => !line.startsWith("Format strictly"))
    .filter((line) => !line.startsWith("Draft content:"))
    .filter((line) => !line.startsWith("- "))
    .filter((line) => !line.match(/^\d+[.)]\s+/))
    .filter((line) => !line.startsWith("#"));

  const compact = cleanedLines.join(" ").replace(/\s+/g, " ").trim();
  if (!compact) {
    return "The draft highlights the key outcomes and customer value for this project.";
  }

  const sentences = compact
    .split(/[.;!?]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15)
    .slice(0, 2)
    .map((s) => s.replace(/[.;!?]+$/, ""));

  if (sentences.length === 0) {
    return "The draft highlights the key outcomes and customer value for this project.";
  }

  return `${sentences.join(". ")}.`;
}

async function createEphemeralSession(directoryPath: string): Promise<string> {
  const client = getOpencodeClient(directoryPath);
  const sessionResult = await client.session.create({
    directory: directoryPath,
    title: "Project brief summary",
  });

  if ("error" in sessionResult && sessionResult.error) {
    throw new Error(
      `Failed to create OpenCode session: ${sessionResult.error}`,
    );
  }

  if (!("data" in sessionResult) || !sessionResult.data) {
    throw new Error("Session creation returned no data");
  }

  return sessionResult.data.id;
}

async function generateSummary(
  directoryPath: string,
  draftContent: string,
): Promise<string> {
  const client = getOpencodeClient(directoryPath);
  const sessionId = await createEphemeralSession(directoryPath);

  try {
    const eventSubscription = await client.event.subscribe();
    const prompt = `${SUMMARY_PROMPT_HEADER}\n\nDraft content:\n${draftContent}`;

    await client.session.promptAsync({
      sessionID: sessionId,
      directory: directoryPath,
      agent: "quillbot",
      parts: [{ type: "text", text: prompt }],
    });

    let summary = "";
    let userMessageId: string | undefined;

    for await (const sdkEvent of eventSubscription.stream as AsyncIterable<SdkEvent>) {
      if (sdkEvent.type === "message.part.updated") {
        const { part, delta } = sdkEvent.properties;
        if (part.sessionID !== sessionId) {
          continue;
        }

        if (!userMessageId && part.type === "text" && part.text === prompt) {
          userMessageId = part.messageID;
          continue;
        }

        if (part.messageID === userMessageId) {
          continue;
        }

        if (part.type === "text") {
          if (typeof delta === "string") {
            summary += delta;
          } else if (typeof part.text === "string") {
            summary = part.text;
          }
        }
      }

      if (sdkEvent.type === "session.error") {
        const { sessionID } = sdkEvent.properties;
        if (sessionID && sessionID !== sessionId) {
          continue;
        }
        throw new Error("OpenCode session failed while generating summary");
      }

      if (sdkEvent.type === "session.idle") {
        const { sessionID } = sdkEvent.properties;
        if (sessionID === sessionId) {
          break;
        }
      }
    }

    const normalized = sanitizeSummary(summary);
    if (!normalized) {
      throw new Error("No summary content received from OpenCode");
    }

    return normalized;
  } finally {
    await client.session.delete({
      sessionID: sessionId,
      directory: directoryPath,
    });
  }
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const user = await getEasyAuthUser();
    const { id } = await params;
    const project = await getProject(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const draftPath = path.join(project.directoryPath, "draft.md");
    let draftContent = "";

    try {
      draftContent = await fs.readFile(draftPath, "utf-8");
    } catch {
      return NextResponse.json(
        { error: "Could not read draft.md. Please generate content first." },
        { status: 400 },
      );
    }

    if (!draftContent.trim()) {
      return NextResponse.json(
        { error: "draft.md is empty. Please generate content first." },
        { status: 400 },
      );
    }

    const summary = await generateSummary(project.directoryPath, draftContent);
    const updatedProject = await updateProject(
      id,
      { brief: summary },
      user ?? undefined,
    );

    return NextResponse.json({
      summary,
      project: updatedProject,
    });
  } catch (error) {
    console.error("Failed to generate AI summary:", error);
    return NextResponse.json(
      { error: "Failed to generate AI summary" },
      { status: 500 },
    );
  }
}
