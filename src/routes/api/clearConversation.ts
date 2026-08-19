import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { apiCallAuth } from '>/services';
import {
  conversations,
} from '>/ai';
import type { ClearConversationResponse } from '>/types';

const ClearConversationSchema = z.object({
  conversationId: z.string().trim().min(16).max(256),
});

export const clearConversation = async (
  req: FastifyRequest,
  rsp: FastifyReply,
) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (): Promise<ClearConversationResponse> => {
      const { conversationId } = ClearConversationSchema.parse(req.body);
      await conversations.deleteConversation(conversationId);

      return {
        ok: true,
        message: 'Conversation removed',
      };
    },
  });
