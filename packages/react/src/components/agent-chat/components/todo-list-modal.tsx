"use client";

import { cn } from "../../../lib/cn";
import type { ReactNode } from "react";

interface TodoItem {
  content: string;
  status: string;
  priority: string;
  id: string;
}

interface TodoListModalProps {
  todos: TodoItem[];
  onClose: () => void;
}

function getStatusIcon(status: string | undefined): ReactNode {
  switch (status) {
    case "pending":
      return <span className="text-amber-500">◌</span>;
    case "in_progress":
      return <span className="inline-block animate-spin text-blue-500">⟳</span>;
    case "completed":
      return <span className="text-green-500">✓</span>;
    case "cancelled":
      return <span className="text-zinc-400">✕</span>;
    default:
      return <span className="text-zinc-400">◌</span>;
  }
}

function getStatusColor(status: string | undefined): string {
  switch (status) {
    case "completed":
      return "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800";
    case "in_progress":
      return "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800";
    case "pending":
      return "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800";
    case "cancelled":
      return "bg-zinc-50 border-zinc-200 dark:bg-zinc-900/20 dark:border-zinc-800";
    default:
      return "bg-zinc-50 border-zinc-200 dark:bg-zinc-900/20 dark:border-zinc-800";
  }
}

function PriorityIndicator({ priority }: { priority: string | undefined }) {
  const colorClass =
    {
      low: "text-green-500 dark:text-green-400",
      medium: "text-amber-500 dark:text-amber-400",
      high: "text-red-500 dark:text-red-400",
    }[priority as string] || "text-zinc-400 dark:text-zinc-500";

  const icon =
    {
      high: "▲",
      medium: "━",
      low: "▼",
    }[priority as string] || "━";

  return (
    <span
      className={cn("flex shrink-0 text-lg font-bold leading-none", colorClass)}
      title={`Priority: ${priority}`}
    >
      {icon}
    </span>
  );
}

function TodoItemRow({ todo }: { todo: TodoItem }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors",
        getStatusColor(todo.status),
      )}
    >
      <span className="shrink-0 text-base leading-none">
        {getStatusIcon(todo.status)}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "break-words",
            todo.status === "cancelled"
              ? "line-through text-zinc-500 dark:text-zinc-400"
              : "text-zinc-900 dark:text-zinc-100",
          )}
        >
          {todo.content}
        </p>
      </div>
      {todo.priority && <PriorityIndicator priority={todo.priority} />}
    </div>
  );
}

export function TodoListModal({ todos, onClose }: TodoListModalProps) {
  return (
    <div className="mx-4 flex max-h-[85%] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
      <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Todo List
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          aria-label="Close todo list"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <title>Close</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!todos || todos.length === 0 ? (
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            No todos
          </p>
        ) : (
          <div className="space-y-2">
            {todos.map((todo) => (
              <TodoItemRow key={todo.id} todo={todo} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
