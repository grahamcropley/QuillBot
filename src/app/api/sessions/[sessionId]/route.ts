import { createAgentChatNextHandlers } from "@agent-chat/server-next";
const handlers = createAgentChatNextHandlers();

export const DELETE = handlers.session.DELETE;
