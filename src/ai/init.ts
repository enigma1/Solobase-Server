import { randomUUID } from 'node:crypto';
import { MemorySaver } from '@langchain/langgraph';

export const checkpointer = new MemorySaver();
const createConversationId = (): string => randomUUID();

const resolveConversationId = (conversationId?: string): string =>
  conversationId ?? createConversationId();

const deleteConversation = async (conversationId: string): Promise<void> => {
  await checkpointer.deleteThread(conversationId);
};

export const conversations = {
  resolveConversationId,
  deleteConversation,
};
