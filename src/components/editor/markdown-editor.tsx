"use client";

import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
  Decoration,
  DecorationSet,
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
import { Bookmark, X } from "lucide-react";

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
  onSelectionChange?: (state: SelectionState) => void;
}

export interface MarkdownEditorHandle {
  findAndHighlight: (excerpt: string) => boolean;
  getSelectionState: () => SelectionState;
  mark: () => void;
  clear: () => void;
}

interface SelectionState {
  hasSelection: boolean;
  selectionFrom: number;
  selectionTo: number;
  cursorPos: number;
  inMarkedSection: boolean;
  markedId: string | null;
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
    onSelectionChange,
  },
  ref,
) {
  const { addMarkedSelection, markedSelections, removeMarkedSelection } =
    useProjectStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const [selectionState, setSelectionState] = useState<SelectionState>({
    hasSelection: false,
    selectionFrom: 0,
    selectionTo: 0,
    cursorPos: 0,
    inMarkedSection: false,
    markedId: null,
  });

  // Keep refs in sync with latest callbacks
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  const updateSelectionState = useCallback((view: EditorView) => {
    const doc = view.state.doc;
    const { from: cursorFrom, to: cursorTo, empty } = view.state.selection.main;

    const newState: SelectionState = {
      hasSelection: !empty,
      selectionFrom: cursorFrom,
      selectionTo: cursorTo,
      cursorPos: cursorFrom,
      inMarkedSection: false,
      markedId: null,
    };

    // Check if cursor is in any marked section
    const selections = useProjectStore.getState().markedSelections;
    for (const sel of selections) {
      if (sel.line > doc.lines) continue;
      const lineObj = doc.line(sel.line);
      const from = lineObj.from + sel.column;
      const to = from + sel.length;

      if (cursorFrom <= to && cursorTo >= from) {
        newState.inMarkedSection = true;
        newState.markedId = sel.id;
        break;
      }
    }

    setSelectionState(newState);
    onSelectionChangeRef.current?.(newState);
  }, []);

  const createEditor = useCallback(() => {
    if (!editorContainerRef.current) return null;

    const handleUpdate = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
      // Update selection state on any selection/doc change
      updateSelectionState(update.view);
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
      EditorView.lineWrapping,
    ];

    const state = EditorState.create({
      doc: content,
      extensions,
    });

    return new EditorView({
      state,
      parent: editorContainerRef.current,
    });
  }, [theme, disabled, updateSelectionState]);

  useEffect(() => {
    if (editorRef.current) return;

    const view = createEditor();
    if (view) {
      editorRef.current = view;
      updateSelectionState(view);
    }

    return () => {
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, [createEditor, updateSelectionState]);

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

  const handleMark = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const state = editor.state.selection.main;
    if (state.empty) return;

    const text = editor.state.doc.sliceString(state.from, state.to);
    const lineObj = editor.state.doc.lineAt(state.from);
    const line = lineObj.number;
    const column = state.from - lineObj.from;

    addMarkedSelection({
      id: generateId(),
      text,
      line,
      column,
      length: text.length,
      source: "editor",
    });
  }, [addMarkedSelection]);

  const handleClear = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const doc = editor.state.doc;
    const { from: cursorFrom, to: cursorTo } = editor.state.selection.main;

    const selections = useProjectStore.getState().markedSelections;
    for (const sel of selections) {
      if (sel.line > doc.lines) continue;
      const lineObj = doc.line(sel.line);
      const from = lineObj.from + sel.column;
      const to = from + sel.length;

      if (cursorFrom <= to && cursorTo >= from) {
        removeMarkedSelection(sel.id);
        break;
      }
    }
  }, [removeMarkedSelection]);

  useImperativeHandle(
    ref,
    () => ({
      getSelectionState: () => selectionState,
      mark: handleMark,
      clear: handleClear,
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
    >
      <div ref={editorContainerRef} className="h-full" />
    </div>
  );
});
