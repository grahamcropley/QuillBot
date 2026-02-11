# syntax=docker/dockerfile:1

# ==============================================================================
# Stage 1: Dependencies (with workspace packages)
# ==============================================================================
FROM node:20-slim AS deps
WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

# Copy dependency manifests (workspace-aware)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/react/package.json ./packages/react/package.json
COPY packages/server-core/package.json ./packages/server-core/package.json
COPY packages/server-next/package.json ./packages/server-next/package.json

# Install ALL dependencies (needed for build)
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ==============================================================================
# Stage 2: Build (Next.js compilation)
# ==============================================================================
FROM node:20-slim AS build
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

# Copy installed dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy workspace source files (must come before build)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY next.config.js tsconfig.json postcss.config.mjs ./
COPY src ./src
COPY public ./public

# Build Next.js application
RUN pnpm run build

# ==============================================================================
# Stage 3: Runner (Production runtime)
# ==============================================================================
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Enable pnpm (needed for pnpm run start)
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

# Copy runtime essentials from build stage
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/next.config.js ./
COPY --from=build --chown=node:node /app/public ./public

# Copy Next.js build output
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

# Copy production dependencies (pruned)
COPY --from=build --chown=node:node /app/node_modules ./node_modules

# Create data directory with correct ownership
RUN mkdir -p /app/data
RUN chown -R 1000:1000 /app

USER 1000:1000

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

# Environment variables for Next.js standalone server
ENV HOSTNAME="0.0.0.0"
ENV PORT="3000"

# Start Next.js server
CMD ["node", "server.js"]
