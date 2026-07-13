import { FastifyRequest, FastifyReply } from 'fastify';
import { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { dbSession } from '>/db';
import {
  apiCallAuth,
  appErrors,
  emptyToUndefined,
  pageSizeValues,
  getRealColumns,
  buildPaging,
} from '>/services';
import { indexBy, baseSortSchema, basePaginationSchema } from '>/services';
import type {
  SqlColumns,
  FetchTablesRequest,
  FetchTablesResponse,
  SqlRow,
} from '>/types';

const FetchTablesSchema = z.object({
  ...basePaginationSchema,
  ...baseSortSchema,
  database: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1).max(64).optional(),
  ),
});

export const fetchTables = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<FetchTablesResponse> => {
      const request = FetchTablesSchema.parse(req.body);
      const { paging: pagination, database } = request;
      const dbName = database ?? sessionData.dbSelected;
      if (!dbName) {
        throw appErrors.domain(
          'no_database_selected',
          'You must select a valid database for this operation',
        );
      }

      await dbSession.activate({
        sessionData,
        database: dbName,
        refresh: true,
      });

      const { limit = pageSizeValues[0], offset = 0 } = pagination ?? {};

      const columnsOrder: string[] = [];
      const colsArray = await getRealColumns({
        sessionData,
        database: 'information_schema',
        table: 'TABLES',
      });

      const cols = indexBy(
        colsArray.map((c): SqlColumns => {
          columnsOrder.push(c.field);
          return c;
        }),
        'field',
      );

      const sql = `SELECT * FROM information_schema.tables WHERE table_schema = ? LIMIT ? OFFSET ?`;
      const [rowObjects] = await sessionData.sqlSession.query<
        (SqlRow & RowDataPacket)[]
      >(sql, [dbName, limit + 1, offset]);

      const rowsPageResult = buildPaging({
        columnsOrder,
        rowObjects,
        limit,
        offset,
      });

      const result = {
        ...rowsPageResult,
        ok: true,
        message: `Tables successfully retrieved for ${dbName}`,
        cols,
        columnsOrder,
      };
      return result;
    },
  });
