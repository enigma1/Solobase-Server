import { FastifyRequest, FastifyReply } from 'fastify';
import { apiCallAuth, appErrors } from '>/services';
import { OpenRouterModels, GetOpenRouterModelsResponse } from '>/types';

export const getOpenRouterModels = async (
  req: FastifyRequest,
  rsp: FastifyReply,
) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (): Promise<GetOpenRouterModelsResponse> => {
      const response = await fetch('https://openrouter.ai/api/v1/models');

      if (!response.ok) {
        throw appErrors.server(
          500,
          `OpenRouter models request failed: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as {
        data?: OpenRouterModels;
      };

      const models = (data.data ?? []).filter(
        (model) =>
          model.architecture?.modality === 'text->text' &&
          model.supported_parameters?.includes('response_format') &&
          !model.id.startsWith('~'),
      );

      return {
        ok: true,
        message: 'OpenRouter models retrieved',
        models,
      };
    },
  });
