import { createAgentChatNextHandlers } from "@agent-chat/server-next";

const handlers = createAgentChatNextHandlers();

export const GET = handlers.events.GET;
