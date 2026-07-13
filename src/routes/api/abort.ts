import { v4 as uuidv4 } from 'uuid';
import {
  Connection as StreamConnection,
  escape,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { apiCallAuth } from '>/services';
import { ctrlSession, dbSession } from '>/db';
import type { AbortSqlResponse, AbortSqlRequest } from '>/types';

export const abortSql = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<AbortSqlResponse> => {
      const threads = [
        sessionData.sqlSession.threadId,
        sessionData.streamSession.threadId,
        sessionData.xSession.threadId,
      ];

      const [rows] = await ctrlSession.query<RowDataPacket[]>(
        `SELECT ID FROM INFORMATION_SCHEMA.PROCESSLIST WHERE ID IN (?, ?, ?) AND COMMAND = 'Query'`,
        threads,
      );

      if (rows.length > 0) {
        await dbSession.refresh(sessionData);
      }

      return {
        ok: rows.length > 0,
        message:
          rows.length > 0
            ? 'Session is aborted'
            : 'There is no busy session so it will not abort session',
      };
    },
  });
