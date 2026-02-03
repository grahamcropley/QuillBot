import { describe, it, expect } from "vitest";
import { buildPrompt } from "./prompt-builder";
import type { StarterFormData } from "@/types";

describe("buildPrompt", () => {
  it("instructs OpenCode to create a file called draft.md", () => {
    const formData: StarterFormData = {
      contentType: "blog",
      wordCount: 1000,
      styleHints: "Professional and engaging",
      brief: "Write about the benefits of remote work",
    };

    const result = buildPrompt(formData);

    expect(result).toContain('Create a file called "draft.md"');
    expect(result).toContain("in the project directory");
  });

  it("includes instructions about updating brief.md", () => {
    const formData: StarterFormData = {
      contentType: "blog",
      wordCount: 1000,
      styleHints: "",
      brief: "Test brief",
    };

    const result = buildPrompt(formData);

    expect(result).toContain("brief.md");
    expect(result).toContain("UPDATE");
    expect(result).toContain("refined");
  });

  it("includes content type and word count in file creation instruction", () => {
    const formData: StarterFormData = {
      contentType: "white-paper",
      wordCount: 2500,
      styleHints: "",
      brief: "Analyze cloud computing trends",
    };

    const result = buildPrompt(formData);

    expect(result).toContain("containing a white paper");
    expect(result).toContain("approximately 2500 words");
  });

  it("includes style hints when provided", () => {
    const formData: StarterFormData = {
      contentType: "blog",
      wordCount: 500,
      styleHints: "Casual and humorous",
      brief: "Tips for productivity",
    };

    const result = buildPrompt(formData);

    expect(result).toContain("Style guidance: Casual and humorous");
  });

  it("omits style hints when empty", () => {
    const formData: StarterFormData = {
      contentType: "blog",
      wordCount: 500,
      styleHints: "",
      brief: "Tips for productivity",
    };

    const result = buildPrompt(formData);

    expect(result).not.toContain("Style guidance:");
  });

  it("includes the brief with label", () => {
    const formData: StarterFormData = {
      contentType: "email",
      wordCount: 300,
      styleHints: "",
      brief: "Announce new product launch",
    };

    const result = buildPrompt(formData);

    expect(result).toContain("Brief:");
    expect(result).toContain("Announce new product launch");
  });

  it("structures prompt with system instructions first", () => {
    const formData: StarterFormData = {
      contentType: "social-post",
      wordCount: 100,
      styleHints: "Energetic",
      brief: "Promote webinar",
    };

    const result = buildPrompt(formData);

    const instructionsIndex = result.indexOf("## Instructions");
    const briefIndex = result.indexOf("Brief:");

    expect(instructionsIndex).toBeGreaterThan(-1);
    expect(briefIndex).toBeGreaterThan(instructionsIndex);
  });
});
