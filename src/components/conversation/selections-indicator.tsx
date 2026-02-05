"use client";

import { X } from "lucide-react";
import type { MarkedSelection } from "@/types";

interface SelectionsIndicatorProps {
  selections: MarkedSelection[];
  onClear: () => void;
}

export function SelectionsIndicator({
  selections,
  onClear,
}: SelectionsIndicatorProps) {
  if (selections.length === 0) return null;

  return (
    <div className="mx-4 mb-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800 rounded-lg text-xs flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center gap-2">
        <span className="font-medium text-yellow-800 dark:text-yellow-200">
          {selections.length} selection{selections.length !== 1 ? "s" : ""}
        </span>
        <span className="text-yellow-600 dark:text-yellow-400 border-l border-yellow-200 dark:border-yellow-800 pl-2">
          Will be sent with next message
        </span>
      </div>
      <button
        onClick={onClear}
        className="p-1 hover:bg-yellow-100 dark:hover:bg-yellow-900 rounded-full transition-colors text-yellow-600 dark:text-yellow-400"
        title="Clear all selections"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
