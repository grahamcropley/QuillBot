"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
} from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
} from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";

interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave?: () => void;
  disabled?: boolean;
  className?: string;
  theme?: "light" | "dark";
}

const themeCompartment = new Compartment();
const readOnlyCompartment = new Compartment();

const baseTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  ".cm-content": {
    padding: "12px 0",
  },
  ".cm-line": {
    padding: "0 16px",
  },
  "&.cm-focused": {
    outline: "none",
  },
});

const lightTheme = EditorView.theme({
  "&": {
    backgroundColor: "#ffffff",
  },
  ".cm-gutters": {
    backgroundColor: "#f8f9fa",
    borderRight: "1px solid #e5e7eb",
    color: "#9ca3af",
  },
});

export function MarkdownEditor({
  content,
  onChange,
  onSave,
  disabled = false,
  className = "",
  theme = "light",
}: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);

  // Keep refs in sync with latest callbacks
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const createEditor = useCallback(() => {
    if (!containerRef.current) return null;

    const handleUpdate = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const saveKeymap = keymap.of([
      {
        key: "Mod-s",
        run: () => {
          onSaveRef.current?.();
          return true;
        },
      },
    ]);

    const extensions = [
      baseTheme,
      themeCompartment.of(theme === "dark" ? oneDark : lightTheme),
      readOnlyCompartment.of(EditorState.readOnly.of(disabled)),
      lineNumbers(),
      highlightActiveLine(),
      drawSelection(),
      bracketMatching(),
      history(),
      markdown(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      saveKeymap,
      handleUpdate,
    ];

    const state = EditorState.create({
      doc: content,
      extensions,
    });

    return new EditorView({
      state,
      parent: containerRef.current,
    });
  }, [content, theme, disabled]);

  useEffect(() => {
    if (editorRef.current) return;

    const view = createEditor();
    if (view) {
      editorRef.current = view;
    }

    return () => {
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, [createEditor]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const currentContent = editor.state.doc.toString();
    if (currentContent !== content) {
      editor.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: content,
        },
      });
    }
  }, [content]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.dispatch({
      effects: themeCompartment.reconfigure(
        theme === "dark" ? oneDark : lightTheme,
      ),
    });
  }, [theme]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.dispatch({
      effects: readOnlyCompartment.reconfigure(
        EditorState.readOnly.of(disabled),
      ),
    });
  }, [disabled]);

  return (
    <div
      ref={containerRef}
      className={`h-full overflow-hidden border border-gray-200 rounded-lg ${className}`}
    />
  );
}
