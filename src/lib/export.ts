import type { Project } from "@/types";

export interface ExportOptions {
  includeMetadata?: boolean;
  includeFrontmatter?: boolean;
}

function generateFrontmatter(project: Project): string {
  return `---
title: ${project.name}
type: ${project.contentType}
created: ${project.createdAt.toISOString()}
updated: ${project.updatedAt.toISOString()}
---

`;
}

export function exportAsMarkdown(
  project: Project,
  options: ExportOptions = {},
): Blob {
  const { includeFrontmatter = false } = options;

  let content = project.documentContent;

  if (includeFrontmatter) {
    content = generateFrontmatter(project) + content;
  }

  return new Blob([content], { type: "text/markdown;charset=utf-8" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function exportAsWord(
  project: Project,
  options: ExportOptions = {},
): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } =
    await import("docx");

  const lines = project.documentContent.split("\n");
  const children: (typeof Paragraph.prototype)[] = [];

  for (const line of lines) {
    if (line.startsWith("# ")) {
      children.push(
        new Paragraph({
          text: line.slice(2),
          heading: HeadingLevel.HEADING_1,
        }),
      );
    } else if (line.startsWith("## ")) {
      children.push(
        new Paragraph({
          text: line.slice(3),
          heading: HeadingLevel.HEADING_2,
        }),
      );
    } else if (line.startsWith("### ")) {
      children.push(
        new Paragraph({
          text: line.slice(4),
          heading: HeadingLevel.HEADING_3,
        }),
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      children.push(
        new Paragraph({
          text: line.slice(2),
          bullet: { level: 0 },
        }),
      );
    } else if (line.trim() === "") {
      children.push(new Paragraph({ text: "" }));
    } else {
      const runs = parseInlineFormatting(line, TextRun);
      children.push(new Paragraph({ children: runs }));
    }
  }

  if (options.includeMetadata) {
    children.unshift(
      new Paragraph({
        children: [
          new TextRun({
            text: `Project: ${project.name}`,
            italics: true,
            size: 20,
          }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Type: ${project.contentType}`,
            italics: true,
            size: 20,
          }),
        ],
      }),
      new Paragraph({ text: "" }),
    );
  }

  const doc = new Document({
    sections: [{ children }],
  });

  return Packer.toBlob(doc);
}

function parseInlineFormatting(
  text: string,
  TextRun: typeof import("docx").TextRun,
): InstanceType<typeof import("docx").TextRun>[] {
  const runs: InstanceType<typeof import("docx").TextRun>[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(\[(.+?)\]\((.+?)\))|([^*[\]]+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      runs.push(new TextRun({ text: match[2], bold: true }));
    } else if (match[4]) {
      runs.push(new TextRun({ text: match[4], italics: true }));
    } else if (match[6]) {
      runs.push(
        new TextRun({
          text: match[6],
          style: "Hyperlink",
        }),
      );
    } else if (match[8]) {
      runs.push(new TextRun({ text: match[8] }));
    }
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text }));
  }

  return runs;
}
