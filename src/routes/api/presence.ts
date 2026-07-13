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
          } satisfies BasicResponse,
        };
      }
      const schemas = await fetchDatabasesCommon(sessionData);
      const result = {
        effects: {
          sessionId: sessionData.sessionId,
        },
        data: {
          schemas,
          username: sessionData.username,
          dbSelected: sessionData.dbSelected,
          preferences: sessionData.preferences || {},
        } satisfies SessionRestoreResponse,
      };
      return result;
    },
  });
