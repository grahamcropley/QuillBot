"use client";

import { useState, useCallback } from "react";
import type { TextSelection } from "@/types";

interface UsePersistentSelectionReturn {
  selections: TextSelection[];
  addSelection: (selection: Omit<TextSelection, "id">) => void;
  removeSelection: (id: string) => void;
  clearSelections: () => void;
  hasSelections: boolean;
}

export function usePersistentSelection(): UsePersistentSelectionReturn {
  const [selections, setSelections] = useState<TextSelection[]>([]);

  const addSelection = useCallback((selection: Omit<TextSelection, "id">) => {
    const id = `sel-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newSelection: TextSelection = { ...selection, id };
    setSelections((prev) => [...prev, newSelection]);
  }, []);

  const removeSelection = useCallback((id: string) => {
    setSelections((prev) => prev.filter((sel) => sel.id !== id));
  }, []);

  const clearSelections = useCallback(() => {
    setSelections([]);
  }, []);

  return {
    selections,
    addSelection,
    removeSelection,
    clearSelections,
    hasSelections: selections.length > 0,
  };
}
