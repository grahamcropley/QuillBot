"use client";

import { useState, useCallback, useEffect, type RefObject } from "react";
import type { TextSelection } from "@/types";

interface UseTextSelectionReturn {
  /** Current text selection, or null if none */
  selection: TextSelection | null;
  /** Clear the current selection */
  clearSelection: () => void;
  /** Handler to attach to mouseup events */
  handleMouseUp: () => void;
}

export function useTextSelection(
  containerRef: RefObject<HTMLElement | null>,
  sourceContent: string,
): UseTextSelectionReturn {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  const handleMouseUp = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const windowSelection = window.getSelection();
    if (!windowSelection || windowSelection.isCollapsed) return;

    const selectedText = windowSelection.toString().trim();
    if (!selectedText) return;

    const range = windowSelection.getRangeAt(0);

    if (!container.contains(range.commonAncestorContainer)) return;

    const textIndex = sourceContent.indexOf(selectedText);
    if (textIndex === -1) {
      const partialText = selectedText.slice(0, 50);
      const partialIndex = sourceContent.indexOf(partialText);
      if (partialIndex === -1) return;
    }

    const textBefore = sourceContent.substring(
      0,
      sourceContent.indexOf(selectedText),
    );
    const linesBeforeSelection = textBefore.split("\n");
    const startLine = linesBeforeSelection.length;
    const selectedLines = selectedText.split("\n");
    const endLine = startLine + selectedLines.length - 1;
    const startOffset = textBefore.length;

    setSelection({
      text: selectedText,
      startLine,
      endLine,
      startOffset,
      endOffset: startOffset + selectedText.length,
    });
  }, [containerRef, sourceContent]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const container = containerRef.current;
      if (container && !container.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (target.closest("[data-preserve-selection]")) return;

        clearSelection();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [containerRef, clearSelection]);

  return {
    selection,
    clearSelection,
    handleMouseUp,
  };
}
