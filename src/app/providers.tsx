"use client";

import type { ReactNode } from "react";
import { ErrorBoundary } from "@/components/ui";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
