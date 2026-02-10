# AGENTS.md - LoopUp QuillBot Content Authoring Platform

> Web UI frontend for OpenCode-powered content authoring with marketing/copywriter agents.

## Project Overview

This is a content authoring platform that:

1. Connects to a headless OpenCode server configured with `/write-content` command
2. Guides users through a curated content creation journey
3. Provides real-time markdown preview and inline editing
4. Supports project persistence and continuation

### User Journey

1. **Project Selection**: Select existing project or create new (requires name)
2. **Starter Form**: Content type (blog/white-paper/social), word length, style hints, brief
3. **Prompt Injection**: Form selections prepend sentences to the brief
4. **OpenCode Conversation**: Submit to server, continue conversation in UI
5. **Draft Creation**: User instructs to create markdown draft
6. **Live Preview**: Real-time markdown rendering as file updates
7. **Contextual Feedback**: Select text in preview → append location context to messages
8. **Direct Editing**: Edit document in browser when OpenCode is idle
9. **Review Loop**: Continue conversation for OpenCode to review manual changes
10. **Analysis Panel**: Readability score, brief adherence metrics
11. **Export**: Download as markdown or Word doc
12. **Persistence**: Resume any project at any time

---

## Build Commands

```bash
# Install dependencies
pnpm install

# Development server
pnpm dev

# Production build
pnpm build

# Type checking
pnpm typecheck

# Linting
pnpm lint
pnpm lint:fix

# Format code
pnpm format

# Run all tests
pnpm test

# Run single test file
pnpm test -- path/to/test.spec.ts

# Run tests matching pattern
pnpm test -- -t "pattern"

# Run tests in watch mode
pnpm test -- --watch
```

### Monorepo Notes

- Package manager is pinned in `package.json` via `packageManager`
- Workspaces are defined in `pnpm-workspace.yaml`
- Internal AgentChat packages live under `packages/*` and are consumed via `workspace:*`
- Install and run commands from repo root (not inside `packages/*`)

---

## Tech Stack (Recommended)

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **State**: Zustand for client state
- **API**: Server Actions + REST for OpenCode
- **Markdown**: react-markdown with remark/rehype plugins
- **Editor**: Monaco Editor or CodeMirror for direct editing
- **Testing**: Vitest + React Testing Library
- **Export**: docx for Word generation

---

## Code Style Guidelines

### TypeScript

```typescript
// ALWAYS use strict types - never any, unknown only when truly unknown
type ContentType = 'blog' | 'white-paper' | 'social-post' | 'email';

// Prefer interfaces for objects, types for unions/primitives
interface Project {
  id: string;
  name: string;
  contentType: ContentType;
  createdAt: Date;
  updatedAt: Date;
}

// Use readonly for immutable data
interface Message {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly timestamp: Date;
}

// Explicit return types on exported functions
export function parseMarkdown(content: string): ParsedDocument { ... }

// Use satisfies for type checking with inference
const DEFAULT_CONFIG = {
  maxWords: 2000,
  defaultType: 'blog',
} satisfies Partial<ProjectConfig>;
```

### Imports

```typescript
// Order: 1) React/Next 2) External 3) Internal 4) Types 5) Styles
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { z } from "zod";
import { create } from "zustand";

import { OpenCodeClient } from "@/lib/opencode";
import { ProjectCard } from "@/components/project-card";

import type { Project, Message } from "@/types";

import "./styles.css";
```

### Naming Conventions

| Entity           | Convention              | Example                    |
| ---------------- | ----------------------- | -------------------------- |
| Components       | PascalCase              | `ProjectSelector.tsx`      |
| Hooks            | camelCase, `use` prefix | `useOpenCodeStream.ts`     |
| Utilities        | camelCase               | `parseMarkdown.ts`         |
| Types/Interfaces | PascalCase              | `ContentType`, `Project`   |
| Constants        | SCREAMING_SNAKE         | `MAX_WORD_COUNT`           |
| Files            | kebab-case              | `project-selector.tsx`     |
| Folders          | kebab-case              | `components/starter-form/` |

### Component Structure

```typescript
// components/project-card.tsx
'use client'; // Only if needed

interface ProjectCardProps {
  project: Project;
  onSelect: (id: string) => void;
  isActive?: boolean;
}

export function ProjectCard({ project, onSelect, isActive = false }: ProjectCardProps) {
  // 1. Hooks first
  const router = useRouter();

  // 2. Derived state
  const formattedDate = formatDate(project.updatedAt);

  // 3. Handlers
  const handleClick = useCallback(() => {
    onSelect(project.id);
  }, [project.id, onSelect]);

  // 4. Render
  return (
    <div onClick={handleClick} data-active={isActive}>
      {/* ... */}
    </div>
  );
}
```

### Error Handling

```typescript
// Use Result type for operations that can fail
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// API calls should return Results, not throw
async function sendToOpenCode(prompt: string): Promise<Result<Message>> {
  try {
    const response = await fetch('/api/opencode', { ... });
    if (!response.ok) {
      return { success: false, error: new Error(`HTTP ${response.status}`) };
    }
    return { success: true, data: await response.json() };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

// Components handle errors explicitly
const result = await sendToOpenCode(prompt);
if (!result.success) {
  setError(result.error.message);
  return;
}
// result.data is now typed correctly
```

### State Management

```typescript
// stores/project-store.ts
interface ProjectState {
  currentProject: Project | null;
  projects: Project[];
  isLoading: boolean;

  // Actions
  selectProject: (id: string) => void;
  createProject: (name: string) => Promise<void>;
  updateDocument: (content: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  projects: [],
  isLoading: false,

  selectProject: (id) => {
    const project = get().projects.find((p) => p.id === id);
    set({ currentProject: project ?? null });
  },
  // ...
}));
```

---

## Directory Structure

```
packages/
├── react/                  # @agent-chat/react
├── server-core/            # @agent-chat/server-core
└── server-next/            # @agent-chat/server-next
pnpm-workspace.yaml         # Workspace package globs

src/
├── app/                    # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx            # Project selection
│   ├── project/
│   │   └── [id]/
│   │       └── page.tsx    # Main authoring interface
│   └── api/
│       └── opencode/       # API routes for OpenCode proxy
├── components/
│   ├── ui/                 # Primitive UI components
│   ├── starter-form/       # Content creation form
│   ├── conversation/       # Chat interface
│   ├── preview/            # Markdown preview + editing
│   └── analysis/           # Readability/adherence panel
├── hooks/
│   ├── use-opencode-stream.ts
│   ├── use-document-sync.ts
│   └── use-text-selection.ts
├── lib/
│   ├── opencode.ts         # OpenCode client
│   ├── markdown.ts         # Parsing utilities
│   ├── export.ts           # Word doc generation
│   └── analysis.ts         # Readability scoring
├── stores/
│   └── project-store.ts
├── types/
│   └── index.ts
└── utils/
    └── prompt-builder.ts   # Form → prompt injection
```

---

## Testing Guidelines

```typescript
// Component tests: focus on user behavior
import { render, screen, userEvent } from '@testing-library/react';
import { ProjectCard } from './project-card';

describe('ProjectCard', () => {
  it('calls onSelect with project id when clicked', async () => {
    const onSelect = vi.fn();
    const project = createMockProject({ id: 'proj-1' });

    render(<ProjectCard project={project} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button'));

    expect(onSelect).toHaveBeenCalledWith('proj-1');
  });
});

// Integration tests: test real flows
describe('Content Creation Flow', () => {
  it('submits form and displays conversation', async () => {
    // ...
  });
});
```

---

## Key Implementation Notes

### OpenCode Integration

- Proxy OpenCode API through Next.js API routes (avoid CORS)
- Use Server-Sent Events for streaming responses
- Track conversation state with message history
- `/write-content` command expects augmented prompt with style instructions

### Prompt Injection (Step 4)

```typescript
// Form selections → prepended sentences
function buildPrompt(form: StarterForm, brief: string): string {
  const sentences: string[] = [];

  sentences.push(
    `Create a ${form.contentType} with approximately ${form.wordCount} words.`,
  );

  if (form.styleHints) {
    sentences.push(`Style guidance: ${form.styleHints}`);
  }

  return [...sentences, "", "Brief:", brief].join("\n");
}
```

### Text Selection Context (Step 8)

- Use `window.getSelection()` to capture selected text
- Calculate line/character offsets from preview container
- Append context to message: `"[Lines 15-18] Selected: 'the quick brown fox' - Change this to..."`

### Document Sync (Step 7)

- Poll or use file watcher for document changes
- Debounce preview updates (300ms)
- Preserve scroll position on refresh

---

## Performance Considerations

- Virtualize long conversations (react-window)
- Memoize markdown parsing
- Debounce document analysis scoring
- Lazy load Word export library

---

## Accessibility Requirements

- All interactive elements keyboard accessible
- ARIA labels on custom controls
- Focus management in conversation flow
- Respect `prefers-reduced-motion`
- Color contrast AA minimum

---

## Git Workflow

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- Branch naming: `feature/project-selector`, `fix/markdown-parsing`
- PR required for main branch
- Tests must pass before merge
