FROM node:20-slim

ARG OPENCODE_VERSION=latest

WORKDIR /app

RUN npm install -g opencode-ai@${OPENCODE_VERSION}

COPY AGENTS.md /app/AGENTS.md

RUN mkdir -p /app/.opencode
