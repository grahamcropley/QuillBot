---
name: markdown-images
description: Use Markdown image syntax directly in assistant messages to render local or remote images.
---

# Markdown Images

## Purpose

Render images inline in chat responses by writing standard Markdown image syntax directly in the message.

## When to Use

- Show screenshots, diagrams, UI previews, and generated assets.
- Reference an image file created during the current task.
- Link to a hosted image URL when local files are not appropriate.

## Instructions

1. Use standard Markdown image syntax:

```markdown
![Alt text](path-or-url)
```

2. Prefer short, descriptive alt text that explains what the image shows.
3. For repository files, use a workspace-relative path when possible.
4. For absolute local files, use an absolute filesystem path only when needed.
5. If a path contains spaces, URL-encode spaces as `%20`.

## Examples

```markdown
![Agent chat screenshot](initial-test.png)
![Question modal](screenshot-question-modal.png)
![Architecture diagram](https://example.com/architecture.png)
![Screenshot with spaces](/home/graham/Pictures/My%20Screenshot.png)
```

## Notes

- Markdown image syntax is valid directly inside normal assistant messages; no special tool call is required.
- If image rendering fails, verify the path exists and is readable from the current environment.
