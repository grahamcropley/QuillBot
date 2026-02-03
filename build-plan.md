# Build Plan - LoopUp QuillBot

> Epic breakdown and story tickets for the Content Authoring Platform.

---

## Epic 1: Project Foundation

### 1.1 Project Scaffolding
**Priority**: P0 | **Estimate**: 2 points

**Description**: Initialize Next.js 14+ project with TypeScript, Tailwind CSS, and core dependencies.

**Acceptance Criteria**:
- [ ] Next.js App Router project initialized
- [ ] TypeScript strict mode enabled
- [ ] Tailwind CSS configured with design tokens
- [ ] ESLint + Prettier configured
- [ ] Vitest + React Testing Library setup
- [ ] Path aliases configured (`@/components`, `@/lib`, etc.)
- [ ] Basic folder structure created per AGENTS.md

**Dependencies**: None

---

### 1.2 Core Type Definitions
**Priority**: P0 | **Estimate**: 1 point

**Description**: Define TypeScript interfaces and types for the domain model.

**Acceptance Criteria**:
- [ ] `Project` interface (id, name, contentType, createdAt, updatedAt, status)
- [ ] `ContentType` union type (blog, white-paper, social-post, email)
- [ ] `Message` interface (id, role, content, timestamp)
- [ ] `StarterForm` interface (contentType, wordCount, styleHints, brief)
- [ ] `DocumentAnalysis` interface (readabilityScore, briefAdherence, wordCount)
- [ ] `Result<T, E>` utility type for error handling

**Dependencies**: 1.1

---

### 1.3 Zustand Store Setup
**Priority**: P0 | **Estimate**: 2 points

**Description**: Create global state management with Zustand stores.

**Acceptance Criteria**:
- [ ] `useProjectStore` - project list, current project, CRUD operations
- [ ] `useConversationStore` - message history, streaming state
- [ ] `useDocumentStore` - document content, edit mode, sync status
- [ ] `useUIStore` - sidebar state, modal visibility, notifications
- [ ] Persistence middleware for project data (localStorage initially)

**Dependencies**: 1.2

---

## Epic 2: Project Management

### 2.1 Project Selection Page
**Priority**: P0 | **Estimate**: 3 points

**Description**: Landing page showing existing projects and option to create new.

**Acceptance Criteria**:
- [ ] Grid/list of existing projects with name, type, last updated
- [ ] "New Project" button prominently displayed
- [ ] Search/filter projects by name
- [ ] Sort by date (newest first default)
- [ ] Click project → navigate to `/project/[id]`
- [ ] Empty state for first-time users
- [ ] Responsive layout (mobile: single column)

**Dependencies**: 1.3

---

### 2.2 Create Project Modal
**Priority**: P0 | **Estimate**: 2 points

**Description**: Modal dialog to create a new project with name input.

**Acceptance Criteria**:
- [ ] Modal opens from "New Project" button
- [ ] Project name input (required, min 3 chars)
- [ ] Name uniqueness validation
- [ ] Create button disabled until valid
- [ ] On create → project added to store → navigate to starter form
- [ ] Cancel/close returns to project list
- [ ] Keyboard accessible (Escape to close, Enter to submit)

**Dependencies**: 2.1

---

### 2.3 Project Persistence Layer
**Priority**: P1 | **Estimate**: 3 points

**Description**: Persist projects to backend storage (initially localStorage, later API).

**Acceptance Criteria**:
- [ ] Projects survive page refresh
- [ ] Conversation history persisted per project
- [ ] Document content persisted per project
- [ ] Abstract storage interface for future backend migration
- [ ] Auto-save on state changes (debounced)

**Dependencies**: 1.3

---

## Epic 3: Content Starter Form

### 3.1 Starter Form UI
**Priority**: P0 | **Estimate**: 3 points

**Description**: Form to configure content type, length, style, and brief.

**Acceptance Criteria**:
- [ ] Content Type selector (radio/select): Blog, White Paper, Social Post, Email
- [ ] Word Count input (number input or preset buttons: 500, 1000, 2000, custom)
- [ ] Style Hints textarea (optional, placeholder with examples)
- [ ] Brief textarea (required, rich text optional)
- [ ] Form validation with inline error messages
- [ ] "Start Writing" submit button
- [ ] Form state persisted to project

**Dependencies**: 2.1

---

### 3.2 Prompt Builder Utility
**Priority**: P0 | **Estimate**: 2 points

**Description**: Transform form selections into augmented prompt for OpenCode.

**Acceptance Criteria**:
- [ ] `buildPrompt(form: StarterForm): string` function
- [ ] Prepends content type instruction
- [ ] Prepends word count target
- [ ] Prepends style hints if provided
- [ ] Appends brief with clear delimiter
- [ ] Unit tests for all content type combinations

**Example Output**:
```
Create a blog post with approximately 1500 words.
Style guidance: Professional but approachable, use subheadings.

Brief:
[User's brief content here]
```

**Dependencies**: 1.2

---

## Epic 4: OpenCode Integration

### 4.1 OpenCode API Client
**Priority**: P0 | **Estimate**: 3 points

**Description**: Client library to communicate with headless OpenCode server.

**Acceptance Criteria**:
- [ ] `OpenCodeClient` class with configurable base URL
- [ ] `startSession(projectId: string)` - initialize conversation
- [ ] `sendMessage(message: string)` - send user message
- [ ] `getStatus()` - check if OpenCode is processing
- [ ] Error handling with Result type
- [ ] Request/response logging for debugging

**Dependencies**: 1.2

---

### 4.2 API Route Proxy
**Priority**: P0 | **Estimate**: 2 points

**Description**: Next.js API routes to proxy OpenCode requests (avoid CORS).

**Acceptance Criteria**:
- [ ] `POST /api/opencode/message` - send message, return response
- [ ] `GET /api/opencode/status` - check processing status
- [ ] `GET /api/opencode/stream` - SSE endpoint for streaming responses
- [ ] Environment variable for OpenCode server URL
- [ ] Request validation with Zod

**Dependencies**: 4.1

---

### 4.3 Streaming Response Hook
**Priority**: P0 | **Estimate**: 3 points

**Description**: React hook to handle SSE streaming from OpenCode.

**Acceptance Criteria**:
- [ ] `useOpenCodeStream()` hook
- [ ] Connect to SSE endpoint
- [ ] Buffer and parse streaming chunks
- [ ] Update conversation store in real-time
- [ ] Handle connection errors with retry
- [ ] Cleanup on unmount
- [ ] Expose `isStreaming`, `error`, `reconnect` states

**Dependencies**: 4.2

---

## Epic 5: Conversation Interface

### 5.1 Conversation Panel UI
**Priority**: P0 | **Estimate**: 3 points

**Description**: Chat-style interface for user/assistant message exchange.

**Acceptance Criteria**:
- [ ] Message list with user/assistant styling
- [ ] Auto-scroll to latest message
- [ ] Timestamp display on messages
- [ ] Loading indicator during streaming
- [ ] Message input with send button
- [ ] Shift+Enter for newlines, Enter to send
- [ ] Disable input while OpenCode is processing

**Dependencies**: 4.3, 1.3

---

### 5.2 Message Input with Context
**Priority**: P1 | **Estimate**: 2 points

**Description**: Enhanced message input that can include document context.

**Acceptance Criteria**:
- [ ] Display "Replying to selection: [preview]" when text selected
- [ ] Clear selection context button
- [ ] Context automatically prepended to message
- [ ] Format: `[Lines X-Y] "selected text" - user message`
- [ ] Character limit indicator

**Dependencies**: 5.1, 6.3

---

### 5.3 Conversation History
**Priority**: P1 | **Estimate**: 2 points

**Description**: Persist and display full conversation history.

**Acceptance Criteria**:
- [ ] All messages stored in project
- [ ] Scroll up to view history
- [ ] Virtualized list for long conversations (100+ messages)
- [ ] "Jump to latest" button when scrolled up
- [ ] Clear conversation option (with confirmation)

**Dependencies**: 5.1, 2.3

---

## Epic 6: Document Preview & Editing

### 6.1 Markdown Preview Panel
**Priority**: P0 | **Estimate**: 3 points

**Description**: Real-time rendered markdown preview of the document.

**Acceptance Criteria**:
- [ ] react-markdown with GFM support
- [ ] Syntax highlighting for code blocks
- [ ] Proper heading hierarchy styling
- [ ] Table rendering
- [ ] Image display (if URLs provided)
- [ ] Scroll position preserved on updates
- [ ] Responsive width

**Dependencies**: 1.1

---

### 6.2 Document Sync Hook
**Priority**: P0 | **Estimate**: 3 points

**Description**: Keep preview in sync with document changes from OpenCode.

**Acceptance Criteria**:
- [ ] `useDocumentSync(projectId)` hook
- [ ] Poll for document changes (configurable interval, default 500ms)
- [ ] Debounce updates to prevent flicker
- [ ] Diff detection to avoid unnecessary re-renders
- [ ] "Last updated" timestamp display
- [ ] Visual indicator when document is updating

**Dependencies**: 4.1, 6.1

---

### 6.3 Text Selection Handler
**Priority**: P1 | **Estimate**: 2 points

**Description**: Capture text selection in preview for contextual feedback.

**Acceptance Criteria**:
- [ ] `useTextSelection()` hook
- [ ] Capture selected text via `window.getSelection()`
- [ ] Calculate line numbers from preview DOM
- [ ] Calculate character offsets
- [ ] Return `{ text, startLine, endLine, startChar, endChar }`
- [ ] Clear selection on click outside
- [ ] Visual highlight on selected text

**Dependencies**: 6.1

---

### 6.4 Direct Document Editor
**Priority**: P1 | **Estimate**: 4 points

**Description**: In-browser markdown editor for direct document editing.

**Acceptance Criteria**:
- [ ] Monaco Editor or CodeMirror integration
- [ ] Markdown syntax highlighting
- [ ] Only enabled when OpenCode is idle
- [ ] Toggle between preview and edit modes
- [ ] Auto-save with debounce (1s)
- [ ] Unsaved changes indicator
- [ ] "Discard changes" option
- [ ] Sync edited content back to OpenCode context

**Dependencies**: 6.2

---

### 6.5 Edit/Review Mode Toggle
**Priority**: P1 | **Estimate**: 2 points

**Description**: UI to switch between preview and edit modes with status awareness.

**Acceptance Criteria**:
- [ ] "Edit Document" button (disabled if OpenCode active)
- [ ] "Done Editing" button to exit edit mode
- [ ] Prompt to save unsaved changes on exit
- [ ] After editing, prompt to have OpenCode review changes
- [ ] Visual mode indicator (viewing vs editing)

**Dependencies**: 6.4

---

## Epic 7: Document Analysis

### 7.1 Readability Scoring
**Priority**: P2 | **Estimate**: 3 points

**Description**: Calculate and display readability metrics.

**Acceptance Criteria**:
- [ ] Flesch-Kincaid readability score
- [ ] Flesch Reading Ease score
- [ ] Average sentence length
- [ ] Average word length
- [ ] Score displayed as gauge/progress bar
- [ ] Target range indicator based on content type
- [ ] Recalculate on document change (debounced)

**Dependencies**: 6.2

---

### 7.2 Brief Adherence Analysis
**Priority**: P2 | **Estimate**: 3 points

**Description**: Analyze how well the document matches the original brief.

**Acceptance Criteria**:
- [ ] Extract key topics/keywords from brief
- [ ] Check topic coverage in document
- [ ] Word count vs target comparison
- [ ] Content type appropriateness signals
- [ ] Adherence percentage score
- [ ] List of missing/uncovered topics
- [ ] "Brief updated" indicator if user revised brief

**Dependencies**: 6.2, 3.1

---

### 7.3 Analysis Panel UI
**Priority**: P2 | **Estimate**: 2 points

**Description**: Collapsible panel displaying document analysis metrics.

**Acceptance Criteria**:
- [ ] Collapsible sidebar or bottom panel
- [ ] Readability score with interpretation (e.g., "College level")
- [ ] Brief adherence percentage with breakdown
- [ ] Word count (current / target)
- [ ] Reading time estimate
- [ ] Refresh button for manual recalculation
- [ ] Expandable sections for detail

**Dependencies**: 7.1, 7.2

---

## Epic 8: Export Functionality

### 8.1 Markdown Export
**Priority**: P1 | **Estimate**: 1 point

**Description**: Download document as markdown file.

**Acceptance Criteria**:
- [ ] "Download as Markdown" button
- [ ] Filename: `{project-name}.md`
- [ ] Proper MIME type (`text/markdown`)
- [ ] Include frontmatter with metadata (optional toggle)

**Dependencies**: 6.2

---

### 8.2 Word Document Export
**Priority**: P1 | **Estimate**: 3 points

**Description**: Export document as .docx Word file.

**Acceptance Criteria**:
- [ ] "Download as Word" button
- [ ] Use `docx` library for generation
- [ ] Preserve heading hierarchy
- [ ] Preserve bold/italic/links
- [ ] Basic table support
- [ ] Filename: `{project-name}.docx`
- [ ] Lazy load docx library (code splitting)

**Dependencies**: 6.2

---

### 8.3 Export Options Modal
**Priority**: P2 | **Estimate**: 2 points

**Description**: Modal with export format options and settings.

**Acceptance Criteria**:
- [ ] Format selection (Markdown, Word, PDF future)
- [ ] Include metadata toggle
- [ ] Include conversation history toggle (for reference)
- [ ] Preview filename
- [ ] "Export" button triggers download

**Dependencies**: 8.1, 8.2

---

## Epic 9: Layout & Navigation

### 9.1 Main Application Layout
**Priority**: P0 | **Estimate**: 3 points

**Description**: Responsive layout for the authoring interface.

**Acceptance Criteria**:
- [ ] Three-column layout: Conversation | Preview | Analysis
- [ ] Resizable panels (drag handles)
- [ ] Collapsible sidebars
- [ ] Mobile: stacked layout with tab navigation
- [ ] Header with project name and navigation
- [ ] Persistent "Back to Projects" link

**Dependencies**: 1.1

---

### 9.2 Navigation & Routing
**Priority**: P0 | **Estimate**: 2 points

**Description**: App routing structure with proper navigation.

**Acceptance Criteria**:
- [ ] `/` - Project selection
- [ ] `/project/[id]` - Main authoring interface
- [ ] `/project/[id]/settings` - Project settings (future)
- [ ] 404 handling for invalid project IDs
- [ ] Breadcrumb navigation
- [ ] Browser back/forward support

**Dependencies**: 1.1

---

### 9.3 Notification System
**Priority**: P2 | **Estimate**: 2 points

**Description**: Toast notifications for user feedback.

**Acceptance Criteria**:
- [ ] Success/error/info/warning variants
- [ ] Auto-dismiss with configurable duration
- [ ] Manual dismiss option
- [ ] Stack multiple notifications
- [ ] Position: top-right or bottom-right
- [ ] Accessible announcements (aria-live)

**Dependencies**: 1.3

---

## Epic 10: Polish & Production

### 10.1 Loading States
**Priority**: P1 | **Estimate**: 2 points

**Description**: Skeleton loaders and loading indicators throughout.

**Acceptance Criteria**:
- [ ] Project list skeleton
- [ ] Conversation loading indicator
- [ ] Document preview skeleton
- [ ] Analysis panel skeleton
- [ ] Full-page loading for initial load
- [ ] Consistent loading animation

**Dependencies**: All UI epics

---

### 10.2 Error Boundaries
**Priority**: P1 | **Estimate**: 2 points

**Description**: Graceful error handling with recovery options.

**Acceptance Criteria**:
- [ ] Root error boundary with fallback UI
- [ ] Panel-level error boundaries (conversation, preview, analysis)
- [ ] "Retry" action on errors
- [ ] Error logging to console (future: monitoring)
- [ ] User-friendly error messages

**Dependencies**: 1.1

---

### 10.3 Keyboard Shortcuts
**Priority**: P2 | **Estimate**: 2 points

**Description**: Power-user keyboard shortcuts.

**Acceptance Criteria**:
- [ ] `Cmd/Ctrl + Enter` - Send message
- [ ] `Cmd/Ctrl + E` - Toggle edit mode
- [ ] `Cmd/Ctrl + S` - Save document
- [ ] `Cmd/Ctrl + Shift + E` - Export menu
- [ ] `Escape` - Close modals, exit edit mode
- [ ] Shortcut hints in tooltips
- [ ] Help modal listing all shortcuts (`?`)

**Dependencies**: All UI epics

---

### 10.4 Accessibility Audit
**Priority**: P1 | **Estimate**: 3 points

**Description**: Ensure WCAG 2.1 AA compliance.

**Acceptance Criteria**:
- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible
- [ ] Color contrast meets AA (4.5:1 text, 3:1 UI)
- [ ] Screen reader testing (VoiceOver, NVDA)
- [ ] ARIA labels on custom components
- [ ] Reduced motion support
- [ ] Fix any axe-core violations

**Dependencies**: All UI epics

---

## Implementation Order (Suggested)

### Phase 1: Foundation (Week 1)
1. 1.1 Project Scaffolding
2. 1.2 Core Type Definitions
3. 1.3 Zustand Store Setup
4. 9.1 Main Application Layout

### Phase 2: Project Flow (Week 2)
5. 2.1 Project Selection Page
6. 2.2 Create Project Modal
7. 3.1 Starter Form UI
8. 3.2 Prompt Builder Utility
9. 9.2 Navigation & Routing

### Phase 3: OpenCode Integration (Week 3)
10. 4.1 OpenCode API Client
11. 4.2 API Route Proxy
12. 4.3 Streaming Response Hook
13. 5.1 Conversation Panel UI

### Phase 4: Document Experience (Week 4)
14. 6.1 Markdown Preview Panel
15. 6.2 Document Sync Hook
16. 6.3 Text Selection Handler
17. 5.2 Message Input with Context

### Phase 5: Editing & Persistence (Week 5)
18. 6.4 Direct Document Editor
19. 6.5 Edit/Review Mode Toggle
20. 2.3 Project Persistence Layer
21. 5.3 Conversation History

### Phase 6: Analysis & Export (Week 6)
22. 7.1 Readability Scoring
23. 7.2 Brief Adherence Analysis
24. 7.3 Analysis Panel UI
25. 8.1 Markdown Export
26. 8.2 Word Document Export

### Phase 7: Polish (Week 7)
27. 10.1 Loading States
28. 10.2 Error Boundaries
29. 9.3 Notification System
30. 8.3 Export Options Modal
31. 10.3 Keyboard Shortcuts
32. 10.4 Accessibility Audit

---

## Notes

- **MVP Scope**: Epics 1-6 + 8.1 + 9.1-9.2 = Functional end-to-end experience
- **P0 tickets** must be completed before demo
- **P2 tickets** are nice-to-have for v1.0
- Estimates in story points (1 point ≈ 0.5 day for single developer)
- Each ticket should have tests before marked complete
