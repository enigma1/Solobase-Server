import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { apiCallAuth } from '>/services';
import { getConversationMessages } from '>/ai';
import type { GetPromptsResponse } from '>/types';

const GetPromptsSchema = z.object({
  conversationId: z.string().trim().min(16).max(256),
});

export const getPrompts = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<GetPromptsResponse> => {
      const { conversationId } = GetPromptsSchema.parse(req.body);

      const messages = await getConversationMessages(conversationId);

      return {
        ok: true,
        message: 'Conversation retrieved',
        prompts: messages,
      };
    },
  });
