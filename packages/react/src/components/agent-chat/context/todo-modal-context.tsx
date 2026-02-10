"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface TodoItem {
  content: string;
  status: string;
  priority: string;
  id: string;
}

interface TodoModalState {
  isOpen: boolean;
  todos: TodoItem[];
}

interface TodoModalContextType {
  todoModal: TodoModalState;
  openTodoModal: (todos: TodoItem[]) => void;
  closeTodoModal: () => void;
}

const TodoModalContext = createContext<TodoModalContextType | undefined>(
  undefined,
);

export function TodoModalProvider({ children }: { children: ReactNode }) {
  const [todoModal, setTodoModal] = useState<TodoModalState>({
    isOpen: false,
    todos: [],
  });

  const openTodoModal = (todos: TodoItem[]) => {
    setTodoModal({ isOpen: true, todos });
  };

  const closeTodoModal = () => {
    setTodoModal({ isOpen: false, todos: [] });
  };

  return (
    <TodoModalContext.Provider value={{ todoModal, openTodoModal, closeTodoModal }}>
      {children}
    </TodoModalContext.Provider>
  );
}

export function useTodoModal() {
  const context = useContext(TodoModalContext);
  if (!context) {
    throw new Error("useTodoModal must be used within TodoModalProvider");
  }
  return context;
}
