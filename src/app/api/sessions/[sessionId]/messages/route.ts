import { createAgentChatNextHandlers } from "@agent-chat/server-next";
const handlers = createAgentChatNextHandlers();

export const GET = handlers.messages.GET;
export const POST = handlers.messages.POST;
