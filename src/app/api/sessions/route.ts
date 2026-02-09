import { createAgentChatNextHandlers } from "@agent-chat/server-next";
const handlers = createAgentChatNextHandlers();

export const GET = handlers.sessions.GET;
export const POST = handlers.sessions.POST;
