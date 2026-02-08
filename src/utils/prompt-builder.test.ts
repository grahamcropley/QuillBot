import { describe, expect, it } from "vitest";
import {
  buildCommandArgs,
  buildImportProcessingPrompt,
  buildPrompt,
} from "./prompt-builder";
import type { StarterFormData } from "@/types";

describe("prompt-builder", () => {
  it("buildPrompt returns brief verbatim", () => {
    const formData: StarterFormData = {
      contentType: "blog",
      wordCount: 900,
      styleHints: "friendly",
      brief: "Keep this exact brief",
    };

    expect(buildPrompt(formData)).toBe("Keep this exact brief");
  });

  it("buildCommandArgs escapes quotes in brief", () => {
    const formData: StarterFormData = {
      contentType: "white-paper",
      wordCount: 1200,
      styleHints: "",
      brief: 'Quote: "hello"',
    };

    expect(buildCommandArgs(formData)).toBe(
      'white-paper 1200 "Quote: \\"hello\\""',
    );
  });

  it("buildImportProcessingPrompt includes source filename and metadata tag", () => {
    const prompt = buildImportProcessingPrompt("source.docx");

    expect(prompt).toContain(
      "draft.md (contains imported content from: source.docx)",
    );
    expect(prompt).toContain("<import-metadata>");
    expect(prompt).toContain(
      "blog, white-paper, social-post, email, case-study, landing-page",
    );
  });
});
