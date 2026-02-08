# QuillBot Development Environment - Quick Reference

## Starting the Development Environment

### Using tmux (Recommended)

```bash
./start-dev.sh
# Or: npm run dev:all
```

This creates a tmux session with two panes:

```
┌─────────────────────────┬─────────────────────────┐
│   OpenCode Server       │   Next.js Dev Server    │
│   (Port 9090)           │   (Port 3000)           │
│   [Pane 0]              │   [Pane 1]              │
└─────────────────────────┴─────────────────────────┘
```

## tmux Keyboard Shortcuts

All tmux commands start with the **prefix key**: `Ctrl+b`

### Basic Navigation

| Command           | Action                                     |
| ----------------- | ------------------------------------------ |
| `Ctrl+b` then `←` | Switch to left pane (OpenCode)             |
| `Ctrl+b` then `→` | Switch to right pane (Next.js)             |
| `Ctrl+b` then `z` | Toggle fullscreen for current pane         |
| `Ctrl+b` then `d` | Detach from session (servers keep running) |

### Scrolling and Copying

| Command                  | Action                  |
| ------------------------ | ----------------------- |
| `Ctrl+b` then `[`        | Enter scroll/copy mode  |
| `q` (in scroll mode)     | Exit scroll mode        |
| `Space` (in scroll mode) | Start selection         |
| `Enter` (in scroll mode) | Copy selection and exit |

### Window Management

| Command           | Action              |
| ----------------- | ------------------- |
| `Ctrl+b` then `c` | Create new window   |
| `Ctrl+b` then `n` | Next window         |
| `Ctrl+b` then `p` | Previous window     |
| `Ctrl+b` then `&` | Kill current window |

## Session Management

### Attach to existing session

```bash
tmux attach -t quillbot-dev
# Or shorthand: tmux a -t quillbot-dev
```

### List all sessions

```bash
tmux ls
```

### Stop the development environment

```bash
./stop-dev.sh
# Or: npm run dev:stop
# Or manually: tmux kill-session -t quillbot-dev
```

### Detach and reattach

```bash
# Inside tmux: press Ctrl+b then d (detach)
# Servers continue running in background

# Reattach later
tmux attach -t quillbot-dev
```

## Alternative: Manual Mode (Separate Terminals)

If you prefer separate terminal windows:

**Terminal 1 - OpenCode:**

```bash
./start-opencode.sh
```

**Terminal 2 - Next.js:**

```bash
npm run dev
```

## URLs

- **Web UI**: http://localhost:3000
- **OpenCode API**: http://localhost:9090

## Troubleshooting

### Session already exists

```bash
# Option 1: Attach to existing
tmux attach -t quillbot-dev

# Option 2: Kill and restart
tmux kill-session -t quillbot-dev
./start-dev.sh
```

### tmux not installed

```bash
# Ubuntu/Debian
sudo apt install tmux

# macOS
brew install tmux
```

### Port already in use

```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Find and kill process on port 9090
lsof -ti:9090 | xargs kill -9
```

### Can't see logs

If logs are scrolling too fast, use `Ctrl+b` then `[` to enter scroll mode and navigate freely.

## Tips

1. **Keep logs visible**: Use `Ctrl+b z` to zoom into a pane when you need to focus on its logs
2. **Monitor both services**: The split pane view lets you see if either service crashes
3. **Clean restarts**: Always use `./stop-dev.sh` to ensure both processes are properly terminated
4. **Background mode**: Detach with `Ctrl+b d` and continue working - servers stay running

## Common Workflows

### Quick restart after code changes

```bash
# Usually not needed - Next.js hot-reloads automatically
# OpenCode server needs manual restart only if config changes
```

### Full restart

```bash
./stop-dev.sh
./start-dev.sh
```

### Check if session is running

```bash
tmux ls | grep quillbot-dev
```

### View OpenCode config while dev is running

Create a new window: `Ctrl+b` then `c`, then explore files
