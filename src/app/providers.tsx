"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { ErrorBoundary } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";

interface ProvidersProps {
  children: ReactNode;
}

function ThemeApplier({ children }: ProvidersProps) {
  const theme = useTheme();

  useEffect(() => {
    const html = document.documentElement;
    if (theme === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }, [theme]);

  return children;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary>
      <ThemeApplier>{children}</ThemeApplier>
    </ErrorBoundary>
  );
}
