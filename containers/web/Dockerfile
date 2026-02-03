FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/next.config.ts /app/next.config.ts
COPY --from=build /app/.next /app/.next
COPY --from=build /app/public /app/public
COPY --from=build /app/node_modules /app/node_modules
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["npm", "run", "start"]
