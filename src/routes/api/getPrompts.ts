import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { apiCallAuth } from '>/services';
import type { GetPromptsResponse } from '>/types';

const GetPromptsSchema = z.object({
  conversationId: z.string().trim().min(16).max(256),
});

export const getPrompts = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<GetPromptsResponse> => {
      const request = GetPromptsSchema.parse(req.body);
      const { conversationId } = request;

      const defaults = sessionData.defaults;

      return {
        ok: true,
        message: 'Prompt processed',
        prompts: [],
      };
    },
  });
