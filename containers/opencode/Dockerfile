# syntax=docker/dockerfile:1

FROM node:20-slim

# Build arguments for version pinning
ARG OPENCODE_VERSION=1.1.56

WORKDIR /app

# Install opencode-ai globally with caching
RUN --mount=type=cache,target=/root/.npm \
    npm install -g opencode-ai@${OPENCODE_VERSION}

# Create application directories with correct ownership (node user is UID/GID 1000)
RUN mkdir -p /app/data /app/.config /app/.local
RUN chown -R 1000:1000 /app

USER 1000

# Set home directory for opencode user
ENV HOME=/app
ENV XDG_CONFIG_HOME=/app/.config

# Expose OpenCode server port
EXPOSE 9090

#HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
#  CMD sh -c "node -e \"const http = require('http'); const auth = Buffer.from('$$OPENCODE_SERVER_USERNAME:$$OPENCODE_SERVER_PASSWORD').toString('base64'); const opts = {hostname: 'localhost', port: 9090, path: '/health', headers: {'Authorization': 'Basic ' + auth}}; http.get(opts, (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1));\""

# Default command (can be overridden in docker-compose)
CMD ["opencode", "serve", "--host", "0.0.0.0", "--port", "9090"]
