import { promises as fs } from "fs";
import path from "path";
import type {
  Project,
  Message,
  StarterFormData,
  BriefAdherenceCache,
} from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");
const PROJECTS_WORKSPACE_DIR = path.join(DATA_DIR, "projects");

let writeLock: Promise<void> = Promise.resolve();

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeLock.then(fn, fn);
  writeLock = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

interface StoredBriefAdherenceCache extends Omit<
  BriefAdherenceCache,
  "timestamp"
> {
  timestamp: string;
}

interface StoredProject extends Omit<
  Project,
  "createdAt" | "updatedAt" | "messages" | "briefAdherenceCache"
> {
  createdAt: string;
  updatedAt: string;
  messages: Array<Omit<Message, "timestamp"> & { timestamp: string }>;
  briefAdherenceCache?: StoredBriefAdherenceCache;
}

interface ProjectsData {
  projects: StoredProject[];
}

interface ProjectActor {
  id: string;
  name: string;
}

async function ensureDataDir(): Promise<void> {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  try {
    await fs.access(PROJECTS_WORKSPACE_DIR);
  } catch {
    await fs.mkdir(PROJECTS_WORKSPACE_DIR, { recursive: true });
  }
}

async function readProjectsFile(): Promise<ProjectsData> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(PROJECTS_FILE, "utf-8");
    return JSON.parse(data) as ProjectsData;
  } catch {
    return { projects: [] };
  }
}

async function writeProjectsFile(data: ProjectsData): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(PROJECTS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function hydrateProject(stored: StoredProject): Project {
  return {
    ...stored,
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
    messages: stored.messages.map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    })),
    briefAdherenceCache: stored.briefAdherenceCache
      ? {
          ...stored.briefAdherenceCache,
          timestamp: new Date(stored.briefAdherenceCache.timestamp),
        }
      : undefined,
  };
}

function serializeProject(project: Project): StoredProject {
  return {
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    messages: project.messages.map((m) => ({
      ...m,
      timestamp: m.timestamp.toISOString(),
    })),
    briefAdherenceCache: project.briefAdherenceCache
      ? {
          ...project.briefAdherenceCache,
          timestamp: project.briefAdherenceCache.timestamp.toISOString(),
        }
      : undefined,
  };
}

export async function getAllProjects(): Promise<Project[]> {
  const data = await readProjectsFile();
  return data.projects.map(hydrateProject);
}

export async function getProject(id: string): Promise<Project | null> {
  const data = await readProjectsFile();
  const stored = data.projects.find((p) => p.id === id);
  return stored ? hydrateProject(stored) : null;
}

function generateId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function createProject(
  name: string,
  formData: StarterFormData,
  actor?: ProjectActor,
  isReviewMode?: boolean,
  reviewFilename?: string,
): Promise<Project> {
  return withWriteLock(async () => {
    const data = await readProjectsFile();
    const now = new Date();
    const projectId = generateId();
    const directoryPath = path.join(PROJECTS_WORKSPACE_DIR, projectId);

    await fs.mkdir(directoryPath, { recursive: true });

    // If review mode, seed draft.md with imported source content.
    if (isReviewMode && formData.brief) {
      const draftPath = path.join(directoryPath, "draft.md");
      await fs.writeFile(draftPath, formData.brief, "utf-8");
    }

    const newProject: Project = {
      id: projectId,
      name,
      contentType: formData.contentType,
      brief: isReviewMode ? "" : formData.brief,
      wordCount: formData.wordCount,
      styleHints: formData.styleHints,
      documentContent: "",
      messages: [],
      directoryPath,
      createdAt: now,
      updatedAt: now,
      createdBy: actor?.id,
      createdByName: actor?.name,
      lastModifiedBy: actor?.id,
      lastModifiedByName: actor?.name,
      reviewFilename: reviewFilename,
    };

    data.projects.push(serializeProject(newProject));
    await writeProjectsFile(data);

    return newProject;
  });
}

export function updateProject(
  id: string,
  updates: Partial<
    Pick<
      Project,
      | "documentContent"
      | "messages"
      | "name"
      | "contentType"
      | "wordCount"
      | "styleHints"
      | "brief"
      | "opencodeSessionId"
      | "briefAdherenceCache"
    >
  >,
  actor?: ProjectActor,
): Promise<Project | null> {
  return withWriteLock(async () => {
    const data = await readProjectsFile();
    const index = data.projects.findIndex((p) => p.id === id);

    if (index === -1) return null;

    const existing = hydrateProject(data.projects[index]);
    const shouldResetBriefCache =
      typeof updates.brief === "string" && updates.brief !== existing.brief;

    const updated: Project = {
      ...existing,
      ...updates,
      briefAdherenceCache: shouldResetBriefCache
        ? undefined
        : (updates.briefAdherenceCache ?? existing.briefAdherenceCache),
      updatedAt: new Date(),
      createdBy: existing.createdBy ?? actor?.id,
      createdByName: existing.createdByName ?? actor?.name,
      lastModifiedBy: actor?.id ?? existing.lastModifiedBy,
      lastModifiedByName: actor?.name ?? existing.lastModifiedByName,
    };

    data.projects[index] = serializeProject(updated);
    await writeProjectsFile(data);

    return updated;
  });
}

export function addMessageToProject(
  id: string,
  role: Message["role"],
  content: string,
  actor?: ProjectActor,
): Promise<Project | null> {
  return withWriteLock(async () => {
    const data = await readProjectsFile();
    const index = data.projects.findIndex((p) => p.id === id);

    if (index === -1) return null;

    const existing = hydrateProject(data.projects[index]);
    const newMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      role,
      content,
      timestamp: new Date(),
    };

    const updated: Project = {
      ...existing,
      messages: [...existing.messages, newMessage],
      updatedAt: new Date(),
      createdBy: existing.createdBy ?? actor?.id,
      createdByName: existing.createdByName ?? actor?.name,
      lastModifiedBy: actor?.id ?? existing.lastModifiedBy,
      lastModifiedByName: actor?.name ?? existing.lastModifiedByName,
    };

    data.projects[index] = serializeProject(updated);
    await writeProjectsFile(data);

    return updated;
  });
}

export function addMessageObjectToProject(
  id: string,
  message: Message,
  actor?: ProjectActor,
): Promise<Project | null> {
  return withWriteLock(async () => {
    const data = await readProjectsFile();
    const index = data.projects.findIndex((p) => p.id === id);

    if (index === -1) return null;

    const existing = hydrateProject(data.projects[index]);
    const messageWithTimestamp: Message = {
      ...message,
      id:
        message.id ||
        `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp:
        message.timestamp instanceof Date
          ? message.timestamp
          : new Date(message.timestamp || Date.now()),
    };

    const updated: Project = {
      ...existing,
      messages: [...existing.messages, messageWithTimestamp],
      updatedAt: new Date(),
      createdBy: existing.createdBy ?? actor?.id,
      createdByName: existing.createdByName ?? actor?.name,
      lastModifiedBy: actor?.id ?? existing.lastModifiedBy,
      lastModifiedByName: actor?.name ?? existing.lastModifiedByName,
    };

    data.projects[index] = serializeProject(updated);
    await writeProjectsFile(data);

    return updated;
  });
}

export function updateMessageInProject(
  id: string,
  messageId: string,
  updates: Partial<Message>,
  actor?: ProjectActor,
): Promise<Project | null> {
  return withWriteLock(async () => {
    const data = await readProjectsFile();
    const index = data.projects.findIndex((p) => p.id === id);

    if (index === -1) return null;

    const existing = hydrateProject(data.projects[index]);
    const updatedMessages = existing.messages.map((message) => {
      if (message.id !== messageId) return message;
      return {
        ...message,
        ...updates,
        timestamp: message.timestamp,
        id: message.id,
      };
    });

    const updated: Project = {
      ...existing,
      messages: updatedMessages,
      updatedAt: new Date(),
      createdBy: existing.createdBy ?? actor?.id,
      createdByName: existing.createdByName ?? actor?.name,
      lastModifiedBy: actor?.id ?? existing.lastModifiedBy,
      lastModifiedByName: actor?.name ?? existing.lastModifiedByName,
    };

    data.projects[index] = serializeProject(updated);
    await writeProjectsFile(data);

    return updated;
  });
}

export function deleteProject(id: string): Promise<boolean> {
  return withWriteLock(async () => {
    const data = await readProjectsFile();
    const project = data.projects.find((p) => p.id === id);

    if (!project) return false;

    data.projects = data.projects.filter((p) => p.id !== id);

    await writeProjectsFile(data);

    if (project.directoryPath) {
      try {
        await fs.rm(project.directoryPath, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to delete project directory: ${error}`);
      }
    }

    return true;
  });
}
