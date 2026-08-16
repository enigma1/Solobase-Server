import { FastifyRequest, FastifyReply } from 'fastify';
import { apiCallUnknown, getSessionFromRequest } from '>/services';
import { getAiStatus } from '>/ai';
import type { ApiResponse, CheckSessionResponse } from '>/types';

export const checkSession = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallUnknown({
    req,
    rsp,
    fn: async (): Promise<ApiResponse<CheckSessionResponse>> => {
      const aiStatus = getAiStatus();
      const sessionData = getSessionFromRequest(req);
      if (!sessionData) {
        return {
          data: {
            ok: false,
            message: 'No Session',
            aiStatus,
          },
        };
      } else {
        return {
          data: {
            ok: true,
            message: 'Session is active',
            aiStatus,
          },
        };
      }
    },
  });
