import { promises as fs } from "fs";
import path from "path";
import type { Project, Message, StarterFormData } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");
const PROJECTS_WORKSPACE_DIR = path.join(DATA_DIR, "projects");

interface StoredProject extends Omit<
  Project,
  "createdAt" | "updatedAt" | "messages"
> {
  createdAt: string;
  updatedAt: string;
  messages: Array<Omit<Message, "timestamp"> & { timestamp: string }>;
}

interface ProjectsData {
  projects: StoredProject[];
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

export async function createProject(
  name: string,
  formData: StarterFormData,
): Promise<Project> {
  const data = await readProjectsFile();
  const now = new Date();
  const projectId = generateId();
  const directoryPath = path.join(PROJECTS_WORKSPACE_DIR, projectId);

  await fs.mkdir(directoryPath, { recursive: true });

  const brief = `# ${name}\n\n**Type**: ${formData.contentType}\n**Word Count**: ${formData.wordCount}\n\n## Brief\n\n${formData.brief}\n\n${formData.styleHints ? `## Style Hints\n\n${formData.styleHints}\n\n` : ""}`;
  await fs.writeFile(path.join(directoryPath, "brief.md"), brief, "utf-8");

  const newProject: Project = {
    id: projectId,
    name,
    contentType: formData.contentType,
    brief: formData.brief,
    wordCount: formData.wordCount,
    styleHints: formData.styleHints,
    documentContent: "",
    messages: [],
    directoryPath,
    createdAt: now,
    updatedAt: now,
  };

  data.projects.push(serializeProject(newProject));
  await writeProjectsFile(data);

  return newProject;
}

export async function updateProject(
  id: string,
  updates: Partial<
    Pick<Project, "documentContent" | "messages" | "name" | "opencodeSessionId">
  >,
): Promise<Project | null> {
  const data = await readProjectsFile();
  const index = data.projects.findIndex((p) => p.id === id);

  if (index === -1) return null;

  const existing = hydrateProject(data.projects[index]);
  const updated: Project = {
    ...existing,
    ...updates,
    updatedAt: new Date(),
  };

  data.projects[index] = serializeProject(updated);
  await writeProjectsFile(data);

  return updated;
}

export async function addMessageToProject(
  id: string,
  role: Message["role"],
  content: string,
): Promise<Project | null> {
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
  };

  data.projects[index] = serializeProject(updated);
  await writeProjectsFile(data);

  return updated;
}

export async function addMessageObjectToProject(
  id: string,
  message: Message,
): Promise<Project | null> {
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
  };

  data.projects[index] = serializeProject(updated);
  await writeProjectsFile(data);

  return updated;
}

export async function updateMessageInProject(
  id: string,
  messageId: string,
  updates: Partial<Message>,
): Promise<Project | null> {
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
  };

  data.projects[index] = serializeProject(updated);
  await writeProjectsFile(data);

  return updated;
}

export async function deleteProject(id: string): Promise<boolean> {
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
}
