import { FastifyRequest, FastifyReply } from 'fastify';
import { apiCallUnknown, getSessionFromRequest } from '>/services';
import type {
  ApiResponse,
  SessionRestoreResponse,
  BasicResponse,
} from '>/types';
import { fetchDatabasesCommon } from './fetchDatabases';

export const presence = async (req: FastifyRequest, rsp: FastifyReply) =>
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
            message: 'could not restore session',
          },
        };
      }
      const result = {
        effects: {
          sessionId: sessionData.sessionId,
        },
        data: {
          username: sessionData.username,
          dbSelected: sessionData.dbSelected,
        } satisfies SessionRestoreResponse,
      };
      return result;
    },
  });
