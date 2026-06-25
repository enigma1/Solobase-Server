import { FastifyRequest, FastifyReply } from 'fastify';
import { apiCallUnknown, getSessionFromRequest } from '>/services';
import type {
  ApiResponse,
  SessionRestoreResponse,
  BasicResponse,
} from '>/types';

export const checkSession = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallUnknown({
    req,
    rsp,
    fn: async (): Promise<
      ApiResponse<SessionRestoreResponse | BasicResponse>
    > => {
      const sessionData = getSessionFromRequest(req);
      if (!sessionData) {
        return {
          data: {
            ok: false,
            message: 'No Session',
          } satisfies BasicResponse,
        };
      } else {
        return {
          data: {
            ok: true,
            message: 'Session is active',
          } satisfies BasicResponse,
        };
      }
    },
  });
