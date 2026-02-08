"use client";

import { useState, useCallback, type FormEvent } from "react";
import { Button, FileUpload } from "@/components/ui";
import { convertFileToMarkdown } from "@/lib/file-to-markdown";

interface ReviewFormData {
  markdown: string;
  filename: string;
}

interface ReviewExistingFormProps {
  onSubmit: (data: ReviewFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ReviewExistingForm({
  onSubmit,
  onCancel,
  isLoading,
}: ReviewExistingFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [markdown, setMarkdown] = useState<string>("");
  const [filename, setFilename] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isConverting, setIsConverting] = useState(false);

  const handleFileSelect = useCallback(async (selectedFile: File | null) => {
    setFile(selectedFile);
    setErrors((prev) => ({ ...prev, file: "" }));

    if (!selectedFile) {
      setMarkdown("");
      setFilename("");
      return;
    }

    setIsConverting(true);
    try {
      const result = await convertFileToMarkdown(selectedFile);
      setMarkdown(result.markdown);
      setFilename(result.filename);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to convert file";
      setErrors((prev) => ({ ...prev, file: errorMessage }));
      setFile(null);
      setMarkdown("");
      setFilename("");
    } finally {
      setIsConverting(false);
    }
  }, []);

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!markdown.trim()) {
      newErrors.file = "Please upload a file";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [markdown]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!validate() || isConverting) return;

      onSubmit({
        markdown,
        filename,
      });
    },
    [markdown, filename, validate, isConverting, onSubmit],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FileUpload
        label="Upload Existing Content"
        accept=".docx,.txt,.html"
        error={errors.file}
        onFileSelect={handleFileSelect}
        value={file}
      />

      {markdown && (
        <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-700 dark:text-green-300">
            ✓ Content converted successfully ({markdown.split(/\s+/).length}{" "}
            words)
          </p>
        </div>
      )}

      <div className="flex gap-3 justify-end pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isLoading || isConverting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          isLoading={isLoading || isConverting}
          disabled={isConverting}
        >
          {isConverting ? "Converting..." : "Review Content"}
        </Button>
      </div>
    </form>
  );
}
