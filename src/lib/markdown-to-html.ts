export function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Escape HTML special characters first
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  // Restore backticks for inline code (we escaped them, but need them for processing)
  html = html.replace(/&#96;/g, "`");

  // Headers: # Heading 1, ## Heading 2, etc.
  html = html.replace(/^### (.*?)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*?)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*?)$/gm, "<h1>$1</h1>");

  // Horizontal rules
  html = html.replace(/^(---|\*\*\*|___)$/gm, "<hr />");

  // Blockquotes
  html = html.replace(/^&gt; (.*?)$/gm, "<blockquote>$1</blockquote>");

  // Code blocks: triple backticks
  html = html.replace(/```(.*?)\n([\s\S]*?)```/gm, (_match, lang, code) => {
    const trimmedCode = code.trim();
    return `<pre><code${lang ? ` class="language-${lang.trim()}"` : ""}>${trimmedCode}</code></pre>`;
  });

  // Inline code: single backticks
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_
  html = html.replace(/\*([^\*]+)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");

  // Strikethrough: ~~text~~
  html = html.replace(/~~(.*?)~~/g, "<del>$1</del>");

  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Unordered lists: -, *, or + at start of line
  const ulRegex = /^(\s*)[-*+] (.*)$/gm;
  html = html.replace(ulRegex, (_match, indent) => {
    const level = indent.length / 2;
    return `<li${level > 0 ? ` style="margin-left: ${level * 20}px"` : ""}>$2</li>`;
  });

  // Wrap consecutive list items in <ul>
  html = html.replace(/(<li[^>]*>.*?<\/li>\s*)+/g, (match) => {
    return `<ul>\n${match}</ul>\n`;
  });

  // Ordered lists: number. at start of line
  const olRegex = /^(\s*)\d+\. (.*)$/gm;
  html = html.replace(olRegex, (_match, indent) => {
    const level = indent.length / 2;
    return `<li${level > 0 ? ` style="margin-left: ${level * 20}px"` : ""}>$2</li>`;
  });

  // Wrap consecutive ordered list items in <ol>
  html = html.replace(/(<li[^>]*>.*?<\/li>\s*)+/g, (match) => {
    return `<ol>\n${match}</ol>\n`;
  });

  // Paragraphs: double newline = paragraph break
  html = html
    .split("\n\n")
    .map((para) => {
      const trimmed = para.trim();
      if (
        trimmed.startsWith("<") ||
        trimmed === "" ||
        trimmed.startsWith("---")
      ) {
        return trimmed;
      }
      return `<p>${trimmed}</p>`;
    })
    .join("\n");

  // Line breaks: convert double spaces at end of line to <br>
  html = html.replace(/  \n/g, "<br />\n");

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, "");

  return html;
}
