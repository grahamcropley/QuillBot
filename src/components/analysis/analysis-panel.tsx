"use client";

import { BarChart3, FileText, Type, Sparkles } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui";
import type { AnalysisMetrics } from "@/types";
import { clsx } from "clsx";

interface AnalysisPanelProps {
  metrics: AnalysisMetrics | null;
  targetWordCount?: number;
  isLoading?: boolean;
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  status?: "good" | "warning" | "poor";
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

function MetricCard({ icon, label, value, subtext, status }: MetricCardProps) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <div
        className={clsx(
          "p-2 rounded-lg",
          status
            ? statusColors[status]
            : "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400",
        )}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {value}
        </p>
        {subtext && (
          <p className="text-xs text-gray-400 dark:text-gray-500">{subtext}</p>
        )}
      </div>
    </div>
  );
}

export function AnalysisPanel({
  metrics,
  targetWordCount,
  isLoading,
}: AnalysisPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Content Analysis
          </h3>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
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
        <CardHeader>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Content Analysis
          </h3>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">
            Analysis will appear once content is generated
          </p>
        </CardContent>
      </Card>
    );
  }

  const wordCountProgress = targetWordCount
    ? Math.round((metrics.wordCount / targetWordCount) * 100)
    : null;

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Content Analysis
        </h3>
      </CardHeader>
      <CardContent className="space-y-3">
        <MetricCard
          icon={<Sparkles className="w-4 h-4" />}
          label="Readability Score"
          value={`${metrics.readabilityScore}/100`}
          subtext={
            metrics.readabilityScore >= 70
              ? "Easy to read"
              : "Consider simplifying"
          }
          status={getScoreStatus(metrics.readabilityScore)}
        />

        <MetricCard
          icon={<FileText className="w-4 h-4" />}
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
          icon={<Type className="w-4 h-4" />}
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
          icon={<Sparkles className="w-4 h-4" />}
          label="Brief Adherence"
          value={`${metrics.briefAdherenceScore}%`}
          status={getScoreStatus(metrics.briefAdherenceScore)}
        />
      </CardContent>
    </Card>
  );
}
