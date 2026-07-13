import { FastifyRequest, FastifyReply } from 'fastify';
import { apiCallAuth } from '>/services';
import type { FetchDatabaseInfoResponse } from '>/types';

export const fetchDatabaseInfo = async (
  req: FastifyRequest,
  rsp: FastifyReply,
) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<FetchDatabaseInfoResponse> => ({
      collationsByCharset: sessionData.collationsByCharset,
      engines: sessionData.engines,
      defaults: sessionData.defaults,
    }),
  });
