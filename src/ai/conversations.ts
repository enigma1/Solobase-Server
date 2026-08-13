import { randomUUID } from 'node:crypto';

const createConversationId = (): string => randomUUID();

const resolveConversationId = (conversationId?: string): string =>
  conversationId ?? createConversationId();

const deleteConversation = async (conversationId: string): Promise<void> => {
  // eventually tell LangGraph/checkpointer
  // to remove the associated state
};

export const conversations = {
  resolveConversationId,
  deleteConversation,
};
