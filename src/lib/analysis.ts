import type { AnalysisMetrics } from '@/types';

export function analyzeContent(content: string, brief: string): AnalysisMetrics {
  if (!content.trim()) {
    return {
      readabilityScore: 0,
      wordCount: 0,
      sentenceCount: 0,
      avgWordsPerSentence: 0,
      briefAdherenceScore: 0,
    };
  }

  const words = content.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = sentences.length;

  const avgWordsPerSentence = sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0;

  const readabilityScore = calculateReadabilityScore(words, sentences);
  const briefAdherenceScore = calculateBriefAdherence(content, brief);

  return {
    readabilityScore,
    wordCount,
    sentenceCount,
    avgWordsPerSentence,
    briefAdherenceScore,
  };
}

function calculateReadabilityScore(words: string[], sentences: string[]): number {
  if (words.length === 0 || sentences.length === 0) return 0;

  const avgSentenceLength = words.length / sentences.length;
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;

  let score = 100;

  if (avgSentenceLength > 25) score -= (avgSentenceLength - 25) * 2;
  if (avgSentenceLength < 8) score -= (8 - avgSentenceLength) * 2;

  if (avgWordLength > 6) score -= (avgWordLength - 6) * 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateBriefAdherence(content: string, brief: string): number {
  if (!brief.trim()) return 100;

  const briefWords = brief.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
  const contentLower = content.toLowerCase();

  if (briefWords.length === 0) return 100;

  const matchedWords = briefWords.filter((word) => contentLower.includes(word));
  const adherenceRatio = matchedWords.length / briefWords.length;

  return Math.round(adherenceRatio * 100);
}
