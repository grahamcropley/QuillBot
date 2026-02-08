import { promises as fs } from "fs";
import path from "path";

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

export interface ProjectVersionHistory {
  schemaVersion: 1;
  files: Record<string, FileHistoryRecord>;
}

const HISTORY_DIR_NAME = ".quillbot";
const HISTORY_FILE_NAME = "version-history.json";
const SNAPSHOT_DIR_NAME = "versions";

const locks = new Map<string, Promise<void>>();

function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prior = locks.get(key) ?? Promise.resolve();
  const next = prior.then(fn, fn);
  locks.set(
    key,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

function historyRoot(projectDir: string): string {
  return path.join(projectDir, HISTORY_DIR_NAME);
}

function historyPath(projectDir: string): string {
  return path.join(historyRoot(projectDir), HISTORY_FILE_NAME);
}

function safeKey(filePath: string): string {
  return filePath.replaceAll("/", "__");
}

function snapshotDir(projectDir: string, filePath: string): string {
  return path.join(
    historyRoot(projectDir),
    SNAPSHOT_DIR_NAME,
    safeKey(filePath),
  );
}

function snapshotPath(
  projectDir: string,
  filePath: string,
  versionId: string,
): string {
  return path.join(snapshotDir(projectDir, filePath), `${versionId}.md`);
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

async function readJson<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJson(p: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(p));
  await fs.writeFile(p, JSON.stringify(value, null, 2), "utf-8");
}

export async function getProjectVersionHistory(
  projectDir: string,
): Promise<ProjectVersionHistory> {
  const existing = await readJson<ProjectVersionHistory>(
    historyPath(projectDir),
  );
  if (existing && existing.schemaVersion === 1 && existing.files) {
    return existing;
  }
  return { schemaVersion: 1, files: {} };
}

async function saveProjectVersionHistory(
  projectDir: string,
  history: ProjectVersionHistory,
): Promise<void> {
  await writeJson(historyPath(projectDir), history);
}

export function createVersionId(now: Date = new Date()): string {
  return `v_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function ensureInitialVersion(options: {
  projectDir: string;
  filePath: string;
  createdBy: VersionActor;
  label?: string;
}): Promise<FileHistoryRecord> {
  const { projectDir, filePath, createdBy, label } = options;
  const lockKey = `${projectDir}:ensureInitial:${filePath}`;

  return withLock(lockKey, async () => {
    const history = await getProjectVersionHistory(projectDir);
    const fullPath = path.join(projectDir, filePath);
    let workingContent = "";
    try {
      workingContent = await fs.readFile(fullPath, "utf-8");
    } catch {
      workingContent = "";
    }

    const record = history.files[filePath];

    // Heal the common case where Version 1 was created before the file was
    // actually populated.
    if (
      record &&
      record.versions.length === 1 &&
      record.latestVersionId &&
      workingContent.trim().length > 0
    ) {
      const snap = await readVersionContent({
        projectDir,
        filePath,
        versionId: record.latestVersionId,
      });

      if (!snap || snap.trim().length === 0) {
        await ensureDir(snapshotDir(projectDir, filePath));
        await fs.writeFile(
          snapshotPath(projectDir, filePath, record.latestVersionId),
          workingContent,
          "utf-8",
        );
      }

      return record;
    }

    if (record?.versions?.length) return record;

    // If the working file is empty/nonexistent, do not create Version 1 yet.
    if (workingContent.trim().length === 0) {
      if (record) return record;

      const next: FileHistoryRecord = {
        filePath,
        latestVersionId: null,
        versions: [],
      };

      history.files[filePath] = next;
      await saveProjectVersionHistory(projectDir, history);
      return next;
    }

    const id = createVersionId();
    await ensureDir(snapshotDir(projectDir, filePath));
    await fs.writeFile(
      snapshotPath(projectDir, filePath, id),
      workingContent,
      "utf-8",
    );

    const meta: FileVersionMeta = {
      id,
      createdAt: new Date().toISOString(),
      createdBy,
      label: label ?? "Version 1",
    };

    const next: FileHistoryRecord = {
      filePath,
      latestVersionId: id,
      versions: [meta],
      lastModifiedAt: meta.createdAt,
      lastModifiedBy: createdBy,
    };

    history.files[filePath] = next;
    await saveProjectVersionHistory(projectDir, history);
    return next;
  });
}

export async function listVersions(options: {
  projectDir: string;
  filePath: string;
}): Promise<FileHistoryRecord | null> {
  const { projectDir, filePath } = options;
  const history = await getProjectVersionHistory(projectDir);
  return history.files[filePath] ?? null;
}

export async function readVersionContent(options: {
  projectDir: string;
  filePath: string;
  versionId: string;
}): Promise<string | null> {
  const { projectDir, filePath, versionId } = options;
  try {
    return await fs.readFile(
      snapshotPath(projectDir, filePath, versionId),
      "utf-8",
    );
  } catch {
    return null;
  }
}

export async function createSnapshot(options: {
  projectDir: string;
  filePath: string;
  createdBy: VersionActor;
  label?: string;
  content: string;
}): Promise<FileHistoryRecord> {
  const { projectDir, filePath, createdBy, label, content } = options;
  const lockKey = `${projectDir}:snapshot:${filePath}`;

  return withLock(lockKey, async () => {
    const history = await getProjectVersionHistory(projectDir);
    const existing: FileHistoryRecord = history.files[filePath] ?? {
      filePath,
      latestVersionId: null,
      versions: [],
    };

    const id = createVersionId();
    await ensureDir(snapshotDir(projectDir, filePath));
    await fs.writeFile(
      snapshotPath(projectDir, filePath, id),
      content,
      "utf-8",
    );

    const meta: FileVersionMeta = {
      id,
      createdAt: new Date().toISOString(),
      createdBy,
      label,
    };

    const next: FileHistoryRecord = {
      ...existing,
      latestVersionId: id,
      versions: [...existing.versions, meta],
      lastModifiedAt: meta.createdAt,
      lastModifiedBy: createdBy,
    };

    history.files[filePath] = next;
    await saveProjectVersionHistory(projectDir, history);
    return next;
  });
}

export async function branchToVersion(options: {
  projectDir: string;
  filePath: string;
  versionId: string;
  actor: VersionActor;
  restoreWorkingFile: boolean;
}): Promise<{ record: FileHistoryRecord; content: string | null }> {
  const { projectDir, filePath, versionId, actor, restoreWorkingFile } =
    options;
  const lockKey = `${projectDir}:branch:${filePath}`;

  return withLock(lockKey, async () => {
    const history = await getProjectVersionHistory(projectDir);
    const existing = history.files[filePath];

    if (!existing) {
      return {
        record: { filePath, latestVersionId: null, versions: [] },
        content: null,
      };
    }

    const idx = existing.versions.findIndex((v) => v.id === versionId);
    if (idx < 0) {
      return { record: existing, content: null };
    }

    const toDelete = existing.versions.slice(idx + 1);
    for (const v of toDelete) {
      const p = snapshotPath(projectDir, filePath, v.id);
      try {
        await fs.rm(p, { force: true });
      } catch {
        // ignore
      }
    }

    const trimmedVersions = existing.versions.slice(0, idx + 1);

    const next: FileHistoryRecord = {
      ...existing,
      latestVersionId: versionId,
      versions: trimmedVersions,
      lastModifiedAt: new Date().toISOString(),
      lastModifiedBy: actor,
    };

    history.files[filePath] = next;
    await saveProjectVersionHistory(projectDir, history);

    const content = await readVersionContent({
      projectDir,
      filePath,
      versionId,
    });
    if (restoreWorkingFile && content !== null) {
      const fullPath = path.join(projectDir, filePath);
      await fs.writeFile(fullPath, content, "utf-8");
    }

    return { record: next, content };
  });
}

export async function setLastModified(options: {
  projectDir: string;
  filePath: string;
  actor: VersionActor;
  modifiedAt?: string;
}): Promise<void> {
  const { projectDir, filePath, actor, modifiedAt } = options;
  const lockKey = `${projectDir}:lastModified:${filePath}`;

  await withLock(lockKey, async () => {
    const history = await getProjectVersionHistory(projectDir);
    const existing: FileHistoryRecord = history.files[filePath] ?? {
      filePath,
      latestVersionId: null,
      versions: [],
    };

    history.files[filePath] = {
      ...existing,
      lastModifiedAt: modifiedAt ?? new Date().toISOString(),
      lastModifiedBy: actor,
    };

    await saveProjectVersionHistory(projectDir, history);
  });
}
