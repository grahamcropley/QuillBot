"use client";

import { useState, useRef, useEffect } from "react";
import { clsx } from "clsx";

interface TooltipProps {
  content: string | React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX + rect.width / 2,
      });
    }
  }, [isVisible]);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className={clsx("inline-block", className)}
      >
        {children}
      </div>
      {isVisible && (
        <div
          className="fixed z-50 max-w-xs px-3 py-2 text-sm bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-lg -translate-x-1/2"
          style={{ top: position.top, left: position.left }}
        >
          {typeof content === "string" ? (
            <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {content}
            </div>
          ) : (
            content
          )}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-800 rotate-45" />
        </div>
      )}
    </>
  );
}
