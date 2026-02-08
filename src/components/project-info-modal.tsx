"use client";

import { useEffect, useMemo, useState } from "react";

import { Button, Input, Select, Textarea } from "@/components/ui";
import type { ContentType } from "@/types";

interface ProjectInfoFormValues {
  name: string;
  contentType: ContentType;
  wordCount: number;
  styleHints: string;
  brief: string;
}

interface ProjectInfoModalProps {
  isOpen: boolean;
  initialValues: ProjectInfoFormValues;
  isSaving?: boolean;
  isGeneratingSummary?: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSave: (values: ProjectInfoFormValues) => Promise<void>;
  onGenerateSummary: () => Promise<string>;
}

const CONTENT_TYPE_OPTIONS: { value: ContentType; label: string }[] = [
  { value: "blog", label: "Blog Post" },
  { value: "white-paper", label: "White Paper" },
  { value: "social-post", label: "Social Media Post" },
  { value: "email", label: "Email" },
  { value: "case-study", label: "Case Study" },
  { value: "landing-page", label: "Landing Page" },
];

const WORD_COUNT_OPTIONS = [
  { value: "300", label: "~300 words (Short)" },
  { value: "500", label: "~500 words (Medium)" },
  { value: "1000", label: "~1000 words (Long)" },
  { value: "1500", label: "~1500 words (In-Depth)" },
  { value: "2000", label: "~2000 words (Extended)" },
  { value: "3000", label: "~3000 words (Long-Form)" },
];

export function ProjectInfoModal({
  isOpen,
  initialValues,
  isSaving = false,
  isGeneratingSummary = false,
  errorMessage,
  onClose,
  onSave,
  onGenerateSummary,
}: ProjectInfoModalProps) {
  const [name, setName] = useState(initialValues.name);
  const [contentType, setContentType] = useState<ContentType>(
    initialValues.contentType,
  );
  const [wordCount, setWordCount] = useState(initialValues.wordCount);
  const [styleHints, setStyleHints] = useState(initialValues.styleHints);
  const [brief, setBrief] = useState(initialValues.brief);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setName(initialValues.name);
    setContentType(initialValues.contentType);
    setWordCount(initialValues.wordCount);
    setStyleHints(initialValues.styleHints);
    setBrief(initialValues.brief);
    setErrors({});
  }, [
    isOpen,
    initialValues.name,
    initialValues.contentType,
    initialValues.wordCount,
    initialValues.styleHints,
    initialValues.brief,
  ]);

  const isDirty = useMemo(
    () =>
      name.trim() !== initialValues.name ||
      contentType !== initialValues.contentType ||
      wordCount !== initialValues.wordCount ||
      styleHints.trim() !== initialValues.styleHints ||
      brief.trim() !== initialValues.brief,
    [brief, contentType, initialValues, name, styleHints, wordCount],
  );

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const nextErrors: Record<string, string> = {};

    if (!name.trim()) {
      nextErrors.name = "Project name is required";
    }

    if (wordCount < 100 || wordCount > 10000) {
      nextErrors.wordCount = "Word count must be between 100 and 10000";
    }

    if (!brief.trim()) {
      nextErrors.brief = "Please provide a content brief";
    } else if (brief.trim().length < 20) {
      nextErrors.brief = "Brief should be at least 20 characters";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    await onSave({
      name: name.trim(),
      contentType,
      wordCount,
      styleHints: styleHints.trim(),
      brief: brief.trim(),
    });
  };

  const handleGenerateSummary = async () => {
    const summary = await onGenerateSummary();
    if (summary.trim()) {
      setBrief(summary.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!isSaving) onClose();
        }}
        aria-label="Close project details modal"
      />

      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-2xl mx-4 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Edit Project Details
          </h2>
        </div>

        {errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {errorMessage}
          </div>
        ) : null}

        <Input
          label="Project Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          disabled={isSaving}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Content Type"
            options={CONTENT_TYPE_OPTIONS}
            value={contentType}
            onChange={(e) => setContentType(e.target.value as ContentType)}
            disabled={isSaving}
          />

          <Select
            label="Word Count"
            options={WORD_COUNT_OPTIONS}
            value={String(wordCount)}
            onChange={(e) => setWordCount(Number.parseInt(e.target.value, 10))}
            error={errors.wordCount}
            disabled={isSaving}
          />
        </div>

        <Input
          label="Style Hints"
          placeholder="e.g., conversational, formal, technical, persuasive"
          value={styleHints}
          onChange={(e) => setStyleHints(e.target.value)}
          disabled={isSaving}
        />

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="project-brief"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Content Brief
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleGenerateSummary}
              isLoading={isGeneratingSummary}
              disabled={isSaving || isGeneratingSummary}
            >
              AI Summary
            </Button>
          </div>
          <Textarea
            id="project-brief"
            className="min-h-[160px]"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            error={errors.brief}
            disabled={isSaving || isGeneratingSummary}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            isLoading={isSaving}
            disabled={!isDirty || isSaving}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
