# OpenCode Configuration

## Overview

This directory contains the OpenCode configuration for QuillBot, the content authoring platform.

## Configuration Files

### `auth.json`

Authentication and provider configuration. You've copied this from your existing instance.

### `opencode.json`

Minimal, focused server and agent configuration.

**Key Settings:**

- **Model**: `github-copilot/gpt-5.2`
- **Temperature**: 0.7 (balanced creativity/consistency)
- **Server Port**: 9090
- **Environment**: development

## Commands

Command definitions are markdown files in the `commands/` directory:

### write-content.md

Generates new content from briefs.

**Workflow:**

1. Uses the question tool to clarify format and requirements
2. Asks for confirmation of approach
3. Writes content to `working-draft.md` in the project folder
4. Uses Write tool to save to disk

**Embedded Instructions:**

- Hard rules: No em-dashes, colon headings, buzzwords, filler phrases
- LoopUp voice: Expert, human, pragmatic, peer-level
- Format-specific guidance for blog, whitepaper, social, email
- Works with project folder structure
- Uses question tool for user interaction

### rewrite-content.md

Rewrites or improves existing content.

**Workflow:**

1. Uses the question tool to confirm format and requirements
2. Asks what to preserve and what to change
3. Rewrites content in `working-draft.md`
4. Uses Write tool to save changes

**Embedded Instructions:**

- Same hard rules and voice as write-content
- Removes AI patterns (filler, buzzwords, generic statements)
- Fixes structural issues (conclusions upfront, abrupt endings)
- Preserves source terminology unless clearly wrong

## Project Structure

OpenCode works with this project folder structure:

```
data/projects/
  └── [project-id]/
      └── working-draft.md    ← Content is written here
```

Commands read from and write to `working-draft.md` in the current project.

## Key Features

- **Question Tool**: Commands use the question tool to gather requirements before writing
- **Write Tool**: Commands use Write to save content to disk
- **Working Draft Pattern**: All content goes to `working-draft.md` for user review/editing
- **Minimal Config**: Only what's needed to run; everything else is command-driven
- **Project-Aware**: Instructions include guidance on working within the project folder structure

## Starting OpenCode

```bash
pnpm opencode
```

This runs `start-opencode.sh` which:

1. Validates auth.json exists
2. Sets working directory to `data/projects/`
3. Starts server on port 9090
4. Loads commands from `commands/` directory

## Notes

- All config files are **gitignored** (except README.md and CONFIG.md)
- `auth.json` contains your credentials—keep it private
- Commands are markdown files with embedded system instructions
- Commands are designed to integrate with the question tool for user interaction
