import { createOpencodeClient } from "@opencode-ai/sdk/v2";

const OPENCODE_API_URL =
  process.env.OPENCODE_API_URL ?? "http://localhost:9090";
const OPENCODE_SERVER_USERNAME = process.env.OPENCODE_SERVER_USERNAME;
const OPENCODE_SERVER_PASSWORD = process.env.OPENCODE_SERVER_PASSWORD;

const headers: Record<string, string> = {};
if (OPENCODE_SERVER_USERNAME && OPENCODE_SERVER_PASSWORD) {
  const credentials = Buffer.from(
    `${OPENCODE_SERVER_USERNAME}:${OPENCODE_SERVER_PASSWORD}`,
  ).toString("base64");
  headers.Authorization = `Basic ${credentials}`;
}

export const opencode = createOpencodeClient({
  baseUrl: OPENCODE_API_URL,
  headers: Object.keys(headers).length ? headers : undefined,
});
