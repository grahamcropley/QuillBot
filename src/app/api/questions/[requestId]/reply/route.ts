import { createAgentChatNextHandlers } from "@agent-chat/server-next";

const handlers = createAgentChatNextHandlers();

export const POST = handlers.questions.reply.POST;
