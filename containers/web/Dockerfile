FROM node:20-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/react/package.json ./packages/react/package.json
COPY packages/server-core/package.json ./packages/server-core/package.json
COPY packages/server-next/package.json ./packages/server-next/package.json
RUN pnpm install --frozen-lockfile

FROM node:20-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
RUN pnpm run build
RUN pnpm prune --prod

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/next.config.js /app/next.config.js
COPY --from=build /app/.next /app/.next
COPY --from=build /app/public /app/public
COPY --from=build /app/node_modules /app/node_modules
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["pnpm", "run", "start"]
