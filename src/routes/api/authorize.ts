import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { apiCallAuth, apiCallUnknown, getCapabilities } from '>/services';
import { dbSession } from '>/db';
import type {
  LoginRequest,
  LoginResponse,
  BasicResponse,
  ApiResponse,
} from '>/types';

export const logout = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (): Promise<ApiResponse<BasicResponse>> => {
      const sessionId = req.cookies.sessionId;
      if (!sessionId)
        return {
          data: {
            ok: false, // no session, nothing to remove
            message: 'Already logged out',
          },
        };

      const removed = await dbSession.remove(sessionId);
      return {
        data: {
          ok: removed, // true if removed, false if not found
          message: removed ? 'Logging out' : 'Already logged out',
        },
        effects: {
          sessionId: '',
        },
      };
    },
  });

const LoginSchema = z.object({
  username: z.string().max(32).min(2),
  password: z.string().min(0), // required but can be left an empty string
});

export const login = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallUnknown({
    req,
    rsp,
    fn: async (): Promise<ApiResponse<LoginResponse>> => {
      const request = LoginSchema.parse(req.body);
      const sessionData = await dbSession.create(request);
      dbSession.set(sessionData.sessionId, sessionData);
      const capabilities = await getCapabilities(sessionData);
      return {
        data: {
          preferences: sessionData.preferences || {},
          capabilities,
        },
        effects: {
          sessionId: sessionData.sessionId,
        },
      };
    },
  });
