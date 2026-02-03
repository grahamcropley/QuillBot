import type { StarterFormData } from "@/types";

const CONTENT_TYPE_DESCRIPTIONS: Record<string, string> = {
  blog: "a blog post",
  "white-paper": "a white paper",
  "social-post": "a social media post",
  email: "an email",
};

export function buildPrompt(formData: StarterFormData): string {
  const sentences: string[] = [];

  // System instructions for brief.md management
  sentences.push("## Instructions");
  sentences.push("");
  sentences.push(
    "You are working on a content authoring project. The project directory contains a `brief.md` file with the initial requirements.",
  );
  sentences.push("");
  sentences.push(
    "**Important**: As our conversation progresses and the requirements become clearer or more refined, please UPDATE the `brief.md` file to reflect the current, refined understanding of what needs to be created. This ensures the brief stays accurate and useful as a reference throughout the project.",
  );
  sentences.push("");
  sentences.push("---");
  sentences.push("");

  // Content creation instructions
  const contentTypeDesc =
    CONTENT_TYPE_DESCRIPTIONS[formData.contentType] || formData.contentType;
  sentences.push(
    `Create a file called "draft.md" in the project directory containing ${contentTypeDesc} with approximately ${formData.wordCount} words.`,
  );

  if (formData.styleHints.trim()) {
    sentences.push(`Style guidance: ${formData.styleHints.trim()}`);
  }

  sentences.push("");
  sentences.push("Brief:");
  sentences.push(formData.brief);

  return sentences.join("\n");
}
