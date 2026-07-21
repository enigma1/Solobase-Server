import { FastifyRequest, FastifyReply } from 'fastify';
import {
  apiCallUnknown,
  getSessionFromRequest,
  getCapabilities,
  getPreferencesPath,
  loadPreferencesFile,
} from '>/services';
import type {
  ApiResponse,
  SessionRestoreResponse,
  BasicResponse,
} from '>/types';

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

      const capabilities = await getCapabilities(sessionData);
      const path = getPreferencesPath(sessionData.username);
      const prefs = await loadPreferencesFile(path);

      const result = {
        effects: {
          sessionId: sessionData.sessionId,
        },
        data: {
          username: sessionData.username,
          dbSelected: sessionData.dbSelected,
          preferences: prefs || {},
          capabilities,
        } satisfies SessionRestoreResponse,
      };
      return result;
    },
  });
