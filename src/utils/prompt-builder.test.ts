import { describe, it, expect } from "vitest";
import { buildPrompt } from "./prompt-builder";
import type { StarterFormData } from "@/types";

describe("buildPrompt", () => {
  it("formats arguments for /write-content command with content type", () => {
    const formData: StarterFormData = {
      contentType: "blog",
      wordCount: 1000,
      styleHints: "Professional and engaging",
      brief: "Write about the benefits of remote work",
    };

    const result = buildPrompt(formData);

    expect(result).toContain("Content Type Required: blog");
  });

  it("includes desired word count", () => {
    const formData: StarterFormData = {
      contentType: "white-paper",
      wordCount: 2500,
      styleHints: "",
      brief: "Analyze cloud computing trends",
    };

    const result = buildPrompt(formData);

    expect(result).toContain("Desired Length: 2500");
  });

  it("includes style hints when provided", () => {
    const formData: StarterFormData = {
      contentType: "blog",
      wordCount: 500,
      styleHints: "Casual and humorous",
      brief: "Tips for productivity",
    };

    const result = buildPrompt(formData);

    expect(result).toContain("Additional Style Comments: Casual and humorous");
  });

  it("includes empty style hints line when not provided", () => {
    const formData: StarterFormData = {
      contentType: "blog",
      wordCount: 500,
      styleHints: "",
      brief: "Tips for productivity",
    };

    const result = buildPrompt(formData);

    expect(result).toContain("Additional Style Comments: ");
  });

  it("includes the brief with label", () => {
    const formData: StarterFormData = {
      contentType: "email",
      wordCount: 300,
      styleHints: "",
      brief: "Announce new product launch",
    };

    const result = buildPrompt(formData);

    expect(result).toContain("Content Brief: Announce new product launch");
  });

  it("formats all fields in correct order", () => {
    const formData: StarterFormData = {
      contentType: "social-post",
      wordCount: 100,
      styleHints: "Energetic",
      brief: "Promote webinar",
    };

    const result = buildPrompt(formData);

    const lines = result.split("\n");
    expect(lines[0]).toContain("Content Type Required:");
    expect(lines[1]).toContain("Desired Length:");
    expect(lines[2]).toContain("Additional Style Comments:");
    expect(lines[3]).toContain("Content Brief:");
  });

  it("handles white-paper content type", () => {
    const formData: StarterFormData = {
      contentType: "white-paper",
      wordCount: 3000,
      styleHints: "",
      brief: "Research paper",
    };

    const result = buildPrompt(formData);

    expect(result).toContain("Content Type Required: white-paper");
  });

  it("handles social-post content type", () => {
    const formData: StarterFormData = {
      contentType: "social-post",
      wordCount: 150,
      styleHints: "",
      brief: "Social media content",
    };

    const result = buildPrompt(formData);

    expect(result).toContain("Content Type Required: social-post");
  });
});
