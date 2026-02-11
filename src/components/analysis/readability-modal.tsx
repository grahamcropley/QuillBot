"use client";

import { X, BookOpen, Target, Sparkles } from "lucide-react";

interface ReadabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  gunningFogScore: number;
  fleschReadingEase: number;
}

function getGunningFogStatus(score: number): {
  label: string;
  color: string;
  description: string;
} {
  if (score <= 8) {
    return {
      label: "Excellent",
      color: "text-green-600 dark:text-green-400",
      description: "Very easy to read - perfect for business professionals",
    };
  }
  if (score <= 12) {
    return {
      label: "Good",
      color: "text-green-600 dark:text-green-400",
      description: "Easy to read - ideal for business content",
    };
  }
  if (score <= 16) {
    return {
      label: "Fair",
      color: "text-yellow-600 dark:text-yellow-400",
      description: "Moderately difficult - consider simplifying",
    };
  }
  return {
    label: "Difficult",
    color: "text-red-600 dark:text-red-400",
    description: "Complex content - strongly consider simplifying",
  };
}

function getFleschStatus(score: number): {
  label: string;
  color: string;
  description: string;
} {
  if (score >= 50 && score <= 70) {
    return {
      label: "Ideal",
      color: "text-green-600 dark:text-green-400",
      description: "Perfect for business professionals",
    };
  }
  if (score >= 40 && score < 50) {
    return {
      label: "Good",
      color: "text-green-600 dark:text-green-400",
      description: "Slightly formal but accessible",
    };
  }
  if (score > 70 && score <= 80) {
    return {
      label: "Good",
      color: "text-green-600 dark:text-green-400",
      description: "Very accessible",
    };
  }
  if (score > 80) {
    return {
      label: "Too Simple",
      color: "text-yellow-600 dark:text-yellow-400",
      description: "May lack professional tone",
    };
  }
  if (score >= 30 && score < 40) {
    return {
      label: "Complex",
      color: "text-yellow-600 dark:text-yellow-400",
      description: "Consider simplifying",
    };
  }
  return {
    label: "Too Complex",
    color: "text-red-600 dark:text-red-400",
    description: "Strongly consider simplifying",
  };
}

export function ReadabilityModal({
  isOpen,
  onClose,
  gunningFogScore,
  fleschReadingEase,
}: ReadabilityModalProps) {
  if (!isOpen) return null;

  const gunningStatus = getGunningFogStatus(gunningFogScore);
  const fleschStatus = getFleschStatus(fleschReadingEase);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
              Readability Analysis
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Overview */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              We use <strong>industry-standard readability formulas</strong>{" "}
              with adjustments for business content. Proper nouns and technical
              terms don&apos;t unfairly penalize your score.
            </p>
          </div>

          {/* Gunning Fog Index */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Gunning Fog Index
              </h3>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {gunningFogScore.toFixed(1)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Grade Level
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${gunningStatus.color}`}>
                    {gunningStatus.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {gunningStatus.description}
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>What it measures:</strong> Years of education needed
                  to understand the content on first reading.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Why we use it:</strong> Created specifically for
                  business literature by Robert Gunning (1952). Widely used in
                  marketing and content tools.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Our adjustment:</strong> Proper nouns (names, brands,
                  places) are excluded from complex word calculations, plus a
                  15% adjustment factor for technical business content.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Target for business:</strong> Below 12 (ideally 8-10)
                  for professional audiences.
                </p>
                <div className="bg-white dark:bg-gray-900 rounded p-3 mt-2">
                  <p className="text-xs font-mono text-gray-600 dark:text-gray-400">
                    Formula: 0.4 × (avg sentence length + % complex words) ×
                    0.85
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Flesch Reading Ease */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Flesch Reading Ease
              </h3>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {fleschReadingEase}/100
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Ease Score
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${fleschStatus.color}`}>
                    {fleschStatus.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {fleschStatus.description}
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>What it measures:</strong> How easy the text is to
                  read on a 0-100 scale (higher = easier).
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Why we use it:</strong> Most widely adopted formula -
                  used by Microsoft Word, Google Docs, and major content
                  platforms.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Our adjustment:</strong> +20 base boost plus
                  additional points based on proper noun density to account for
                  unavoidable technical terms.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Ideal range for business:</strong> 50-70 is perfect
                  for professional audiences. Below 40 is too complex, above 80
                  may lack professional tone.
                </p>
                <div className="bg-white dark:bg-gray-900 rounded p-3 mt-2">
                  <p className="text-xs font-mono text-gray-600 dark:text-gray-400">
                    Formula: 206.835 - (1.015 × ASL) - (84.6 × ASW) +
                    adjustments
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              💡 Tips for Improvement
            </h4>
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-disc list-inside">
              <li>Keep sentences under 20 words</li>
              <li>Use shorter, common words when possible</li>
              <li>Break up complex ideas into multiple sentences</li>
              <li>Replace jargon with plain language where appropriate</li>
              <li>Use active voice instead of passive voice</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
