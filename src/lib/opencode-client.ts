/**
 * Server-side OpenCode SDK Client
 *
 * This module provides a typed OpenCode client for server-side use.
 * It wraps the official @opencode-ai/sdk with project-specific helpers.
 */

import {
  createOpencodeClient,
  type OpencodeClient,
} from "@opencode-ai/sdk/v2/client";

const OPENCODE_API_URL =
  process.env.OPENCODE_API_URL || "http://localhost:9090";
const OPENCODE_API_KEY = process.env.OPENCODE_API_KEY;

export function getOpencodeClient(directory?: string): OpencodeClient {
  console.log(
    "[OpenCode Client] Creating client with baseUrl:",
    OPENCODE_API_URL,
    directory ? `directory: ${directory}` : "(no directory)",
  );

  return createOpencodeClient({
    baseUrl: OPENCODE_API_URL,
    directory,
    headers: OPENCODE_API_KEY
      ? { Authorization: `Bearer ${OPENCODE_API_KEY}` }
      : undefined,
  });
}
