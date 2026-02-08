export interface FileConversionResult {
  markdown: string;
  filename: string;
}

async function convertTxtToMarkdown(file: File): Promise<string> {
  const text = await file.text();
  return text;
}

async function convertHtmlToMarkdown(file: File): Promise<string> {
  const html = await file.text();

  let markdown = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n")
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n")
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n")
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")
    .replace(
      /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1[^>]*>(.*?)<\/a>/gi,
      "[$3]($2)",
    )
    .replace(
      /<img\s+(?:[^>]*?\s+)?src=(["'])(.*?)\1(?:[^>]*?\s+)?alt=(["'])(.*?)\3[^>]*>/gi,
      "![$4]($2)",
    )
    .replace(/<img\s+(?:[^>]*?\s+)?src=(["'])(.*?)\1[^>]*>/gi, "![]($2)");

  markdown = markdown.replace(
    /<ul[^>]*>([\s\S]*?)<\/ul>/gi,
    (_match, content) => {
      const items = content.match(/<li[^>]*>(.*?)<\/li>/gi);
      if (!items) return content;
      return (
        items
          .map(
            (item: string) => `- ${item.replace(/<\/?li[^>]*>/gi, "").trim()}`,
          )
          .join("\n") + "\n\n"
      );
    },
  );

  markdown = markdown.replace(
    /<ol[^>]*>([\s\S]*?)<\/ol>/gi,
    (_match, content) => {
      const items = content.match(/<li[^>]*>(.*?)<\/li>/gi);
      if (!items) return content;
      return (
        items
          .map(
            (item: string, index: number) =>
              `${index + 1}. ${item.replace(/<\/?li[^>]*>/gi, "").trim()}`,
          )
          .join("\n") + "\n\n"
      );
    },
  );

  markdown = markdown
    .replace(
      /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
      (_match, content) =>
        content
          .split("\n")
          .map((line: string) => `> ${line}`)
          .join("\n") + "\n\n",
    )
    .replace(
      /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
      "```\n$1\n```\n\n",
    )
    .replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return markdown;
}

async function convertDocxToMarkdown(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const mammoth = await import("mammoth/mammoth.browser");

  try {
    const result = await mammoth.convertToMarkdown(
      { arrayBuffer },
      {
        styleMap: [
          "p[style-name='Heading 1'] => # ",
          "p[style-name='Heading 2'] => ## ",
          "p[style-name='Heading 3'] => ### ",
          "p[style-name='Heading 4'] => #### ",
          "p[style-name='Heading 5'] => ##### ",
          "p[style-name='Heading 6'] => ###### ",
        ],
      },
    );

    let markdown = result.value;

    markdown = markdown.replace(/\\([*_\[\]()#+\-.!`|{}])/g, "$1");

    return markdown;
  } catch (error) {
    console.error("Error converting DOCX to markdown:", error);
    throw new Error("Failed to convert Word document to markdown");
  }
}

async function fetchUrlAsMarkdown(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    if (contentType.includes("text/html")) {
      const blob = new Blob([text], { type: "text/html" });
      const file = new File([blob], "fetched.html", { type: "text/html" });
      return await convertHtmlToMarkdown(file);
    } else if (
      contentType.includes("text/plain") ||
      contentType.includes("text/markdown")
    ) {
      return text;
    } else {
      const blob = new Blob([text], { type: "text/html" });
      const file = new File([blob], "fetched.html", { type: "text/html" });
      return await convertHtmlToMarkdown(file);
    }
  } catch (error) {
    console.error("Error fetching URL:", error);
    throw new Error("Failed to fetch content from URL");
  }
}

export async function convertFileToMarkdown(
  file: File,
): Promise<FileConversionResult> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  let markdown: string;

  switch (extension) {
    case "txt":
      markdown = await convertTxtToMarkdown(file);
      break;
    case "html":
    case "htm":
      markdown = await convertHtmlToMarkdown(file);
      break;
    case "docx":
      markdown = await convertDocxToMarkdown(file);
      break;
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }

  return {
    markdown,
    filename: file.name.replace(/\.[^.]+$/, ".md"),
  };
}

export async function convertUrlToMarkdown(
  url: string,
): Promise<FileConversionResult> {
  const markdown = await fetchUrlAsMarkdown(url);

  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  const filename = pathname.split("/").pop() || "fetched";
  const cleanFilename = filename.replace(/\.[^.]+$/, "") + ".md";

  return {
    markdown,
    filename: cleanFilename,
  };
}
