import rs from "text-readability";
import { createHash } from "crypto";
import type { AnalysisMetrics } from "@/types";

export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function analyzeContent(
  content: string,
  brief: string,
): AnalysisMetrics {
  if (!content.trim()) {
    return {
      gunningFogScore: 0,
      fleschReadingEase: 0,
      wordCount: 0,
      sentenceCount: 0,
      avgWordsPerSentence: 0,
      briefAdherenceScore: 0,
      complexWordPercentage: 0,
    };
  }

  const words = content.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = sentences.length;

  const avgWordsPerSentence =
    sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0;

  const gunningFogScore = calculateAdjustedGunningFog(content);
  const fleschReadingEase = calculateAdjustedFleschReadingEase(content);
  const complexWordPercentage = calculateComplexWordPercentage(content);
  const briefAdherenceScore = calculateBriefAdherence(content, brief);

  return {
    gunningFogScore,
    fleschReadingEase,
    wordCount,
    sentenceCount,
    avgWordsPerSentence,
    briefAdherenceScore,
    complexWordPercentage,
  };
}

function isProperNoun(word: string): boolean {
  if (word.length < 2) return false;

  if (word[0] !== word[0].toUpperCase()) return false;

  const commonCapitalizedWords = new Set([
    "I",
    "The",
    "A",
    "An",
    "And",
    "But",
    "Or",
    "For",
    "Nor",
    "So",
    "Yet",
    "At",
    "By",
    "In",
    "Of",
    "On",
    "To",
    "With",
    "As",
    "Is",
    "It",
    "He",
    "She",
    "We",
    "They",
  ]);

  return !commonCapitalizedWords.has(word);
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;

  const vowels = "aeiouy";
  let count = 0;
  let previousWasVowel = false;

  for (let i = 0; i < word.length; i++) {
    const isVowel = vowels.includes(word[i]);
    if (isVowel && !previousWasVowel) {
      count++;
    }
    previousWasVowel = isVowel;
  }

  if (word.endsWith("e")) {
    count--;
  }

  if (
    word.endsWith("le") &&
    word.length > 2 &&
    !"aeiouy".includes(word[word.length - 3])
  ) {
    count++;
  }

  return Math.max(1, count);
}

function calculateAdjustedGunningFog(content: string): number {
  if (!content.trim()) return 0;

  try {
    const allWords = content.match(/[\w='']+/g) || [];
    if (allWords.length === 0) return 0;

    const sentences = content
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);
    if (sentences.length === 0) return 0;

    const avgSentenceLength = allWords.length / sentences.length;

    let complexWordCount = 0;
    for (const word of allWords) {
      const syllableCount = countSyllables(word);
      if (syllableCount >= 3 && !isProperNoun(word)) {
        complexWordCount++;
      }
    }

    const complexWordPercentage = (complexWordCount / allWords.length) * 100;

    const rawScore = 0.4 * (avgSentenceLength + complexWordPercentage);

    const adjustmentFactor = 0.85;
    const adjustedScore = rawScore * adjustmentFactor;

    return Math.max(0, Math.round(adjustedScore * 10) / 10);
  } catch {
    return 0;
  }
}

function calculateAdjustedFleschReadingEase(content: string): number {
  if (!content.trim()) return 0;

  try {
    const rawScore = rs.fleschReadingEase(content);

    const allWords = content.match(/[\w='']+/g) || [];
    if (allWords.length === 0) return Math.max(0, Math.round(rawScore));

    const properNounCount = allWords.filter((w) => isProperNoun(w)).length;
    const properNounRatio = properNounCount / allWords.length;

    const baseBoost = 20;
    const properNounBoost = properNounRatio * 30;

    const adjustedScore = Math.min(100, rawScore + baseBoost + properNounBoost);

    return Math.max(0, Math.round(adjustedScore));
  } catch {
    return 0;
  }
}

function calculateComplexWordPercentage(content: string): number {
  if (!content.trim()) return 0;
  try {
    const words = content.match(/[\w='']+/g) || [];
    if (words.length === 0) return 0;

    const difficultWords = rs.difficultWords(content);
    return Math.round((difficultWords / words.length) * 100);
  } catch {
    return 0;
  }
}

function calculateBriefAdherence(content: string, brief: string): number {
  if (!brief.trim()) return 100;

  const briefWords = brief
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4);
  const contentLower = content.toLowerCase();

  if (briefWords.length === 0) return 100;

  const matchedWords = briefWords.filter((word) => contentLower.includes(word));
  const adherenceRatio = matchedWords.length / briefWords.length;

  return Math.round(adherenceRatio * 100);
}
