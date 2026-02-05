import { describe, it, expect } from "vitest";
import { markdownToHtml } from "../markdown-to-html";

describe("markdownToHtml", () => {
  it("converts unordered lists correctly without $2 placeholders", () => {
    const markdown = `- Item 1
- Item 2
- Item 3`;

    const html = markdownToHtml(markdown);

    expect(html).toContain("<ul>");
    expect(html).toContain("</ul>");
    expect(html).toContain("<li>Item 1</li>");
    expect(html).toContain("<li>Item 2</li>");
    expect(html).toContain("<li>Item 3</li>");
    expect(html).not.toContain("$2");
  });

  it("converts ordered lists correctly without $2 placeholders", () => {
    const markdown = `1. First item
2. Second item
3. Third item`;

    const html = markdownToHtml(markdown);

    expect(html).toContain("<ol>");
    expect(html).toContain("</ol>");
    expect(html).toContain("<li>First item</li>");
    expect(html).toContain("<li>Second item</li>");
    expect(html).toContain("<li>Third item</li>");
    expect(html).not.toContain("$2");
  });

  it("handles mixed content with unordered lists", () => {
    const markdown = `Some text here

- Microsoft 365 Message Center (tenant-specific announcements)
- Microsoft 365 Roadmap (feature status and timelines)
- Microsoft Teams Tech Community (deep dives and community feedback)

More text after`;

    const html = markdownToHtml(markdown);

    expect(html).toContain("<ul>");
    expect(html).toContain("</ul>");
    expect(html).toContain("Microsoft 365 Message Center");
    expect(html).toContain("Microsoft 365 Roadmap");
    expect(html).toContain("Microsoft Teams Tech Community");
    expect(html).not.toContain("$2");
  });

  it("does not nest unordered and ordered lists together", () => {
    const markdown = `- Item 1
- Item 2

1. First
2. Second`;

    const html = markdownToHtml(markdown);

    const ulCount = (html.match(/<ul>/g) || []).length;
    const olCount = (html.match(/<ol>/g) || []).length;

    expect(ulCount).toBe(1);
    expect(olCount).toBe(1);
    expect(html).not.toContain("<ul>\n<ol>");
    expect(html).not.toContain("<ol>\n<ul>");
  });

  it("preserves list item content with parentheses", () => {
    const markdown = `- Item with (parentheses)
- Another (item)`;

    const html = markdownToHtml(markdown);

    expect(html).toContain("Item with (parentheses)");
    expect(html).toContain("Another (item)");
    expect(html).not.toContain("$2");
  });
});
