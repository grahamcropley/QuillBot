"use client";

import { type ReactNode } from "react";
import { clsx } from "clsx";

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  isSelected?: boolean;
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className, onClick, isSelected }: CardProps) {
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={clsx(
        "bg-white dark:bg-gray-900 rounded-xl border shadow-sm",
        isClickable && "cursor-pointer hover:shadow-md transition-shadow",
        isSelected
          ? "border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-900"
          : "border-gray-200 dark:border-gray-800",
        className,
      )}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable ? (e) => e.key === "Enter" && onClick() : undefined
      }
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div
      className={clsx(
        "px-6 py-4 border-b border-gray-100 dark:border-gray-800",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={clsx("px-6 py-4", className)}>{children}</div>;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div
      className={clsx(
        "px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 rounded-b-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
