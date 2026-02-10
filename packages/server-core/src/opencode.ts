import { createOpencodeClient } from "@opencode-ai/sdk/v2";

const OPENCODE_API_URL =
  process.env.OPENCODE_API_URL ?? "http://localhost:9090";

export const opencode = createOpencodeClient({
  baseUrl: OPENCODE_API_URL,
});
