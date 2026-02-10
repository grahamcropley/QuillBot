import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "../../../lib/cn";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        "prose prose-sm prose-zinc dark:prose-invert max-w-none break-words",
        "prose-p:my-1 prose-p:leading-relaxed",
        "prose-headings:my-2 prose-headings:font-semibold",
        "prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5",
        "prose-blockquote:my-2",
        "prose-hr:my-3",
        "prose-pre:my-2 prose-pre:rounded-lg prose-pre:text-xs",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-code:rounded prose-code:bg-zinc-200/60 prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:font-normal",
        "dark:prose-code:bg-zinc-700/60",
        "prose-a:text-blue-600 prose-a:underline-offset-2 dark:prose-a:text-blue-400",
        "prose-table:my-2 prose-th:px-3 prose-th:py-1.5 prose-td:px-3 prose-td:py-1.5",
        "prose-img:my-2 prose-img:rounded-lg",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: ({ alt, src, ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              {...props}
              src={src}
              alt={alt ?? ""}
              loading="lazy"
              className="my-2 max-w-full rounded-lg"
            />
          ),
          pre: ({ children, ...props }) => (
            <pre
              {...props}
              className={cn(
                "not-prose overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs dark:bg-zinc-950",
              )}
            >
              {children}
            </pre>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
