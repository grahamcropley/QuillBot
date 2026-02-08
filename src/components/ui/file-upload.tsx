"use client";

import {
  useState,
  useCallback,
  useRef,
  type DragEvent,
  type ChangeEvent,
} from "react";
import { Upload, X, File, Link as LinkIcon } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";

interface FileUploadProps {
  label?: string;
  accept?: string;
  error?: string;
  onFileSelect: (file: File | null) => void;
  onUrlProvide?: (url: string) => void;
  value?: File | null;
}

export function FileUpload({
  label = "Upload File",
  accept = ".docx,.txt,.html",
  error,
  onFileSelect,
  onUrlProvide,
  value,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUrlMode, setIsUrlMode] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFileSelect(files[0]);
      }
    },
    [onFileSelect],
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFileSelect(files[0]);
      }
    },
    [onFileSelect],
  );

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleClearFile = useCallback(() => {
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [onFileSelect]);

  const handleUrlSubmit = useCallback(() => {
    if (urlValue.trim() && onUrlProvide) {
      onUrlProvide(urlValue.trim());
      setIsUrlMode(false);
      setUrlValue("");
    }
  }, [urlValue, onUrlProvide]);

  const toggleMode = useCallback(() => {
    setIsUrlMode(!isUrlMode);
    setUrlValue("");
    if (value) {
      handleClearFile();
    }
  }, [isUrlMode, value, handleClearFile]);

  return (
    <div className="space-y-2">
      {label && (
        <div className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </div>
      )}

      {!value && !isUrlMode && (
        <>
          <button
            type="button"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer w-full
              ${
                isDragging
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                  : error
                    ? "border-red-300 dark:border-red-700"
                    : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
              }
            `}
            onClick={handleBrowseClick}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Click to browse or drag and drop
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Supports: .docx, .txt, .html
            </p>
          </button>

          {onUrlProvide && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleMode}
              className="w-full"
            >
              <LinkIcon className="w-4 h-4 mr-1.5" />
              Or paste a URL instead
            </Button>
          )}
        </>
      )}

      {!value && isUrlMode && (
        <div className="space-y-3">
          <Input
            placeholder="https://example.com/document.html"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            error={error}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleUrlSubmit}
              disabled={!urlValue.trim()}
              className="flex-1"
            >
              Fetch URL
            </Button>
            <Button type="button" variant="ghost" onClick={toggleMode}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {value && (
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <File className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">
            {value.name}
          </span>
          <button
            type="button"
            onClick={handleClearFile}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
            aria-label="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
