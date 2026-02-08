import { promises as fs } from "fs";
import path from "path";
import { watch, type FSWatcher } from "chokidar";

export interface ProjectFileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

export type ProjectFileEvent =
  | { type: "ready"; now: string }
  | { type: "file.added"; file: ProjectFileInfo }
  | { type: "file.changed"; file: ProjectFileInfo }
  | { type: "file.deleted"; path: string }
  | { type: "error"; message: string };

type ClientWriter = WritableStreamDefaultWriter<Uint8Array>;

interface ProjectWatcher {
  watcher: FSWatcher;
  clients: Set<ClientWriter>;
}

function toFileInfo(
  fileName: string,
  stats: import("fs").Stats,
): ProjectFileInfo {
  return {
    name: fileName,
    path: fileName,
    isDirectory: stats.isDirectory(),
    size: typeof stats.size === "number" ? stats.size : 0,
    modifiedAt:
      typeof stats.mtime?.toISOString === "function"
        ? stats.mtime.toISOString()
        : new Date().toISOString(),
  };
}

async function safeStat(fullPath: string): Promise<import("fs").Stats | null> {
  try {
    return await fs.stat(fullPath);
  } catch {
    return null;
  }
}

export class ProjectFileEventsManager {
  private projects = new Map<string, ProjectWatcher>();
  private encoder = new TextEncoder();

  async subscribe(options: {
    projectId: string;
    directoryPath: string;
    writer: ClientWriter;
  }): Promise<() => Promise<void>> {
    const { projectId, directoryPath, writer } = options;

    const project = this.projects.get(projectId);
    if (project) {
      project.clients.add(writer);
    } else {
      const clients = new Set<ClientWriter>([writer]);
      const watcher = this.createWatcher({ projectId, directoryPath });
      this.projects.set(projectId, { watcher, clients });
    }

    // Send a ready event so clients can mark connected.
    // IMPORTANT: do not await the initial write before the Response is
    // returned, otherwise the stream can deadlock (no reader yet).
    void this.writeEvent(writer, {
      type: "ready",
      now: new Date().toISOString(),
    }).catch(() => {
      const existing = this.projects.get(projectId);
      existing?.clients.delete(writer);
      if (existing && existing.clients.size === 0) {
        void existing.watcher.close().finally(() => {
          this.projects.delete(projectId);
        });
      }
    });

    return async () => {
      const existing = this.projects.get(projectId);
      if (!existing) return;
      existing.clients.delete(writer);
      if (existing.clients.size === 0) {
        await existing.watcher.close();
        this.projects.delete(projectId);
      }
    };
  }

  private createWatcher(options: {
    projectId: string;
    directoryPath: string;
  }): FSWatcher {
    const { projectId, directoryPath } = options;

    const watcher = watch(directoryPath, {
      depth: 0,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 150,
        pollInterval: 50,
      },
    });

    watcher.on("add", async (fullPath) => {
      const fileName = path.basename(fullPath);
      const stats = await safeStat(fullPath);
      if (!stats) return;
      this.broadcast(projectId, {
        type: "file.added",
        file: toFileInfo(fileName, stats),
      });
    });

    watcher.on("change", async (fullPath) => {
      const fileName = path.basename(fullPath);
      const stats = await safeStat(fullPath);
      if (!stats) return;
      this.broadcast(projectId, {
        type: "file.changed",
        file: toFileInfo(fileName, stats),
      });
    });

    watcher.on("unlink", async (fullPath) => {
      const fileName = path.basename(fullPath);
      this.broadcast(projectId, { type: "file.deleted", path: fileName });
    });

    watcher.on("error", (err) => {
      this.broadcast(projectId, {
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    });

    return watcher;
  }

  private broadcast(projectId: string, event: ProjectFileEvent): void {
    const project = this.projects.get(projectId);
    if (!project) return;

    for (const writer of Array.from(project.clients)) {
      void this.writeEvent(writer, event).catch(() => {
        project.clients.delete(writer);
      });
    }

    if (project.clients.size === 0) {
      void project.watcher.close().finally(() => {
        this.projects.delete(projectId);
      });
    }
  }

  private async writeEvent(
    writer: ClientWriter,
    event: ProjectFileEvent,
  ): Promise<void> {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    await writer.write(this.encoder.encode(payload));
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __projectFileEventsManager: ProjectFileEventsManager | undefined;
}

export const projectFileEventsManager: ProjectFileEventsManager =
  globalThis.__projectFileEventsManager ?? new ProjectFileEventsManager();

if (!globalThis.__projectFileEventsManager) {
  globalThis.__projectFileEventsManager = projectFileEventsManager;
}
