# LoopUp QuillBot - Content Authoring Platform

> Web UI frontend for OpenCode-powered content authoring with marketing/copywriter agents.

A content authoring platform that connects to a headless OpenCode server, guiding users through a curated content creation journey with real-time markdown preview, inline editing, and project persistence.

## Features

- **Project Management**: Create, select, and delete content projects
- **AI-Powered Content Creation**: Integrated OpenCode conversation interface
- **File System Collaboration**: OpenCode has direct filesystem access to project directories
- **Real-Time Preview**: Live markdown rendering with file watching
- **Multi-File Support**: File explorer with automatic markdown detection
- **Inline Editing**: Edit documents directly in browser when AI is idle
- **Content Analysis**: Readability scoring and brief adherence metrics
- **Export Options**: Download as markdown or Word document
- **Project Persistence**: Resume any project at any time

## Getting Started

### Prerequisites

1. **Node.js 18+** and npm/yarn/pnpm
2. **OpenCode server** running on `http://localhost:9090`

### Installation

```bash
# Install dependencies
npm install

# Start OpenCode server (in separate terminal)
opencode serve --port 9090

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

### Environment Variables

Create a `.env.local` file in the root directory:

```env
OPENCODE_API_URL=http://localhost:9090
OPENCODE_API_KEY=                    # Optional
```

## Docker Deployment

This project ships with a two-container Docker setup:

- **OpenCode headless** (`opencode`) - runs the OpenCode server
- **Web UI** (`web`) - Next.js frontend + API routes

Project metadata and generated marketing content are persisted on the host
via a bind mount to `./data`, shared between both containers at `/app/data`.
OpenCode config is sourced from `./opencode-config` and mounted to
`/app/.config/opencode` for isolated authentication.

### Quick Start

```bash
# Optional: choose a different OpenCode image
export OPENCODE_IMAGE=ghcr.io/ohmyopencode/opencode:latest

# Optional: API key if your OpenCode server enforces auth
export OPENCODE_API_KEY=

# Start the stack
docker compose up --build
```

Open the UI at [http://localhost:3000](http://localhost:3000).

### Notes

- Bind mount location: `./data` on host → `/app/data` in both containers
- OpenCode config: `./opencode-config` on host → `/app/.config/opencode`
- Web Dockerfile: `containers/web/Dockerfile`
- If your OpenCode server needs provider keys (e.g. Anthropic/OpenAI), add them
  to the `opencode` service environment in `docker-compose.yml`.

## Azure Deployment

An Azure Container Apps deployment pipeline is available in
`.github/workflows/azure-container-apps.yml` with infra definitions in
`infra/azure/main.bicep`. See `infra/azure/README.md` for required secrets,
variables, and config upload steps.

## Usage

### Creating a Project

1. Click "New Project" on the home page
2. Enter project name and content specifications:
   - **Content Type**: Blog, White Paper, Social Post, Email
   - **Word Count**: Target length (500-5000 words)
   - **Style Hints**: Optional tone/style guidance
   - **Brief**: Main instructions and requirements
3. Submit to create project and start OpenCode conversation

### Content Creation Workflow

1. **Initial Prompt**: OpenCode automatically receives your brief and creates `draft.md`
2. **File System Integration**: All files created by OpenCode appear in File Explorer
3. **Live Preview**: Markdown files automatically sync to preview panel
4. **Conversation**: Continue refining content through natural language
5. **Manual Editing**: Edit files directly in browser when needed
6. **Analysis**: Monitor readability score and word count in real-time
7. **Export**: Download final content as markdown or Word document

### Project Structure

Each project creates a dedicated directory:

```
data/projects/{projectId}/
├── README.md          # Auto-generated project brief
├── draft.md           # Main content file (created by OpenCode)
└── ...                # Additional files as needed
```

## Development

### Build Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Format code
npm run format

# Run tests
npm test

# Run single test file
npm test -- path/to/test.spec.ts

# Watch mode
npm test -- --watch
```

### Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **State**: Zustand
- **API**: Server Actions + REST
- **Markdown**: react-markdown with remark/rehype
- **Testing**: Vitest + React Testing Library
- **Export**: docx for Word generation

## Architecture

### Key Components

- **Project Selector**: Browse and manage projects
- **Conversation Panel**: Chat interface with OpenCode
- **File Explorer**: View project files with real-time updates
- **Markdown Preview**: Live rendering with scroll sync
- **Analysis Panel**: Readability metrics and word count

### Data Flow

```
User creates project
  ↓
Next.js creates: data/projects/{projectId}/
  ↓
User sends message → OpenCode (with directory access)
  ↓
OpenCode creates/edits files in project directory
  ↓
File watcher polls directory (2sec interval)
  ↓
UI updates: File Explorer + Preview refresh
```

### API Routes

- `POST /api/projects` - Create project
- `GET /api/projects` - List projects
- `DELETE /api/projects/[id]` - Delete project + session + files
- `POST /api/opencode/message` - Send message to OpenCode
- `GET /api/projects/[id]/files` - List files in project
- `GET /api/projects/[id]/files?path=...` - Read specific file

## Project Guidelines

### Code Style

- **Strict TypeScript**: No `any`, explicit return types
- **Component Structure**: Hooks first, handlers next, render last
- **Error Handling**: Result types over exceptions
- **Naming**: PascalCase components, camelCase functions, kebab-case files

### Testing

- Focus on user behavior, not implementation
- Use Testing Library queries (`getByRole`, `getByText`)
- Integration tests for critical flows
- Mock external services (OpenCode API)

## Contributing

See [AGENTS.md](./AGENTS.md) for detailed development guidelines and architecture decisions.

## License

MIT

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [OpenCode Documentation](https://github.com/ohmyopencode/opencode)
- [Tailwind CSS](https://tailwindcss.com/docs)
