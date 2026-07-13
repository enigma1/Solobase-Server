import { type RowDataPacket } from 'mysql2/promise';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  apiCallAuth,
  getColumnsOrdered,
  basePaginationSchema,
  baseSortSchema,
  pageSizeValues,
  buildPaging,
} from '>/services';
import type { FetchUsersResponse, SqlRow, SqlQueryRow } from '>/types';

const FetchUsersSchema = z.object({
  ...basePaginationSchema,
  ...baseSortSchema,
});

export const fetchUsers = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<FetchUsersResponse> => {
      const request = FetchUsersSchema.parse(req.body);
      const { paging: pagination } = request;
      const { limit = pageSizeValues[0], offset = 0 } = pagination ?? {};
      const { cols, columnsOrder } = await getColumnsOrdered({
        sessionData,
        database: 'mysql',
        table: 'user',
      });

      const sql = `SELECT * FROM mysql.user LIMIT ? OFFSET ?`;
      const [rowObjects] = await sessionData.sqlSession.query<SqlQueryRow[]>(
        sql,
        [limit + 1, offset],
      );

      const rowsPageResult = buildPaging({
        columnsOrder,
        rowObjects,
        limit,
        offset,
      });

      const result = {
        ...rowsPageResult,
        ok: true,
        message: 'Users successfully retrieved',
        cols,
        columnsOrder,
      };
      return result;
    },
  });
