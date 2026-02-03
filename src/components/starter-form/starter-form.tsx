'use client';

import { useState, useCallback, type FormEvent } from 'react';
import { Button, Input, Textarea, Select } from '@/components/ui';
import type { StarterFormData, ContentType } from '@/types';

interface StarterFormProps {
  onSubmit: (data: StarterFormData) => void;
  isLoading?: boolean;
  initialData?: Partial<StarterFormData>;
}

const CONTENT_TYPE_OPTIONS = [
  { value: 'blog', label: 'Blog Post' },
  { value: 'white-paper', label: 'White Paper' },
  { value: 'social-post', label: 'Social Media Post' },
  { value: 'email', label: 'Email' },
];

const WORD_COUNT_OPTIONS = [
  { value: '300', label: '~300 words (Short)' },
  { value: '500', label: '~500 words (Medium)' },
  { value: '1000', label: '~1000 words (Long)' },
  { value: '2000', label: '~2000 words (Extended)' },
];

export function StarterForm({ onSubmit, isLoading, initialData }: StarterFormProps) {
  const [contentType, setContentType] = useState<ContentType>(
    initialData?.contentType || 'blog'
  );
  const [wordCount, setWordCount] = useState<number>(initialData?.wordCount || 500);
  const [styleHints, setStyleHints] = useState(initialData?.styleHints || '');
  const [brief, setBrief] = useState(initialData?.brief || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!brief.trim()) {
      newErrors.brief = 'Please provide a content brief';
    } else if (brief.trim().length < 20) {
      newErrors.brief = 'Brief should be at least 20 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [brief]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      onSubmit({
        contentType,
        wordCount,
        styleHints: styleHints.trim(),
        brief: brief.trim(),
      });
    },
    [contentType, wordCount, styleHints, brief, validate, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Content Type"
          options={CONTENT_TYPE_OPTIONS}
          value={contentType}
          onChange={(e) => setContentType(e.target.value as ContentType)}
        />

        <Select
          label="Word Count"
          options={WORD_COUNT_OPTIONS}
          value={String(wordCount)}
          onChange={(e) => setWordCount(parseInt(e.target.value, 10))}
        />
      </div>

      <Input
        label="Style Hints (Optional)"
        placeholder="e.g., conversational, formal, technical, humorous..."
        value={styleHints}
        onChange={(e) => setStyleHints(e.target.value)}
      />

      <Textarea
        label="Content Brief"
        placeholder="Describe what you want to create. Include key points, target audience, tone, and any specific requirements..."
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        error={errors.brief}
        className="min-h-[150px]"
      />

      <Button type="submit" isLoading={isLoading} className="w-full">
        Start Creating
      </Button>
    </form>
  );
}
