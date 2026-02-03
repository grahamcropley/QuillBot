import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

/**
 * Hook to detect and manage system dark mode preference
 * Returns the effective theme: "light" or "dark"
 */
export function useTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Initialize on first mount - reading system preference is the primary side effect
    // setState calls here are appropriate for capturing the system preference
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setTheme(mediaQuery.matches ? "dark" : "light");

    // Listen for changes in system preference
    const handler = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handler);

    return () => {
      mediaQuery.removeEventListener("change", handler);
    };
  }, []);

  return theme;
}
