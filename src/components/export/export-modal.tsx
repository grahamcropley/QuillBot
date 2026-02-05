"use client";

import { useState, useCallback } from "react";
import { X, Download, FileText, FileType } from "lucide-react";
import { Button } from "@/components/ui";
import {
  exportAsMarkdown,
  exportAsWord,
  downloadBlob,
  sanitizeFilename,
} from "@/lib/export";
import type { Project } from "@/types";
import { clsx } from "clsx";

type ExportFormat = "markdown" | "word";

interface ExportModalProps {
  project: Project;
  content: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({
  project,
  content,
  isOpen,
  onClose,
}: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [includeMetadata, setIncludeMetadata] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const filename = sanitizeFilename(project.name);

      if (format === "markdown") {
        const blob = exportAsMarkdown(project, content, {
          includeFrontmatter: includeMetadata,
        });
        downloadBlob(blob, `${filename}.md`);
      } else {
        const blob = await exportAsWord(project, content, { includeMetadata });
        downloadBlob(blob, `${filename}.docx`);
      }

      onClose();
    } finally {
      setIsExporting(false);
    }
  }, [format, includeMetadata, project, content, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Export Document
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat("markdown")}
                className={clsx(
                  "flex items-center gap-3 p-4 rounded-lg border-2 transition-all",
                  format === "markdown"
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300",
                )}
              >
                <FileText
                  className={clsx(
                    "w-6 h-6",
                    format === "markdown" ? "text-blue-600" : "text-gray-400",
                  )}
                />
                <div className="text-left">
                  <p
                    className={clsx(
                      "font-medium",
                      format === "markdown" ? "text-blue-900" : "text-gray-900",
                    )}
                  >
                    Markdown
                  </p>
                  <p className="text-xs text-gray-500">.md file</p>
                </div>
              </button>

              <button
                onClick={() => setFormat("word")}
                className={clsx(
                  "flex items-center gap-3 p-4 rounded-lg border-2 transition-all",
                  format === "word"
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300",
                )}
              >
                <FileType
                  className={clsx(
                    "w-6 h-6",
                    format === "word" ? "text-blue-600" : "text-gray-400",
                  )}
                />
                <div className="text-left">
                  <p
                    className={clsx(
                      "font-medium",
                      format === "word" ? "text-blue-900" : "text-gray-900",
                    )}
                  >
                    Word
                  </p>
                  <p className="text-xs text-gray-500">.docx file</p>
                </div>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="includeMetadata"
              checked={includeMetadata}
              onChange={(e) => setIncludeMetadata(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label
              htmlFor="includeMetadata"
              className="text-sm text-gray-700 cursor-pointer"
            >
              Include project metadata
            </label>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Filename:</span>{" "}
              {sanitizeFilename(project.name)}.
              {format === "markdown" ? "md" : "docx"}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleExport} isLoading={isExporting}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>
    </div>
  );
}
