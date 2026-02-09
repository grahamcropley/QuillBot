"use client";

import { useState } from "react";
import { BarChart3, FileText, Type, Sparkles } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui";
import type { AnalysisMetrics } from "@/types";
import { clsx } from "clsx";
import { ReadabilityModal } from "./readability-modal";

interface AnalysisPanelProps {
  metrics: AnalysisMetrics | null;
  targetWordCount?: number;
  isLoading?: boolean;
  projectId?: string;
  onSendMessage?: (message: string) => void;
  onHighlightText?: (excerpt: string) => void;
  cachedBriefScore?: number;
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  status?: "good" | "warning" | "poor";
  onClick?: () => void;
  clickable?: boolean;
}

function getScoreStatus(score: number): "good" | "warning" | "poor" {
  if (score >= 70) return "good";
  if (score >= 50) return "warning";
  return "poor";
}

const statusColors = {
  good: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950",
  warning:
    "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950",
  poor: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950",
};

function MetricCard({
  icon,
  label,
  value,
  subtext,
  status,
  onClick,
  clickable,
}: MetricCardProps) {
  const Component = clickable ? "button" : "div";

  return (
    <Component
      onClick={onClick}
      className={clsx(
        "flex items-start gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg w-full text-left",
        clickable &&
          "hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors",
      )}
    >
      <div
        className={clsx(
          "p-1.5 rounded flex-shrink-0",
          status
            ? statusColors[status]
            : "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {label}
        </p>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate">
          {value}
        </p>
        {subtext && (
          <p className="text-xs text-gray-400 dark:text-gray-500 leading-tight truncate">
            {subtext}
          </p>
        )}
      </div>
    </Component>
  );
}

export function AnalysisPanel({
  metrics,
  targetWordCount,
  isLoading,
  projectId,
  onSendMessage,
  onHighlightText,
  cachedBriefScore,
}: AnalysisPanelProps) {
  const [isReadabilityModalOpen, setIsReadabilityModalOpen] = useState(false);
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Content Analysis
          </h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Content Analysis
          </h3>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 dark:text-gray-500 text-xs text-center py-4">
            Analysis will appear once content is generated
          </p>
        </CardContent>
      </Card>
    );
  }

  const wordCountProgress = targetWordCount
    ? Math.round((metrics.wordCount / targetWordCount) * 100)
    : null;

  const fleschInIdealRange =
    metrics.fleschReadingEase >= 50 && metrics.fleschReadingEase <= 70;
  const fleschAcceptable =
    metrics.fleschReadingEase >= 40 && metrics.fleschReadingEase <= 80;

  const overallStatus =
    metrics.gunningFogScore <= 12 && fleschInIdealRange
      ? "good"
      : metrics.gunningFogScore <= 16 && fleschAcceptable
        ? "warning"
        : "poor";

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Content Analysis
          </h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            <MetricCard
              icon={<Sparkles className="w-3.5 h-3.5" />}
              label="Readability"
              value={`Gunning Fog: ${metrics.gunningFogScore.toFixed(1)}`}
              subtext={
                overallStatus === "good"
                  ? "Excellent for business"
                  : overallStatus === "warning"
                    ? "Consider simplifying"
                    : "Too complex"
              }
              status={overallStatus}
              onClick={() => setIsReadabilityModalOpen(true)}
              clickable={true}
            />

            <MetricCard
              icon={<FileText className="w-3.5 h-3.5" />}
              label="Word Count"
              value={metrics.wordCount}
              subtext={
                wordCountProgress
                  ? `${wordCountProgress}% of target (${targetWordCount})`
                  : undefined
              }
              status={
                wordCountProgress
                  ? wordCountProgress >= 90 && wordCountProgress <= 110
                    ? "good"
                    : wordCountProgress >= 70
                      ? "warning"
                      : "poor"
                  : undefined
              }
            />

            <MetricCard
              icon={<Type className="w-3.5 h-3.5" />}
              label="Avg. Sentence Length"
              value={`${metrics.avgWordsPerSentence} words`}
              subtext={
                metrics.avgWordsPerSentence <= 20
                  ? "Good length"
                  : "Consider shorter sentences"
              }
              status={metrics.avgWordsPerSentence <= 20 ? "good" : "warning"}
            />

            <MetricCard
              icon={<Sparkles className="w-3.5 h-3.5" />}
              label="Brief Adherence"
              value={
                cachedBriefScore !== undefined
                  ? `${cachedBriefScore}%`
                  : `${metrics.briefAdherenceScore}%`
              }
              subtext={
                cachedBriefScore !== undefined
                  ? "From AI analysis"
                  : "Quick estimate"
              }
              status={getScoreStatus(
                cachedBriefScore ?? metrics.briefAdherenceScore,
              )}
              clickable={false}
            />
          </div>
        </CardContent>
      </Card>

      <ReadabilityModal
        isOpen={isReadabilityModalOpen}
        onClose={() => setIsReadabilityModalOpen(false)}
        gunningFogScore={metrics.gunningFogScore}
        fleschReadingEase={metrics.fleschReadingEase}
      />
    </>
  );
}
