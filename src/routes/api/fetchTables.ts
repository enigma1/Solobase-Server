import { FastifyRequest, FastifyReply } from 'fastify';
import { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { dbSession } from '>/db';
import {
  apiCallAuth,
  appErrors,
  getRealColumns,
  buildPaging,
  buildOrderBy,
  buildWhere,
  indexBy,
} from '>/services';
import {
  baseSortSchema,
  basePaginationSchema,
  baseFiltersSchema,
  emptyToUndefined,
  pageSizeValues,
} from '>/contracts';

import type { SqlColumns, FetchTablesResponse, SqlQueryRow } from '>/types';

const FetchTablesSchema = z.object({
  ...basePaginationSchema,
  ...baseSortSchema,
  ...baseFiltersSchema,

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
      const { paging: pagination, database, sortBy, filters } = request;
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

      const orderBy = buildOrderBy({ sortBy, firstColumn: 'TABLE_NAME' });
      const { sql: where, values: whereValues } = buildWhere({
        filters,
        extraConditions: [
          {
            sql: 'table_schema = ?',
            values: [dbName],
          },
        ],
      });
      const paginationSql = `LIMIT ? OFFSET ?`;
      const sql = `SELECT * FROM information_schema.tables ${where} ${orderBy} ${paginationSql}`;

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
