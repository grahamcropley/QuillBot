"use client";

import { clsx } from "clsx";
import type { ActivityToggleLevel } from "@/types/opencode-events";

interface ActivityToggleProps {
  level: ActivityToggleLevel;
  onChange: (level: ActivityToggleLevel) => void;
}

const TOGGLE_OPTIONS: { value: ActivityToggleLevel; label: string }[] = [
  { value: "messages-only", label: "Messages" },
  { value: "main-activities", label: "Activities" },
  { value: "all-activities", label: "All" },
];

export function ActivityToggle({ level, onChange }: ActivityToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
      {TOGGLE_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={clsx(
            "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150",
            level === option.value
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
