"use client";

import { X } from "lucide-react";
import { clsx } from "clsx";
import type { TextSelection } from "@/types";

interface SelectionBadgeProps {
  selections: TextSelection[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function SelectionBadge({
  selections,
  onRemove,
  onClear,
}: SelectionBadgeProps) {
  if (selections.length === 0) return null;

  return (
    <div className="px-3 py-2 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-yellow-800 dark:text-yellow-200">
              Marked Sections ({selections.length})
            </span>
            <button
              onClick={onClear}
              className="text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 underline"
            >
              Clear All
            </button>
          </div>
          <div className="space-y-1">
            {selections.map((selection, idx) => (
              <div
                key={selection.id}
                className="flex items-start gap-2 text-xs"
              >
                <span className="text-yellow-700 dark:text-yellow-300 font-mono">
                  [{idx + 1}]
                </span>
                <span className="flex-1 text-yellow-800 dark:text-yellow-200 truncate">
                  Lines {selection.startLine}-{selection.endLine}:{" "}
                  {selection.text.slice(0, 60)}
                  {selection.text.length > 60 ? "..." : ""}
                </span>
                <button
                  onClick={() => onRemove(selection.id)}
                  className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300"
                  title="Remove this selection"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
