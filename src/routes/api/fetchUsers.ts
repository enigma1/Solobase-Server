import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  apiCallAuth,
  getColumnsOrdered,
  buildPaging,
  buildOrderBy,
  buildWhere,
} from '>/services';
import {
  basePaginationSchema,
  baseSortSchema,
  baseFiltersSchema,
  pageSizeValues,
} from '>/contracts';
import type { FetchUsersResponse, SqlQueryRow } from '>/types';

const FetchUsersSchema = z.object({
  ...basePaginationSchema,
  ...baseSortSchema,
  ...baseFiltersSchema,
});

export const fetchUsers = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<FetchUsersResponse> => {
      const request = FetchUsersSchema.parse(req.body);
      const { paging: pagination, sortBy, filters } = request;

      const { limit = pageSizeValues[0], offset = 0 } = pagination ?? {};

      const { cols, columnsOrder } = await getColumnsOrdered({
        sessionData,
        database: 'mysql',
        table: 'user',
      });

      const orderBy = buildOrderBy({
        sortBy,
        firstColumn: 'User',
      });

      const { sql: where, values: whereValues } = buildWhere({
        filters,
      });

      const paginationSql = `LIMIT ? OFFSET ?`;
      const sql = `SELECT * FROM mysql.user ${where} ${orderBy} ${paginationSql}`;
      const [rowObjects] = await sessionData.sqlSession.query<SqlQueryRow[]>(
        sql,
        [...whereValues, limit + 1, offset],
      );

      const rowsPageResult = buildPaging({
        columnsOrder,
        rowObjects,
        limit,
        offset,
      });

      return {
        ...rowsPageResult,
        ok: true,
        message: 'Users successfully retrieved',
        cols,
        columnsOrder,
      };
    },
  });
