# Research: Ensuring OpenCode Always Writes to Files (Not Text Responses)

> **Problem**: OpenCode sometimes responds with content in chat messages instead of writing to files, causing content to be "lost" in the conversation rather than appearing in the file preview.

> **Goal**: Force OpenCode to ALWAYS use `write_file` tool for content and NEVER respond with content as plain text.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Understanding the Problem](#understanding-the-problem)
3. [OpenCode Architecture & Tool System](#opencode-architecture--tool-system)
4. [Solution 1: Anthropic `tool_choice` Parameter](#solution-1-anthropic-tool_choice-parameter)
5. [Solution 2: System Prompt Engineering](#solution-2-system-prompt-engineering)
6. [Solution 3: AGENTS.md Instructions](#solution-3-agentsmd-instructions)
7. [Solution 4: Custom Commands/Slash Commands](#solution-4-custom-commandsslash-commands)
8. [Solution 5: Response Validation & Detection](#solution-5-response-validation--detection)
9. [Solution 6: Model Selection](#solution-6-model-selection)
10. [Recommended Implementation Strategy](#recommended-implementation-strategy)
11. [Code Examples](#code-examples)
12. [Testing & Validation](#testing--validation)

---

## Executive Summary

### Key Findings

1. **Root Cause**: LLMs default to text responses. Tools are optional unless explicitly forced.
2. **Primary Solution**: Use Anthropic's `tool_choice` parameter with strategic prompting
3. **Secondary Defense**: Multi-layer enforcement via system prompts, AGENTS.md, and validation
4. **Detection Strategy**: Implement response validation to catch and retry text-only responses

### Quick Wins

- ✅ Add `tool_choice: { type: "any" }` to force tool usage
- ✅ Update system prompt with explicit "NEVER respond with content" rules
- ✅ Add validation layer to detect content-in-message responses
- ✅ Enhance AGENTS.md with clear file-writing instructions

---

## Understanding the Problem

### Why This Happens

LLMs (including Claude) have a natural tendency to:
1. **Respond conversationally** by default
2. **Include content inline** when asked to create something
3. **Treat tools as optional** unless explicitly required

### Example Failure Pattern

```
User: "Write a blog post about Microsoft Teams"

❌ BAD (Current Behavior):
Assistant: "Here's your blog post:

# Microsoft Teams Update

Microsoft Teams keeps evolving fast...
[500 words of content in chat]
"

✅ GOOD (Desired Behavior):
Assistant: [Uses write_file tool]
Tool Call: write({ path: "draft.md", content: "..." })
"I've created draft.md with your blog post about Microsoft Teams."
```

### Impact

- Content gets lost in conversation history
- Users don't see content in preview panel
- File system remains empty
- Poor user experience

---

## OpenCode Architecture & Tool System

### How OpenCode Tools Work

1. **Tool Definition**: OpenCode provides tools like `write`, `read`, `edit`, `bash`, etc.
2. **Tool Availability**: Tools are always available to the model during conversation
3. **Tool Selection**: Model decides whether to use tools OR respond with text
4. **Tool Execution**: When tool is called, OpenCode executes it and returns result

### Current QuillBot Flow

```
User submits prompt
    ↓
Next.js API Route receives request
    ↓
Call OpenCode API with message
    ↓
OpenCode/Claude processes request
    ↓
    ├─→ Option A: Uses write_file tool ✅
    │   └─→ File appears in preview
    │
    └─→ Option B: Responds with text ❌
        └─→ Content lost in chat
```

---

## Solution 1: Anthropic `tool_choice` Parameter

### Overview

Anthropic's Claude API supports a `tool_choice` parameter that forces the model to use tools.

### Available Options

```typescript
// 1. AUTO (default) - Model decides
tool_choice: { type: "auto" }

// 2. ANY - Model MUST use one of the provided tools
tool_choice: { type: "any" }

// 3. TOOL - Model MUST use a specific tool
tool_choice: { 
  type: "tool", 
  name: "write_file" 
}
```

### Recommended Approach: Hybrid Strategy

**Don't use `tool_choice: { type: "tool", name: "write_file" }` exclusively** - this would prevent Claude from using other essential tools like `read`, `edit`, `grep`, etc.

**Instead, use context-aware tool_choice:**

```typescript
function getToolChoice(messageContext: MessageContext): ToolChoice {
  // For initial content creation, strongly encourage file writing
  if (messageContext.isInitialRequest && messageContext.expectsContent) {
    return { type: "any" }; // Must use a tool
  }
  
  // For revisions, allow flexibility
  if (messageContext.isRevision) {
    return { type: "auto" }; // Can use tools or respond
  }
  
  // Default: encourage tools but don't force
  return { type: "auto" };
}
```

### Implementation in QuillBot

Update `app/api/opencode/message/route.ts`:

```typescript
// Determine if this is a content creation request
const isContentCreation = detectContentCreation(message);

const response = await client.session.prompt({
  sessionID: sessionId,
  parts: [{ type: "text", text: message }],
  // Add tool_choice when appropriate
  ...(isContentCreation && {
    tool_choice: { type: "any" } // Force tool usage
  })
});
```

### Limitations

- ⚠️ **OpenCode Proxy**: Check if OpenCode server exposes `tool_choice` parameter
- ⚠️ **Model Support**: Only works with Claude 3+ models
- ⚠️ **Over-restriction**: Could prevent helpful clarifying questions

---

## Solution 2: System Prompt Engineering

### Principle

Clear, explicit instructions in the system prompt can guide model behavior strongly.

### Effective Prompt Patterns

#### Pattern 1: Prohibition + Rationale

```markdown
CRITICAL FILE-WRITING RULE:

You are working on a content authoring platform where users view content
in a live preview panel. Content ONLY appears in the preview when written
to files.

NEVER respond with content directly in chat messages. 
NEVER write draft content inline in your response.
ALWAYS use the write_file tool to create content.

Why: Content in chat messages is invisible to the user. They only see
content that exists in files. If you respond with content instead of 
writing to a file, the content is lost.
```

#### Pattern 2: Explicit Workflow

```markdown
When creating content:

1. Use the write_file tool to create draft.md
2. Write the full content to the file
3. After the tool completes, respond with: "I've created draft.md with [brief description]"

INCORRECT:
❌ "Here's your blog post: [content]"

CORRECT:
✅ [Uses write_file tool]
✅ "I've created draft.md with a 500-word blog post about Microsoft Teams"
```

#### Pattern 3: Role-Based Instructions

```markdown
You are a content authoring assistant with FILE-SYSTEM ACCESS.

Your role is to CREATE FILES, not to respond with content.

Think of yourself as a file writer, not a message writer. Your output
goes to files, not to chat.
```

### Implementation Location

Update `src/utils/prompt-builder.ts`:

```typescript
export function buildPrompt(formData: StarterFormData): string {
  const sentences: string[] = [];

  // Add CRITICAL file-writing instructions at the top
  sentences.push("## CRITICAL: File Writing Rules");
  sentences.push("");
  sentences.push("You are working on a content authoring platform. Users see content in a live preview panel.");
  sentences.push("");
  sentences.push("**ALWAYS write content to files using the write tool.**");
  sentences.push("**NEVER respond with draft content directly in chat messages.**");
  sentences.push("");
  sentences.push("Content in messages is invisible to users. Only content in files appears in their preview.");
  sentences.push("");
  sentences.push("---");
  sentences.push("");

  // Rest of existing prompt...
  sentences.push("## Instructions");
  // ... existing code
}
```

---

## Solution 3: AGENTS.md Instructions

### Purpose

AGENTS.md provides project-level context that OpenCode reads automatically. It's the perfect place for file-writing rules.

### Recommended AGENTS.md Section

Add to `/home/graham/github/QuillBot/AGENTS.md`:

```markdown
## File-First Content Creation

**CRITICAL RULE: All content MUST be written to files, never to chat messages.**

### Why This Matters

This is a web-based content authoring platform where:
- Users see content through a live markdown preview panel
- The preview panel watches the file system for changes
- Content in chat messages is **invisible** to users
- Only content in **files** appears in the UI

### How to Create Content

When asked to create or modify content:

1. ✅ **DO**: Use the `write` tool to create/update files
2. ✅ **DO**: Write complete content to `draft.md` or other specified files
3. ✅ **DO**: Respond with "I've created [filename]" after writing
4. ❌ **DON'T**: Include draft content in your chat response
5. ❌ **DON'T**: Say "Here's your content:" followed by inline text
6. ❌ **DON'T**: Ask "Would you like me to create a file?" - just do it

### Content Creation Workflow

```
User Request → Write to File → Confirm File Created
         ✅              ✅              ✅

NOT:
User Request → Generate Content in Message
         ❌              ❌
```

### Examples

#### ❌ WRONG:
```
User: "Write a blog post about AI"
Assistant: "Here's your blog post:

# The Future of AI

Artificial intelligence is transforming..."
```

#### ✅ CORRECT:
```
User: "Write a blog post about AI"
Assistant: [Calls write tool with content]
Assistant: "I've created draft.md with a 500-word blog post about AI, focusing on transformation and practical applications."
```

### File Naming Conventions

- Primary content: `draft.md`
- Project brief: `brief.md` (auto-created, update as needed)
- Additional files: Use descriptive names like `outline.md`, `research-notes.md`

### Tool Usage Priority

When in doubt about whether to use a tool or respond with text:
- **Content creation/editing**: ALWAYS use tools
- **Clarifying questions**: OK to use text
- **Confirmations**: OK to use text
- **Explanations**: OK to use text
- **Actual content**: NEVER use text, ALWAYS use tools
```

### Why AGENTS.md Works

- ✅ Automatically read by OpenCode at session start
- ✅ Provides persistent context across all messages
- ✅ Standard format recognized by many AI tools
- ✅ Easy to maintain and version control

### Limitations

- ⚠️ **Model Compliance**: Not all models follow AGENTS.md reliably
- ⚠️ **Context Window**: Can be deprioritized if conversation gets long
- ⚠️ **Not Enforced**: Instructions, not technical constraints

---

## Solution 4: Custom Commands/Slash Commands

### Overview

OpenCode supports custom slash commands that can enforce specific behaviors through structured prompts.

### Create `/write-content` Command

Create `.opencode/commands/write-content/COMMAND.md`:

```markdown
---
name: write-content
description: Create content and write to draft.md file (never respond with content inline)
---

# Write Content Command

You are being invoked via the `/write-content` command.

## MANDATORY BEHAVIOR

1. You MUST use the write tool to create content in a file
2. You MUST NOT respond with content directly in messages
3. You MUST write to `draft.md` unless specified otherwise

## Process

1. Read the user's request carefully
2. Determine the content type and requirements
3. Generate the full content
4. Use `write` tool to create/update the file
5. Respond with a brief confirmation (WITHOUT the content)

## Example Execution

User: "Write a 500-word blog post about cloud security"

Actions:
1. [Generate content internally]
2. [Call write tool]:
   ```
   write({
     path: "draft.md",
     content: "# Cloud Security Best Practices\n\n..."
   })
   ```
3. Respond: "I've created draft.md with a 500-word blog post covering cloud security best practices, including encryption, access control, and compliance."

## What NOT to do

❌ Don't say "Here's your blog post:" and include content
❌ Don't ask "Would you like me to save this to a file?"
❌ Don't generate content without writing to a file

## Remember

Users can ONLY see content that exists in files. Content in your message is invisible to them.
```

### Invoke Command Automatically

Update `src/utils/prompt-builder.ts`:

```typescript
export function buildPrompt(formData: StarterFormData): string {
  // Start with slash command invocation
  const sentences: string[] = ["/write-content"];
  sentences.push("");
  
  // Then add content specifications
  const contentTypeDesc = CONTENT_TYPE_DESCRIPTIONS[formData.contentType] || formData.contentType;
  sentences.push(`Create ${contentTypeDesc} with approximately ${formData.wordCount} words.`);
  
  // ... rest of prompt
}
```

### Benefits

- ✅ **Scoped Context**: Command-specific instructions are highly relevant
- ✅ **Reusable**: Can invoke manually or programmatically
- ✅ **Clear Intent**: Signals specific behavior expectations
- ✅ **Maintainable**: Separated from application code

---

## Solution 5: Response Validation & Detection

### Strategy

Detect when OpenCode responds with content instead of using tools, then retry with stronger constraints.

### Detection Patterns

```typescript
interface ContentDetectionResult {
  hasInlineContent: boolean;
  confidence: number;
  indicators: string[];
}

function detectInlineContent(response: string): ContentDetectionResult {
  const indicators: string[] = [];
  let score = 0;

  // Pattern 1: "Here's your [content type]:"
  if (/here'?s (your |the |a )?(blog post|article|content|draft)/i.test(response)) {
    indicators.push("intro_phrase");
    score += 30;
  }

  // Pattern 2: Markdown headings (likely content)
  const headingCount = (response.match(/^#{1,3}\s+.+$/gm) || []).length;
  if (headingCount >= 2) {
    indicators.push("multiple_headings");
    score += 25;
  }

  // Pattern 3: Long response without tool calls
  const wordCount = response.split(/\s+/).length;
  if (wordCount > 200) {
    indicators.push("long_response");
    score += 20;
  }

  // Pattern 4: Paragraph breaks (formatted content)
  const paragraphCount = (response.match(/\n\n+/g) || []).length;
  if (paragraphCount >= 3) {
    indicators.push("multiple_paragraphs");
    score += 15;
  }

  // Pattern 5: Content markers
  if (/^---$/m.test(response)) {
    indicators.push("markdown_frontmatter");
    score += 20;
  }

  return {
    hasInlineContent: score >= 50,
    confidence: Math.min(score, 100),
    indicators
  };
}
```

### Retry Logic

```typescript
async function sendToOpenCode(
  message: string,
  sessionId: string,
  attempt: number = 1
): Promise<OpenCodeResponse> {
  const response = await client.session.prompt({
    sessionID: sessionId,
    parts: [{ type: "text", text: message }],
    tool_choice: attempt > 1 ? { type: "any" } : { type: "auto" }
  });

  // Check if response contains tools
  const usedTools = response.data?.parts?.some(part => part.type === "tool");
  
  if (!usedTools && attempt < 3) {
    const detection = detectInlineContent(response.text);
    
    if (detection.hasInlineContent) {
      console.warn(`Detected inline content (confidence: ${detection.confidence}%), retrying with tool enforcement`);
      
      // Retry with stronger prompt
      const retryMessage = `IMPORTANT: Write the content to draft.md using the write tool. Do not include the content in your response message.\n\nOriginal request: ${message}`;
      
      return sendToOpenCode(retryMessage, sessionId, attempt + 1);
    }
  }

  return response;
}
```

### User Feedback

If detection fails after retries, show a warning:

```typescript
if (detectedInlineContent && !fileWasWritten) {
  showToast({
    type: "warning",
    title: "Content not saved to file",
    message: "The AI responded with content in chat instead of creating a file. Please ask again, or manually copy the content."
  });
}
```

---

## Solution 6: Model Selection

### Model Behavior Differences

Different models have varying tendencies to use tools vs respond with text:

| Model | Tool Use Tendency | Notes |
|-------|-------------------|-------|
| Claude 4.5 Sonnet | ⭐⭐⭐⭐⭐ | Best at following tool instructions |
| Claude 4 Opus | ⭐⭐⭐⭐ | Strong tool use, sometimes over-cautious |
| Claude 4 Sonnet | ⭐⭐⭐⭐ | Good balance |
| Claude 4 Haiku | ⭐⭐⭐ | Fast but may default to text |
| GPT-4 | ⭐⭐⭐ | Inconsistent tool use |
| GPT-4 Turbo | ⭐⭐⭐ | Better than GPT-4 |

### Recommendation

Configure OpenCode to use **Claude 4.5 Sonnet** or **Claude 4 Sonnet** for best tool compliance:

```json
// opencode.json or config
{
  "model": "anthropic/claude-sonnet-4-5",
  "mode": {
    "build": {
      "model": "anthropic/claude-sonnet-4-5"
    }
  }
}
```

---

## Recommended Implementation Strategy

### Phase 1: Quick Wins (1-2 hours)

1. ✅ **Update prompt-builder.ts**
   - Add critical file-writing instructions at top of prompt
   - Use explicit "NEVER respond with content" language

2. ✅ **Update AGENTS.md**
   - Add "File-First Content Creation" section
   - Include examples of correct vs incorrect behavior

3. ✅ **Test with current setup**
   - Verify if changes improve behavior
   - Document success rate

### Phase 2: Technical Enforcement (2-4 hours)

4. ✅ **Add tool_choice logic**
   - Implement context-aware tool_choice selection
   - Force `{ type: "any" }` for initial content requests

5. ✅ **Implement detection**
   - Add inline content detection function
   - Log when content is detected in messages

6. ✅ **Add retry logic**
   - Retry with stronger prompt if inline content detected
   - Limit to 2-3 retry attempts

### Phase 3: Advanced Features (4-6 hours)

7. ✅ **Create custom command**
   - Implement `/write-content` slash command
   - Auto-invoke for content creation requests

8. ✅ **Add user feedback**
   - Show toast notification if content not saved
   - Provide "retry" button in UI

9. ✅ **Analytics tracking**
   - Track tool usage vs text responses
   - Monitor success rates over time

### Phase 4: Optimization (Ongoing)

10. ✅ **A/B testing**
    - Test different prompt variations
    - Measure which approaches work best

11. ✅ **Model experimentation**
    - Test with different Claude versions
    - Document optimal model settings

12. ✅ **User feedback loop**
    - Collect user reports of "lost content"
    - Iterate on prompts and logic

---

## Code Examples

### Example 1: Enhanced Prompt Builder

```typescript
// src/utils/prompt-builder.ts
import type { StarterFormData } from "@/types";

const CONTENT_TYPE_DESCRIPTIONS: Record<string, string> = {
  blog: "a blog post",
  "white-paper": "a white paper",
  "social-post": "a social media post",
  email: "an email",
};

export function buildPrompt(formData: StarterFormData): string {
  const sentences: string[] = [];

  // === CRITICAL: File-Writing Instructions ===
  sentences.push("## CRITICAL: File Writing Rule");
  sentences.push("");
  sentences.push("You are working on a web-based content authoring platform.");
  sentences.push("");
  sentences.push("**ALWAYS write content to files using the write tool.**");
  sentences.push("**NEVER respond with draft content in chat messages.**");
  sentences.push("");
  sentences.push("Why: Users view content through a live preview panel that watches the file system.");
  sentences.push("Content in your messages is INVISIBLE to users. Only content in FILES appears in their UI.");
  sentences.push("");
  sentences.push("After writing to a file, respond with: 'I've created [filename]' - do NOT include the content.");
  sentences.push("");
  sentences.push("---");
  sentences.push("");

  // === Instructions ===
  sentences.push("## Instructions");
  sentences.push("");
  sentences.push(
    "You are working on a content authoring project. The project directory contains a `brief.md` file with the initial requirements.",
  );
  sentences.push("");
  sentences.push(
    "**Important**: As our conversation progresses and the requirements become clearer or more refined, please UPDATE the `brief.md` file to reflect the current, refined understanding of what needs to be created. This ensures the brief stays accurate and useful as a reference throughout the project.",
  );
  sentences.push("");
  sentences.push("---");
  sentences.push("");

  // === Content Creation ===
  const contentTypeDesc =
    CONTENT_TYPE_DESCRIPTIONS[formData.contentType] || formData.contentType;
  sentences.push(
    `Create a file called "draft.md" in the project directory containing ${contentTypeDesc} with approximately ${formData.wordCount} words.`,
  );

  if (formData.styleHints.trim()) {
    sentences.push(`Style guidance: ${formData.styleHints.trim()}`);
  }

  sentences.push("");
  sentences.push("Brief:");
  sentences.push(formData.brief);

  return sentences.join("\n");
}
```

### Example 2: Tool Choice Logic

```typescript
// src/lib/opencode-client.ts

interface MessageContext {
  isInitialRequest: boolean;
  expectsContentCreation: boolean;
  hasExistingDraft: boolean;
  messageHistory: number;
}

function analyzeMessageContext(
  message: string,
  sessionHistory: Message[]
): MessageContext {
  const isInitialRequest = sessionHistory.length === 0;
  
  // Detect content creation keywords
  const creationKeywords = [
    /write/i,
    /create/i,
    /draft/i,
    /blog post/i,
    /article/i,
    /content/i,
  ];
  
  const expectsContentCreation = creationKeywords.some(pattern =>
    pattern.test(message)
  );

  return {
    isInitialRequest,
    expectsContentCreation,
    hasExistingDraft: false, // TODO: Check if draft.md exists
    messageHistory: sessionHistory.length,
  };
}

function getToolChoiceStrategy(context: MessageContext): ToolChoice {
  // First message requesting content: force tool use
  if (context.isInitialRequest && context.expectsContentCreation) {
    return { type: "any" };
  }

  // Revision requests: allow flexibility
  if (context.hasExistingDraft) {
    return { type: "auto" };
  }

  // Default: auto (but with strong prompt guidance)
  return { type: "auto" };
}

export async function sendMessage(
  sessionId: string,
  message: string,
  projectId: string
): Promise<OpenCodeResponse> {
  const context = analyzeMessageContext(message, getSessionHistory(sessionId));
  const toolChoice = getToolChoiceStrategy(context);

  console.log(`Using tool_choice: ${toolChoice.type}`, { context });

  const response = await client.session.prompt({
    sessionID: sessionId,
    parts: [{ type: "text", text: message }],
    tool_choice: toolChoice,
  });

  return response;
}
```

### Example 3: Response Validator

```typescript
// src/lib/content-validator.ts

export interface ValidationResult {
  isValid: boolean;
  issue?: "inline_content" | "no_file_written" | "unclear";
  confidence: number;
  shouldRetry: boolean;
  retryMessage?: string;
}

export function validateContentResponse(
  response: OpenCodeResponse,
  expectedAction: "create_file" | "edit_file" | "discussion"
): ValidationResult {
  const parts = response.data?.parts || [];
  
  // Check if any tool was used
  const toolParts = parts.filter(p => p.type === "tool");
  const textParts = parts.filter(p => p.type === "text");
  
  // If we expected file creation but got no tool calls
  if (expectedAction === "create_file" && toolParts.length === 0) {
    const textContent = textParts.map(p => p.text).join("\n");
    const detection = detectInlineContent(textContent);
    
    if (detection.hasInlineContent) {
      return {
        isValid: false,
        issue: "inline_content",
        confidence: detection.confidence,
        shouldRetry: true,
        retryMessage: `Please write the content to draft.md using the write tool instead of including it in your response. Users cannot see content in chat messages - only content in files appears in their UI.`,
      };
    }
  }

  // Check if write tool was used for content files
  const writeTools = toolParts.filter(
    p => p.name === "write" && p.input?.path?.endsWith(".md")
  );
  
  if (expectedAction === "create_file" && writeTools.length === 0) {
    return {
      isValid: false,
      issue: "no_file_written",
      confidence: 80,
      shouldRetry: true,
      retryMessage: "Please use the write tool to create draft.md with the content.",
    };
  }

  return {
    isValid: true,
    confidence: 100,
    shouldRetry: false,
  };
}

function detectInlineContent(text: string): { hasInlineContent: boolean; confidence: number } {
  let score = 0;

  // Check for content introduction phrases
  if (/here'?s (your |the |a )?(blog|article|content|draft|post)/i.test(text)) {
    score += 30;
  }

  // Check for multiple markdown headings
  const headings = (text.match(/^#{1,3}\s+.+$/gm) || []).length;
  if (headings >= 2) score += 25;

  // Check for long text (likely content)
  const wordCount = text.split(/\s+/).length;
  if (wordCount > 200) score += 20;

  // Check for formatted paragraphs
  const paragraphs = (text.match(/\n\n+/g) || []).length;
  if (paragraphs >= 3) score += 15;

  // Check for frontmatter
  if (/^---$/m.test(text)) score += 20;

  return {
    hasInlineContent: score >= 50,
    confidence: Math.min(score, 100),
  };
}
```

### Example 4: API Route with Validation

```typescript
// app/api/opencode/message/route.ts

import { validateContentResponse } from "@/lib/content-validator";

export async function POST(request: NextRequest) {
  const { sessionId, projectId, message } = await request.json();
  
  let attempt = 1;
  let response: OpenCodeResponse;
  let validation: ValidationResult;

  do {
    console.log(`Attempt ${attempt}/3`);
    
    response = await sendMessage(sessionId, message, projectId);
    validation = validateContentResponse(response, "create_file");

    if (!validation.isValid && validation.shouldRetry && attempt < 3) {
      console.warn(`Validation failed: ${validation.issue}, retrying...`);
      message = validation.retryMessage || message;
      attempt++;
    } else {
      break;
    }
  } while (attempt <= 3);

  // If still invalid after retries, log warning
  if (!validation.isValid) {
    console.error("Content response validation failed after 3 attempts", {
      issue: validation.issue,
      confidence: validation.confidence,
    });
  }

  return Response.json({
    success: validation.isValid,
    response,
    validation,
  });
}
```

---

## Testing & Validation

### Test Cases

#### Test 1: Initial Content Request
```
Input: "Write a 500-word blog post about cloud security"
Expected: 
- ✅ write tool called with draft.md
- ✅ File contains ~500 words
- ✅ Response message is brief confirmation
- ❌ Response does NOT contain blog post content
```

#### Test 2: Revision Request
```
Input: "Make the introduction more engaging"
Expected:
- ✅ edit or write tool called
- ✅ draft.md is updated
- ✅ Response explains what was changed
```

#### Test 3: Clarifying Question
```
Input: "Write a blog post"
Expected:
- ✅ Assistant asks for topic/details
- ✅ No tool calls yet (appropriate)
- ✅ Text response is OK here
```

#### Test 4: Multiple Files
```
Input: "Create an outline and a draft"
Expected:
- ✅ write tool called for outline.md
- ✅ write tool called for draft.md
- ✅ Both files exist
- ✅ Response confirms both files created
```

### Success Metrics

Track these over time:

- **Tool Usage Rate**: % of content requests that use write/edit tools
- **Inline Content Detection Rate**: % of responses flagged for inline content
- **Retry Success Rate**: % of retries that successfully use tools
- **User-Reported Issues**: Number of "content not saved" complaints

### Monitoring

```typescript
// lib/analytics.ts

export function trackContentCreation(event: {
  requestType: "initial" | "revision" | "clarification";
  usedTools: boolean;
  toolsUsed: string[];
  hadInlineContent: boolean;
  retryCount: number;
  success: boolean;
}) {
  // Send to analytics platform
  analytics.track("content_creation", event);
}
```

---

## Additional Resources

### OpenCode Documentation
- [Tool Use Overview](https://opencode.ai/docs/tools)
- [Custom Commands](https://opencode.ai/docs/commands)
- [AGENTS.md Standard](https://github.com/anomalyco/opencode/blob/main/docs/AGENTS.md)

### Anthropic Documentation
- [Tool Use Guide](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use)
- [Tool Choice Parameter](https://platform.claude.com/cookbook/tool-use-tool-choice)
- [System Prompts](https://platform.claude.com/docs/en/build-with-claude/prompting-best-practices)

### Related Patterns
- [Prompt Engineering Guide](https://www.builder.io/blog/agents-md)
- [AGENTS.md Best Practices](https://jpcaparas.medium.com/writing-opencode-agent-skills-a-practical-guide-with-examples-870ff24eec66)

---

## Conclusion

Ensuring OpenCode always writes to files requires a **multi-layered approach**:

1. **Technical Constraint**: Use `tool_choice: { type: "any" }` when appropriate
2. **Clear Instructions**: System prompts and AGENTS.md with explicit rules
3. **Detection & Retry**: Validate responses and retry with stronger prompts
4. **User Feedback**: Warn users if content wasn't saved to file
5. **Right Model**: Use Claude 4.5 Sonnet for best tool compliance

**Priority order:**
1. Update prompt-builder.ts and AGENTS.md (Quick win, no API changes)
2. Add response validation and detection (Safety net)
3. Implement tool_choice logic (If supported by OpenCode API)
4. Create custom /write-content command (Advanced optimization)

The key insight: **LLMs default to conversational responses**. You must actively push them toward tool use through multiple reinforcing mechanisms.
