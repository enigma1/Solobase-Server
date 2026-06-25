import { escape, ResultSetHeader } from 'mysql2';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { apiCallAuth } from '>/services';
import type {
  SessionData,
  DeleteUsersRequest,
  DeleteUsersResponse,
} from '>/types';

const DeleteUsersSchema = z.object({
  columnsOrder: z.array(z.string()).min(1),
  rows: z.array(z.array(z.unknown())),
});

export const deleteUsers = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<DeleteUsersResponse> => {
      const request = DeleteUsersSchema.parse(req.body);
      const { columnsOrder, rows } = request;

      const userIdx = columnsOrder.indexOf('User');
      const hostIdx = columnsOrder.indexOf('Host');
      for (const row of rows) {
        const user = String(row[userIdx]);
        const host = String(row[hostIdx]);
        const account = `${escape(user)}@${escape(host)}`;
        const dbQuery = `DROP USER ${account}`;
        await sessionData.sqlSession.query<ResultSetHeader>(dbQuery);
      }

      return {
        ok: true,
        message: 'Users successfully removed',
      };
    },
  });
