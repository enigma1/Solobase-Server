import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { apiCallAI } from '>/services';
import { promptGraph } from '>/ai';
import type { MakePromptResponse } from '>/types';

const MakePromptSchema = z.object({
  prompt: z.string().trim().min(1).max(1000),
  conversationId: z.string().trim().min(16).max(256).optional(),
});

export const makePrompt = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAI({
    req,
    rsp,
    fn: async ({ sessionData }): Promise<MakePromptResponse> => {
      const request = MakePromptSchema.parse(req.body);
      const result = await promptGraph.invoke(
        {
          messages: [
            {
              role: 'user',
              content: request.prompt,
            },
          ],
        },
        {
          configurable: {
            thread_id: sessionData.conversationId,
          },
        },
      );

      const ok = result.frontRequest.completed;
      return {
        ok,
        message: ok
          ? 'request processed succesfully'
          : 'could not fullfill request',
        frontRequest: result.frontRequest,
        aiResponse: {
          conversationId: sessionData.conversationId,
        },
      };
    },
  });
