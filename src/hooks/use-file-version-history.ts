"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Result } from "@/types";

export interface VersionActor {
  id: string;
  name: string;
  email?: string;
  kind: "user" | "ai";
}

export interface FileVersionMeta {
  id: string;
  createdAt: string;
  createdBy: VersionActor;
  label?: string;
}

export interface FileHistoryRecord {
  filePath: string;
  latestVersionId: string | null;
  versions: FileVersionMeta[];
  lastModifiedAt?: string;
  lastModifiedBy?: VersionActor;
}

interface VersionsResponse {
  record: FileHistoryRecord;
  baselineContent: string | null;
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<Result<T>> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        success: false,
        error: new Error(`HTTP ${res.status}: ${text}`),
      };
    }
    return { success: true, data: (await res.json()) as T };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

export interface UseFileVersionHistoryResult {
  record: FileHistoryRecord | null;
  baselineContent: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;

  selectedVersionId: string | null;
  setSelectedVersionId: (id: string | null) => void;
  selectedVersionContent: string | null;
  loadVersionContent: (versionId: string) => Promise<void>;

  createSnapshot: (
    content: string,
    label?: string,
  ) => Promise<Result<FileHistoryRecord>>;
  branchToVersion: (
    versionId: string,
    restoreWorkingFile: boolean,
  ) => Promise<Result<{ record: FileHistoryRecord; content: string | null }>>;

  setLastModified: (actor: VersionActor) => Promise<void>;
}

export function useFileVersionHistory(options: {
  projectId: string;
  filePath: string | null;
  enabled?: boolean;
}): UseFileVersionHistoryResult {
  const { projectId, filePath, enabled = true } = options;

  const [record, setRecord] = useState<FileHistoryRecord | null>(null);
  const [baselineContent, setBaselineContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );
  const [selectedVersionContent, setSelectedVersionContent] = useState<
    string | null
  >(null);

  const activeKey = useMemo(() => {
    if (!enabled || !filePath) return null;
    return `${projectId}:${filePath}`;
  }, [enabled, filePath, projectId]);

  const inFlightKeyRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !filePath) return;

    setIsLoading(true);
    setError(null);

    const key = `${projectId}:${filePath}`;
    inFlightKeyRef.current = key;

    const result = await fetchJson<VersionsResponse>(
      `/api/projects/${projectId}/versions?path=${encodeURIComponent(filePath)}`,
    );

    if (inFlightKeyRef.current !== key) return;

    setIsLoading(false);

    if (!result.success) {
      setError(result.error.message);
      return;
    }

    setRecord(result.data.record);
    setBaselineContent(result.data.baselineContent);

    const latest = result.data.record.latestVersionId;
    setSelectedVersionId((prev) => prev ?? latest);
    // Avoid fetching content redundantly; caller can do it.
    setSelectedVersionContent(null);
  }, [enabled, filePath, projectId]);

  useEffect(() => {
    if (!activeKey) return;

    // Reset selection when switching files/projects.
    setSelectedVersionId(null);
    setSelectedVersionContent(null);
    setBaselineContent(null);

    void refresh();
  }, [activeKey, refresh]);

  const loadVersionContent = useCallback(
    async (versionId: string) => {
      if (!enabled || !filePath) return;
      const result = await fetchJson<{ content: string }>(
        `/api/projects/${projectId}/versions/content?path=${encodeURIComponent(filePath)}&versionId=${encodeURIComponent(versionId)}`,
      );
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      setSelectedVersionContent(result.data.content);
    },
    [enabled, filePath, projectId],
  );

  const createSnapshot = useCallback(
    async (
      content: string,
      label?: string,
    ): Promise<Result<FileHistoryRecord>> => {
      if (!enabled || !filePath) {
        return { success: false, error: new Error("Version history disabled") };
      }

      const result = await fetchJson<{ record: FileHistoryRecord }>(
        `/api/projects/${projectId}/versions/snapshot`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: filePath, content, label }),
        },
      );

      if (!result.success) return result;

      setRecord(result.data.record);
      setBaselineContent(content);
      setSelectedVersionId(result.data.record.latestVersionId);
      setSelectedVersionContent(null);

      return { success: true, data: result.data.record };
    },
    [enabled, filePath, projectId],
  );

  const branchToVersion = useCallback(
    async (
      versionId: string,
      restoreWorkingFile: boolean,
    ): Promise<
      Result<{ record: FileHistoryRecord; content: string | null }>
    > => {
      if (!enabled || !filePath) {
        return { success: false, error: new Error("Version history disabled") };
      }

      const result = await fetchJson<{
        record: FileHistoryRecord;
        content: string | null;
      }>(`/api/projects/${projectId}/versions/branch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: filePath,
          versionId,
          restoreWorkingFile,
        }),
      });

      if (!result.success) return result;

      setRecord(result.data.record);
      setSelectedVersionId(result.data.record.latestVersionId);
      setSelectedVersionContent(null);

      return { success: true, data: result.data };
    },
    [enabled, filePath, projectId],
  );

  const setLastModified = useCallback(
    async (actor: VersionActor) => {
      if (!enabled || !filePath) return;
      await fetchJson<{ success: true }>(
        `/api/projects/${projectId}/versions/last-modified`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: filePath, actor }),
        },
      );
      // Optimistic UI: keep current record, but update lastModified.
      setRecord((prev) =>
        prev
          ? {
              ...prev,
              lastModifiedAt: new Date().toISOString(),
              lastModifiedBy: actor,
            }
          : prev,
      );
    },
    [enabled, filePath, projectId],
  );

  return {
    record,
    baselineContent,
    isLoading,
    error,
    refresh,
    selectedVersionId,
    setSelectedVersionId,
    selectedVersionContent,
    loadVersionContent,
    createSnapshot,
    branchToVersion,
    setLastModified,
  };
}
