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
  type ChangeSet,
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
  /**
   * When the parent updates `content` (e.g. from disk/OpenCode), this controls
   * how change highlights are attributed.
   */
  externalUpdateSource?: "ai" | "system";
}

export interface MarkdownEditorHandle {
  findAndHighlight: (excerpt: string) => boolean;
  getSelectionState: () => SelectionState;
  mark: () => void;
  clear: () => void;
  clearChangeHighlights: () => void;
  getChangeHighlights: () => {
    user: Array<[number, number]>;
    ai: Array<[number, number]>;
  };
  setChangeHighlights: (highlights: {
    user: Array<[number, number]>;
    ai: Array<[number, number]>;
  }) => void;
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

const externalUpdateSource = StateEffect.define<"ai" | "system">();
const externalAiHighlightRanges = StateEffect.define<Array<[number, number]>>();

const appendUserChangeRanges = StateEffect.define<Array<[number, number]>>();
const appendAiChangeRanges = StateEffect.define<Array<[number, number]>>();
const clearUserChangeHighlights = StateEffect.define<void>();
const clearAiChangeHighlights = StateEffect.define<void>();
const setUserChangeHighlights = StateEffect.define<DecorationSet>();
const setAiChangeHighlights = StateEffect.define<DecorationSet>();

const userChangeDecoration = Decoration.mark({ class: "cm-change-user" });
const aiChangeDecoration = Decoration.mark({ class: "cm-change-ai" });

function rangesFromChanges(changes: ChangeSet): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  changes.iterChanges(
    (
      _fromA: number,
      _toA: number,
      fromB: number,
      toB: number,
      _inserted: unknown,
    ) => {
      if (toB > fromB) {
        ranges.push([fromB, toB]);
      }
    },
  );
  return ranges;
}

function decorationSetFromRanges(
  ranges: Array<[number, number]>,
  deco: Decoration,
): DecorationSet {
  const marks = ranges
    .filter(([from, to]) => to > from)
    .map(([from, to]) => deco.range(from, to));
  marks.sort((a, b) => a.from - b.from);
  return RangeSet.of(marks, true);
}

function decorationSetToRanges(
  decorations: DecorationSet,
  docLength: number,
): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  decorations.between(0, docLength, (from, to) => {
    if (to > from) ranges.push([from, to]);
  });
  return ranges;
}

function computeMinimalChange(
  oldText: string,
  newText: string,
): {
  from: number;
  to: number;
  insert: string;
} {
  let start = 0;
  const oldLen = oldText.length;
  const newLen = newText.length;

  while (
    start < oldLen &&
    start < newLen &&
    oldText.charCodeAt(start) === newText.charCodeAt(start)
  ) {
    start += 1;
  }

  let endOld = oldLen;
  let endNew = newLen;

  while (
    endOld > start &&
    endNew > start &&
    oldText.charCodeAt(endOld - 1) === newText.charCodeAt(endNew - 1)
  ) {
    endOld -= 1;
    endNew -= 1;
  }

  return {
    from: start,
    to: endOld,
    insert: newText.slice(start, endNew),
  };
}

function buildLineStartOffsets(text: string): number[] {
  const lines = text.split("\n");
  const starts = new Array<number>(lines.length);
  let offset = 0;

  for (let i = 0; i < lines.length; i += 1) {
    starts[i] = offset;
    offset += lines[i].length;
    if (i < lines.length - 1) {
      offset += 1;
    }
  }

  return starts;
}

function buildLcsMatches(
  oldLines: string[],
  newLines: string[],
): Array<{ oldIndex: number; newIndex: number }> {
  const n = oldLines.length;
  const m = newLines.length;

  if (n === 0 || m === 0) {
    return [];
  }

  const maxCells = 80_000;
  if (n * m > maxCells) {
    return [];
  }

  const dp = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const matches: Array<{ oldIndex: number; newIndex: number }> = [];
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      matches.push({ oldIndex: i, newIndex: j });
      i += 1;
      j += 1;
      continue;
    }

    if (dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  return matches;
}

function appendLineRange(
  ranges: Array<[number, number]>,
  lineStarts: number[],
  lines: string[],
  lineIndex: number,
  docLength: number,
): void {
  const startOffset = lineStarts[lineIndex];
  if (typeof startOffset !== "number") return;

  const lineText = lines[lineIndex] ?? "";
  const endOffset = Math.min(docLength, startOffset + lineText.length);
  if (endOffset > startOffset) {
    ranges.push([startOffset, endOffset]);
  }
}

function appendUnmatchedNewLineRanges(
  ranges: Array<[number, number]>,
  oldSlice: string[],
  newSlice: string[],
  globalNewStart: number,
  globalNewLineStarts: number[],
  fullNewLines: string[],
  newTextLength: number,
): void {
  if (newSlice.length === 0) return;

  const localMatches = buildLcsMatches(oldSlice, newSlice);
  if (localMatches.length === 0) {
    for (let i = 0; i < newSlice.length; i += 1) {
      appendLineRange(
        ranges,
        globalNewLineStarts,
        fullNewLines,
        globalNewStart + i,
        newTextLength,
      );
    }
    return;
  }

  let prevNew = -1;

  const sentinelMatches = [
    ...localMatches,
    { oldIndex: oldSlice.length, newIndex: newSlice.length },
  ];

  for (const match of sentinelMatches) {
    const newStart = prevNew + 1;
    const newEnd = match.newIndex - 1;

    if (newStart <= newEnd) {
      for (let i = newStart; i <= newEnd; i += 1) {
        appendLineRange(
          ranges,
          globalNewLineStarts,
          fullNewLines,
          globalNewStart + i,
          newTextLength,
        );
      }
    }

    prevNew = match.newIndex;
  }
}

function normalizeRanges(
  ranges: Array<[number, number]>,
): Array<[number, number]> {
  if (ranges.length <= 1) return ranges;

  const sorted = ranges
    .filter(([from, to]) => to > from)
    .sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]));

  if (sorted.length <= 1) return sorted;

  const merged: Array<[number, number]> = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const [from, to] = sorted[i];
    const last = merged[merged.length - 1];
    if (from <= last[1]) {
      last[1] = Math.max(last[1], to);
    } else {
      merged.push([from, to]);
    }
  }

  return merged;
}

function computeAiHighlightRanges(
  oldText: string,
  newText: string,
): Array<[number, number]> {
  if (oldText === newText) {
    return [];
  }

  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const matches = buildLcsMatches(oldLines, newLines);

  if (matches.length === 0) {
    const minimal = computeMinimalChange(oldText, newText);
    const start = minimal.from;
    const end = minimal.from + minimal.insert.length;
    if (end > start) {
      return [[start, end]];
    }
    return [];
  }

  const newLineStarts = buildLineStartOffsets(newText);
  const ranges: Array<[number, number]> = [];
  let prevOld = -1;
  let prevNew = -1;

  const sentinelMatches = [
    ...matches,
    { oldIndex: oldLines.length, newIndex: newLines.length },
  ];

  for (const match of sentinelMatches) {
    const oldStart = prevOld + 1;
    const oldEnd = match.oldIndex - 1;
    const newStart = prevNew + 1;
    const newEnd = match.newIndex - 1;

    const oldChanged = oldStart <= oldEnd;
    const newChanged = newStart <= newEnd;

    if (newChanged) {
      if (oldChanged) {
        appendUnmatchedNewLineRanges(
          ranges,
          oldLines.slice(oldStart, oldEnd + 1),
          newLines.slice(newStart, newEnd + 1),
          newStart,
          newLineStarts,
          newLines,
          newText.length,
        );
      } else {
        for (let i = newStart; i <= newEnd; i += 1) {
          appendLineRange(ranges, newLineStarts, newLines, i, newText.length);
        }
      }
    }

    prevOld = match.oldIndex;
    prevNew = match.newIndex;
  }

  return normalizeRanges(ranges);
}

const userChangeHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(appendUserChangeRanges)) {
        decorations = decorations.update({
          add: effect.value.map(([from, to]) =>
            userChangeDecoration.range(from, to),
          ),
        });
      }
      if (effect.is(clearUserChangeHighlights)) {
        decorations = Decoration.none;
      }
      if (effect.is(setUserChangeHighlights)) {
        decorations = effect.value;
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const aiChangeHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(appendAiChangeRanges)) {
        decorations = decorations.update({
          add: effect.value.map(([from, to]) =>
            aiChangeDecoration.range(from, to),
          ),
        });
      }
      if (effect.is(clearAiChangeHighlights)) {
        decorations = Decoration.none;
      }
      if (effect.is(setAiChangeHighlights)) {
        decorations = effect.value;
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

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
  ".cm-change-user": {
    backgroundColor: "rgba(59, 130, 246, 0.18)",
  },
  ".cm-change-ai": {
    backgroundColor: "rgba(16, 185, 129, 0.18)",
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
    externalUpdateSource: externalUpdateSourceProp = "ai",
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
  const initialDocRef = useRef(content);
  const themeRef = useRef(theme);
  const disabledRef = useRef(disabled);

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

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

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
        let source: "ai" | "system" | null = null;
        let aiRangesOverride: Array<[number, number]> | null = null;
        for (const tr of update.transactions) {
          for (const eff of tr.effects) {
            if (eff.is(externalUpdateSource)) {
              source = eff.value;
            }
            if (eff.is(externalAiHighlightRanges)) {
              aiRangesOverride = eff.value;
            }
          }
        }

        // Only notify parent for user-originated edits. Programmatic updates
        // (disk/OpenCode sync) are already reflected via the `content` prop.
        if (source === null) {
          onChangeRef.current(update.state.doc.toString());
        }

        const ranges = rangesFromChanges(update.changes);
        if (source === "ai") {
          const aiRanges = aiRangesOverride ?? ranges;
          if (aiRanges.length > 0) {
            update.view.dispatch({
              effects: appendAiChangeRanges.of(aiRanges),
            });
          }
        } else if (ranges.length > 0) {
          if (source === null) {
            update.view.dispatch({
              effects: appendUserChangeRanges.of(ranges),
            });
          }
        }
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
      themeCompartment.of(themeRef.current === "dark" ? oneDark : lightTheme),
      readOnlyCompartment.of(EditorState.readOnly.of(disabledRef.current)),
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
      userChangeHighlightField,
      aiChangeHighlightField,
      EditorView.lineWrapping,
    ];

    const state = EditorState.create({
      doc: initialDocRef.current,
      extensions,
    });

    return new EditorView({
      state,
      parent: editorContainerRef.current,
    });
  }, [updateSelectionState]);

  useEffect(() => {
    if (editorRef.current) return;

    const view = createEditor();
    if (view) {
      editorRef.current = view;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initialize selection state on editor mount
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

    const decorations: Array<ReturnType<typeof markedDecoration.range>> = [];
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
      const minimal = computeMinimalChange(currentContent, content);
      const effects: Array<StateEffect<unknown>> = [
        externalUpdateSource.of(externalUpdateSourceProp),
      ];

      if (externalUpdateSourceProp === "ai") {
        const aiRanges = computeAiHighlightRanges(currentContent, content);
        if (aiRanges.length > 0) {
          effects.push(externalAiHighlightRanges.of(aiRanges));
        }
      }

      editor.dispatch({
        changes: {
          from: minimal.from,
          to: minimal.to,
          insert: minimal.insert,
        },
        effects,
      });
    }
  }, [content, externalUpdateSourceProp]);

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
      clearChangeHighlights: () => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.dispatch({
          effects: [
            clearUserChangeHighlights.of(),
            clearAiChangeHighlights.of(),
          ],
        });
      },
      getChangeHighlights: () => {
        const editor = editorRef.current;
        if (!editor) return { user: [], ai: [] };
        const docLength = editor.state.doc.length;
        const user = decorationSetToRanges(
          editor.state.field(userChangeHighlightField),
          docLength,
        );
        const ai = decorationSetToRanges(
          editor.state.field(aiChangeHighlightField),
          docLength,
        );
        return { user, ai };
      },
      setChangeHighlights: (highlights) => {
        const editor = editorRef.current;
        if (!editor) return;
        const user = decorationSetFromRanges(
          highlights.user,
          userChangeDecoration,
        );
        const ai = decorationSetFromRanges(highlights.ai, aiChangeDecoration);
        editor.dispatch({
          effects: [
            setUserChangeHighlights.of(user),
            setAiChangeHighlights.of(ai),
          ],
        });
      },
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
    [handleClear, handleMark, selectionState],
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
