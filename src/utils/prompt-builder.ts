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

export function buildPrompt(formData: StarterFormData): string {
  return formData.brief;
}
