"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Markdown } from "tiptap-markdown";
import { useEffect, useCallback, useRef } from "react";
import { clsx } from "clsx";
import type { TextSelection } from "@/types";

interface WysiwygEditorProps {
  content: string;
  onContentChange?: (markdown: string) => void;
  onTextSelect?: (selection: Omit<TextSelection, "id">) => void;
  isEditable?: boolean;
  theme?: "light" | "dark";
}

export function WysiwygEditor({
  content,
  onContentChange,
  onTextSelect,
  isEditable = true,
  theme = "light",
}: WysiwygEditorProps) {
  const lastContentRef = useRef(content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: {
          HTMLAttributes: {
            class: "code-block",
          },
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 dark:text-blue-400 underline",
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: "border-collapse table-auto w-full",
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content,
    editable: isEditable,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onContentChange?.(html);
    },
    editorProps: {
      attributes: {
        class: clsx(
          "prose prose-sm max-w-none focus:outline-none min-h-[400px] px-6 py-4",
          theme === "dark" && "prose-invert",
        ),
      },
    },
  });

  useEffect(() => {
    if (editor && content !== lastContentRef.current) {
      editor.commands.setContent(content);
      lastContentRef.current = content;
    }
  }, [content, editor]);

  const handleMouseUp = useCallback(() => {
    if (!editor || !onTextSelect) return;

    const { from, to, empty } = editor.state.selection;
    if (empty) return;

    const selectedText = editor.state.doc.textBetween(from, to);
    if (!selectedText.trim()) return;

    const fullText = editor.getText();
    const textIndex = fullText.indexOf(selectedText);
    if (textIndex === -1) return;

    const textBefore = fullText.substring(0, textIndex);
    const linesBeforeSelection = textBefore.split("\n");
    const startLine = linesBeforeSelection.length;
    const selectedLines = selectedText.split("\n");
    const endLine = startLine + selectedLines.length - 1;
    const startOffset = textBefore.length;

    onTextSelect({
      text: selectedText,
      startLine,
      endLine,
      startOffset,
      endOffset: startOffset + selectedText.length,
    });
  }, [editor, onTextSelect]);

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600">
        Loading editor...
      </div>
    );
  }

  return (
    <div
      onMouseUp={handleMouseUp}
      className="h-full overflow-y-auto"
      data-preserve-selection="true"
    >
      <EditorContent editor={editor} />
      {!isEditable && (
        <div className="absolute inset-0 bg-transparent cursor-not-allowed" />
      )}
    </div>
  );
}
