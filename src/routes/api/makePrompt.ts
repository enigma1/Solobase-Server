import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { apiCallAI, appErrors } from '>/services';
import { decideCapability, dataCapabilities, promptGraph } from '>/ai';
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

      const decision = result.decision;
      // const decision = await decideCapability(request.prompt);

      if (!decision?.capabilityId) {
        return {
          ok: true,
          message: 'More information required',
          aiResponse: {
            conversationId: sessionData.conversationId,
            answer:
              'What would you like to see: databases, tables, or table data?',
          },
        };
      }

      const capability = dataCapabilities.find(
        (item) => item.id === decision.capabilityId,
      );

      if (!capability) {
        throw appErrors.domain(
          'caps_error',
          `Unknown capability: ${decision.capabilityId}`,
        );
      }

      const missing = capability.required.filter(
        (item) => decision.parameters[item.name] === undefined,
      );

      if (missing.length > 0) {
        const question =
          missing.length === 1
            ? `Which ${missing[0].name} would you like to use?`
            : `I need to know the following: ${missing
                .map((item) => item.name)
                .join(', ')}.`;

        return {
          ok: true,
          message: 'More information required',
          aiResponse: {
            conversationId: sessionData.conversationId,
            answer: question,
          },
        };
      }

      const frontRequest = {
        ...decision.parameters,
        route: decision.capabilityId,
        paging: {
          limit: 50,
          offset: 0,
        },
      };

      return {
        ok: true,
        message: 'Prompt processed',
        frontRequest,
        aiResponse: {
          conversationId: sessionData.conversationId,
          answer: `Executing ${capability.id}.`,
        },
      };
    },
  });
