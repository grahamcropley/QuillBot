import type { StarterFormData } from "@/types";

const CONTENT_TYPE_LABELS: Record<string, string> = {
  blog: "blog",
  "white-paper": "white-paper",
  "social-post": "social-post",
  email: "email",
  "case-study": "case-study",
  "landing-page": "landing-page",
};

function escapeShellArg(arg: string): string {
  return arg.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function buildCommandArgs(formData: StarterFormData): string {
  const contentTypeLabel =
    CONTENT_TYPE_LABELS[formData.contentType] || formData.contentType;

  const escapedBrief = escapeShellArg(formData.brief);

  return `${contentTypeLabel} ${formData.wordCount} "${escapedBrief}"`;
}

export function buildImportProcessingPrompt(originalFilename: string): string {
  return [
    "[IMPORT_PIPELINE_BOOTSTRAP]",
    "You are processing imported source material in this project.",
    "",
    "Files already present:",
    `- draft.md (contains imported content from: ${originalFilename})`,
    "",
    "Complete all steps in one pass without asking questions:",
    "1) Determine the most likely document title from draft.md. If no clear title exists, create a concise, high-quality title.",
    "2) Detect the best category from this enum only: blog, white-paper, social-post, email, case-study, landing-page.",
    "3) Determine targetWordCount from current draft length, rounded to nearest 100 (minimum 100).",
    "4) Create brief.md retrospectively based on draft.md only. Include key points covered, document structure/flow, and current CTA direction if present.",
    "5) Tidy draft.md formatting only. Keep meaning intact, remove conversational artifacts, and ensure correct markdown structure.",
    "",
    "Guardrails:",
    "- Do not invent product claims or facts.",
    "- Do not add unrelated sections.",
    "- Keep edits faithful to source intent.",
    "",
    "After updating files, respond with exactly one metadata tag and valid JSON:",
    '<import-metadata>{"title":"...","contentType":"blog","targetWordCount":900}</import-metadata>',
    "",
    "Return no additional text outside the metadata tag.",
  ].join("\n");
}

export function buildPrompt(formData: StarterFormData): string {
  return formData.brief;
}
