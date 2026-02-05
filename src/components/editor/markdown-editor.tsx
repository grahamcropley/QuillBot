"use client";

import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
  Decoration,
  DecorationSet,
  showTooltip,
  Tooltip,
  tooltips,
} from "@codemirror/view";
import {
  EditorState,
  Compartment,
  StateField,
  StateEffect,
  RangeSet,
} from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
} from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { useProjectStore } from "@/stores/project-store";
import { Bookmark } from "lucide-react";
import { createRoot } from "react-dom/client";

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Strip markdown formatting from text for normalized comparison.
 * Used to match excerpts that may have different formatting than the source.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1") // Bold
    .replace(/\*(.*?)\*/g, "$1") // Italic
    .replace(/`(.*?)`/g, "$1") // Inline code
    .replace(/~~(.*?)~~/g, "$1") // Strikethrough
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Links
    .replace(/^#+\s+/gm, "") // Headers
    .replace(/^[-*+]\s+/gm, "") // List items
    .replace(/^\s*\d+\.\s+/gm, "") // Numbered lists
    .trim();
}

interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave?: () => void;
  disabled?: boolean;
  className?: string;
  theme?: "light" | "dark";
}

export interface MarkdownEditorHandle {
  findAndHighlight: (excerpt: string) => boolean;
}

const clearHighlight = StateEffect.define<void>();

const highlightMark = Decoration.mark({ class: "cm-highlight-temp" });

const highlightField = StateField.define<RangeSet<Decoration>>({
  create() {
    return RangeSet.empty;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(clearHighlight)) {
        decorations = RangeSet.empty;
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const setMarkedHighlights = StateEffect.define<DecorationSet>();

const markedDecoration = Decoration.mark({ class: "cm-highlight-marked" });

const markedHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setMarkedHighlights)) {
        decorations = effect.value;
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

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
  "&.cm-readonly": {
    opacity: "0.6",
  },
  ".cm-highlight-temp": {
    backgroundColor: "#fbbf24",
    animation: "fadeOut 2.5s ease-out forwards",
  },
  ".cm-highlight-marked": {
    backgroundColor: "#fbbf24",
    position: "relative",
  },
  "@keyframes fadeOut": {
    "0%": { backgroundColor: "#fbbf24" },
    "100%": { backgroundColor: "transparent" },
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

export const MarkdownEditor = forwardRef<
  MarkdownEditorHandle,
  MarkdownEditorProps
>(function MarkdownEditor(
  {
    content,
    onChange,
    onSave,
    disabled = false,
    className = "",
    theme = "light",
  },
  ref,
) {
  const { addMarkedSelection, markedSelections } = useProjectStore();
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

    const markTooltipExtension = StateField.define<Tooltip | null>({
      create: () => null,
      update(tooltip, tr) {
        if (!tr.selection && !tr.docChanged) return tooltip;
        const { from, to, empty } = tr.newSelection.main;
        if (empty) return null;

        return {
          pos: from,
          above: true,
          strictSide: true,
          create: (view) => {
            const dom = document.createElement("div");
            dom.className = "cm-selection-tooltip";
            dom.onmousedown = (e) => e.preventDefault();

            const root = createRoot(dom);

            const handleMark = () => {
              const text = view.state.doc.sliceString(from, to);
              const lineObj = view.state.doc.lineAt(from);
              const line = lineObj.number;
              const column = from - lineObj.from;

              addMarkedSelection({
                id: generateId(),
                text,
                line,
                column,
                length: text.length,
                source: "editor",
              });
            };

            root.render(
              <div
                onClick={handleMark}
                className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm px-2 py-1 z-50 pointer-events-auto cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Bookmark className="w-3 h-3 text-amber-500" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                  Mark
                </span>
              </div>,
            );

            return { dom, destroy: () => root.unmount() };
          },
        };
      },
      provide: (f) => showTooltip.from(f),
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
      highlightField,
      markedHighlightField,
      markTooltipExtension,
      EditorView.lineWrapping,
    ];

    const state = EditorState.create({
      doc: content,
      extensions,
    });

    return new EditorView({
      state,
      parent: containerRef.current,
    });
  }, [theme, disabled]);

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

  // Sync marked selections from store to editor decorations
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const decorations: any[] = [];
    const doc = editor.state.doc;

    for (const sel of markedSelections) {
      if (sel.line > doc.lines) continue;
      const lineObj = doc.line(sel.line);
      const from = lineObj.from + sel.column;
      const to = from + sel.length;

      // Basic validation to ensure we don't crash if doc changed significantly
      if (to <= doc.length) {
        decorations.push(markedDecoration.range(from, to));
      }
    }

    // Sort decorations by position (required by CodeMirror)
    decorations.sort((a, b) => a.from - b.from);

    editor.dispatch({
      effects: setMarkedHighlights.of(RangeSet.of(decorations, true)),
    });
  }, [markedSelections]);

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

  useImperativeHandle(
    ref,
    () => ({
      findAndHighlight: (excerpt: string): boolean => {
        const editor = editorRef.current;
        if (!editor) return false;

        const doc = editor.state.doc.toString();

        let index = doc.indexOf(excerpt);

        if (index === -1) {
          const normalizedDoc = stripMarkdown(doc);
          const normalizedExcerpt = stripMarkdown(excerpt);
          const normalizedIndex = normalizedDoc.indexOf(normalizedExcerpt);

          if (normalizedIndex === -1) return false;

          let charCount = 0;
          let docIndex = 0;

          for (let i = 0; i < doc.length && charCount < normalizedIndex; i++) {
            const char = doc[i];
            const isMarkdownSyntax =
              char === "*" ||
              char === "`" ||
              char === "~" ||
              char === "[" ||
              char === "]" ||
              char === "(" ||
              char === ")" ||
              char === "#" ||
              char === "-" ||
              char === "+";

            if (
              !isMarkdownSyntax ||
              stripMarkdown(doc.slice(0, i + 1)).length > charCount
            ) {
              charCount++;
            }
            docIndex = i;
          }

          index = docIndex;
        }

        const from = index;
        const to = index + excerpt.length;

        const decoration = highlightMark.range(from, to);
        const newDecorations = RangeSet.of([decoration], true);

        editor.dispatch({
          selection: { anchor: from, head: to },
          effects: StateEffect.reconfigure.of([
            highlightField.init(() => newDecorations),
          ]),
        });

        editor.dispatch({
          effects: [EditorView.scrollIntoView(from, { y: "center" })],
        });

        setTimeout(() => {
          editor.dispatch({ effects: clearHighlight.of() });
        }, 2500);

        return true;
      },
    }),
    [],
  );

  return (
    <div
      ref={containerRef}
      className={`h-full overflow-hidden border border-gray-200 dark:border-gray-800 rounded-lg ${className}`}
    />
  );
});
