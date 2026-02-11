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

1. **Node.js 18+** and pnpm (via Corepack recommended)
2. **OpenCode server** running on `http://localhost:9090`

### Installation

```bash
# Install dependencies
pnpm install
```

### Running the Development Environment

**Unified Development Server Manager (Recommended)**

Use the `dev-server.sh` script to manage both OpenCode and Next.js servers:

```bash
# Start both services in a detached tmux session
./dev-server.sh start

# Check status of both services
./dev-server.sh status

# Attach to the tmux session
./dev-server.sh attach

# Stop all services
./dev-server.sh stop
```

This creates a tmux session with two windows (each fullscreen):

- **Window 0**: OpenCode server (port 9090)
- **Window 1**: Next.js dev server (port 3000)

**tmux keyboard shortcuts:**

- `Ctrl+b` then `n` - Next window
- `Ctrl+b` then `p` - Previous window
- `Ctrl+b` then `0` - Window 0 (OpenCode)
- `Ctrl+b` then `1` - Window 1 (Next.js)
- `Ctrl+b` then `[` - Scroll mode (press `q` to exit)
- `Ctrl+b` then `d` - Detach from session (keeps running in background)

Open [http://localhost:3000](http://localhost:3000) to access the application.

### Environment Variables

This project uses **service-specific environment files** for clean separation between containers:

**OpenCode Server** (`.env.opencode.local`):

```env
OPENCODE_SERVER_USERNAME=quillbot-opencode-api
OPENCODE_SERVER_PASSWORD=0M3ed8tRJI2pPasg6qH939WU
AZURE_RESOURCE_NAME=
AZURE_API_KEY=
OPENCODE_ENABLE_EXA=1
```

**Next.js Web Server** (`.env.web.local`):

```env
OPENCODE_API_URL=http://localhost:9090
OPENCODE_SERVER_USERNAME=quillbot-opencode-api
OPENCODE_SERVER_PASSWORD=0M3ed8tRJI2pPasg6qH939WU
EASY_AUTH_DEV_USER=your.email@company.com|Your Name
AZURE_RESOURCE_NAME=
AZURE_API_KEY=
```

**Setup:**

1. Copy `.env.opencode.example` → `.env.opencode.local`
2. Copy `.env.web.example` → `.env.web.local`
3. Fill in your credentials (both files need matching auth credentials)

**Note:** Credentials must match between OpenCode server and web client for authentication to work.

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

# Azure OpenAI / Foundry provider
export AZURE_RESOURCE_NAME=
export AZURE_API_KEY=

# Start the stack
docker compose up --build
```

Open the UI at [http://localhost:3000](http://localhost:3000).

### Notes

- Bind mount location: `./data` on host → `/app/data` in both containers
- OpenCode config: `./opencode-config` on host → `/app/.config/opencode`
- Keep secrets in environment variables; do not store token-bearing auth files in `opencode-config`
- Web Dockerfile: `containers/web/Dockerfile`
- Configure Azure provider credentials (`AZURE_API_KEY`, `AZURE_RESOURCE_NAME`) in
  the `opencode` service environment.

## Azure Deployment

An Azure Container Apps deployment pipeline is available in
`.github/workflows/azure-container-apps.yml` with infra definitions in
`infra/azure/main.bicep`. See `infra/azure/README.md` for required secrets,
variables, and config upload steps.

### Authentication (Azure Easy Auth)

The deployed app uses **Azure Easy Auth** with Microsoft Entra ID for SSO:

- **Configuration**: Managed via Azure Portal (not IaC)
- **App Registration**: `quillbot-sso`
- **Tenant**: LoopUp single-tenant

#### How It Works

1. Azure intercepts unauthenticated requests and redirects to Microsoft login
2. After login, Azure injects user identity via HTTP headers:
   - `X-MS-CLIENT-PRINCIPAL-NAME` - User's email
   - `X-MS-CLIENT-PRINCIPAL-ID` - User's Entra ID object ID
   - `X-MS-CLIENT-PRINCIPAL` - Base64-encoded claims
3. The app reads these headers via `getEasyAuthUser()` in `src/lib/auth.ts`

#### Setup After Fresh Deployment

If the Container App is deleted and recreated, you must reconfigure auth:

1. **Container Apps > quillbot > Settings > Authentication**
2. Click **Add identity provider** > **Microsoft**
3. Select **Pick an existing app registration** > `quillbot-sso`
4. Save

#### Local Development

Set `EASY_AUTH_DEV_USER` in `.env.local` to simulate an authenticated user:

```env
EASY_AUTH_DEV_USER=your.email@company.com|Your Name
```

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

# Run tests
pnpm test

# Run single test file
pnpm test -- path/to/test.spec.ts

# Watch mode
pnpm test -- --watch
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

## Agent-Chat Packages

This project uses internal `@agent-chat/*` workspace packages from `packages/*`. See [AGENT_CHAT_PACKAGES.md](./AGENT_CHAT_PACKAGES.md) for:

- Package management workflow
- Update procedures
- 3-phase deployment pipeline
- Troubleshooting

## License

MIT

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [OpenCode Documentation](https://github.com/ohmyopencode/opencode)
- [Tailwind CSS](https://tailwindcss.com/docs)
