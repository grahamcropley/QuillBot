"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import { Tooltip } from "@/components/ui/tooltip";
import {
  CheckCircle,
  XCircle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  X,
  ExternalLink,
} from "lucide-react";
import { clsx } from "clsx";

interface Citation {
  excerpt: string;
  context: string;
}

interface BriefPoint {
  point: string;
  status: "covered" | "missing";
  citations?: Citation[];
}

interface BriefAdherenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSendMessage: (message: string) => void;
  onHighlightText?: (excerpt: string) => void;
}

export function BriefAdherenceModal({
  isOpen,
  onClose,
  projectId,
  onSendMessage,
  onHighlightText,
}: BriefAdherenceModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [streamingResponse, setStreamingResponse] = useState<string>("");
  const [adherenceScore, setAdherenceScore] = useState<number | null>(null);
  const [points, setPoints] = useState<BriefPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showReviewBanner, setShowReviewBanner] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [streamingResponse]);

  useEffect(() => {
    if (isOpen && adherenceScore === null) {
      analyzeAdherence(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const analyzeAdherence = async (forceRefresh = false) => {
    setAdherenceScore(null);
    setPoints([]);
    setStreamingResponse("");
    setIsLoading(true);
    setError(null);
    setStatusMessage("Starting analysis...");
    setShowReviewBanner(false);

    try {
      console.log("[BriefAdherenceModal] Starting analysis for:", projectId);
      const response = await fetch("/api/opencode/analyze-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, forceRefresh }),
      });

      console.log("[BriefAdherenceModal] Response status:", response.status);

      if (!response.ok) {
        throw new Error("Failed to start analysis");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";
      let receivedStreamingContent = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const eventData = line.slice(6);
          const event = JSON.parse(eventData);

          if (event.type === "status") {
            setStatusMessage(event.status);
          } else if (event.type === "streaming") {
            fullResponse += event.chunk;
            setStreamingResponse(fullResponse);
            receivedStreamingContent = true;
          } else if (event.type === "done" && event.result) {
            setAdherenceScore(event.result.adherenceScore);
            setPoints(event.result.pointsCovered);

            if (!receivedStreamingContent && !forceRefresh) {
              setShowReviewBanner(true);
            }

            console.log("[BriefAdherenceModal] Analysis complete");
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }
    } catch (err) {
      console.error("[BriefAdherenceModal] Error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Analysis failed - check console for details",
      );
    } finally {
      setIsLoading(false);
      setStatusMessage(null);
    }
  };

  const handleCitationClick = (excerpt: string) => {
    if (onHighlightText) {
      onHighlightText(excerpt);
      onClose();
    }
  };

  const handleRectify = (point: string) => {
    const message = `The brief mentions "${point}" but the draft doesn't cover it sufficiently. Please find a suitable place in the document to weave this point into the existing structure and flow naturally.`;
    onSendMessage(message);
    onClose();
  };

  const handleAmplify = (point: string) => {
    const message = `The brief point "${point}" is mentioned in the draft, but please expand on it with more detail, examples, or emphasis to give it greater prominence.`;
    onSendMessage(message);
    onClose();
  };

  const handleToneDown = (point: string) => {
    const message = `The coverage of "${point}" in the draft is good, but please reduce its prominence or length to maintain better balance with other points.`;
    onSendMessage(message);
    onClose();
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-green-600 dark:text-green-400";
    if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 75) return "Good adherence";
    if (score >= 50) return "Average adherence";
    return "Poor adherence";
  };

  if (!isOpen) return null;

  const coveredPoints = points?.filter((p) => p.status === "covered") || [];
  const missingPoints = points?.filter((p) => p.status === "missing") || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Close modal"
      />

      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
              Brief Adherence Analysis
            </h2>
            {adherenceScore !== null && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {coveredPoints.length}/{points.length} points covered
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {isLoading && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {statusMessage || "Processing..."}
                </span>
              </div>

              {streamingResponse && (
                <div className="bg-gray-950 dark:bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                  <div className="px-4 py-2 bg-gray-900 dark:bg-gray-800 border-b border-gray-800">
                    <span className="text-xs font-mono text-gray-400">
                      AI Response Stream
                    </span>
                  </div>
                  <div
                    ref={consoleRef}
                    className="px-4 py-3 font-mono text-xs text-gray-300 max-h-96 overflow-y-auto scroll-smooth"
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {streamingResponse}
                    <span className="inline-block w-2 h-4 bg-green-500 animate-pulse ml-1" />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {adherenceScore !== null && (
            <>
              {showReviewBanner && (
                <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                        Draft may have changed since last analysis
                      </p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300">
                        These results were cached. Run a fresh analysis to see
                        updated adherence.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => analyzeAdherence(true)}
                      className="flex-shrink-0"
                    >
                      Review Now
                    </Button>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 text-center">
                <div
                  className={clsx(
                    "text-5xl font-bold mb-2",
                    getScoreColor(adherenceScore),
                  )}
                >
                  {adherenceScore}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {getScoreLabel(adherenceScore)}
                </div>
              </div>

              {missingPoints.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    Missing Points ({missingPoints.length})
                  </h3>
                  <div className="space-y-2">
                    {missingPoints.map((point, idx) => (
                      <div
                        key={idx}
                        className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 rounded-lg p-4"
                      >
                        <div className="flex items-start gap-3">
                          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                              {point.point}
                            </p>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleRectify(point.point)}
                              className="text-xs"
                            >
                              <Sparkles className="w-3 h-3 mr-1" />
                              Rectify
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {coveredPoints.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    Covered Points ({coveredPoints.length})
                  </h3>
                  <div className="space-y-2">
                    {coveredPoints.map((point, idx) => (
                      <div
                        key={idx}
                        className="border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 rounded-lg p-4"
                      >
                        <div className="flex items-start gap-3">
                          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                              {point.point}
                            </p>
                            {point.citations && point.citations.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {point.citations.map((citation, citIdx) => (
                                  <Tooltip
                                    key={citIdx}
                                    content={
                                      <div className="space-y-1">
                                        <div className="text-xs font-medium">
                                          Click to highlight in document
                                        </div>
                                        <div className="text-xs opacity-90">
                                          {citation.context}
                                        </div>
                                      </div>
                                    }
                                  >
                                    <button
                                      onClick={() =>
                                        handleCitationClick(citation.excerpt)
                                      }
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs rounded-full cursor-pointer hover:bg-green-200 dark:hover:bg-green-800 transition-colors group"
                                    >
                                      <span className="font-mono">
                                        {citIdx + 1}
                                      </span>
                                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                  </Tooltip>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleAmplify(point.point)}
                                className="text-xs"
                              >
                                <TrendingUp className="w-3 h-3 mr-1" />
                                Amplify
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleToneDown(point.point)}
                                className="text-xs"
                              >
                                <TrendingDown className="w-3 h-3 mr-1" />
                                Tone Down
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <Button variant="secondary" onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
