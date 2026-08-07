import { FastifyRequest, FastifyReply } from 'fastify';
import { escapeId } from 'mysql2/promise';
import { z } from 'zod';
import {
  apiCallAuth,
  getColumnsOrdered,
  appErrors,
  fingerprint,
  hasIdentity,
  buildPaging,
  isSpatial,
  buildDistinct,
  buildGroupBy,
  buildWhere,
  buildOrderBy,
  compatibleQueryExecution,
} from '>/services';
import { dbSession } from '>/db';
import {
  pageSizeValues,
  baseSortSchema,
  baseTableSchema,
  basePaginationSchema,
  baseFiltersSchema,
} from '>/contracts';

import type {
  FetchRowsRequest,
  FetchRowsResponse,
  SqlColumnsShape,
  SqlRow,
  SqlQueryRow,
} from '>/types';

type GetRowTokensProps = {
  cols: SqlColumnsShape;
  rows: SqlRow[];
  offset: number;
};

const getRowTokens = ({ cols, rows, offset }: GetRowTokensProps) => {
  if (!hasIdentity(cols)) {
    return rows.map((row, index) => ({
      rowIndex: offset + index,
      fingerprint: fingerprint(row),
    }));
  }
};

const FetchDataRowsSchema = z.object({
  ...basePaginationSchema,
  ...baseTableSchema,
  ...baseSortSchema,
  ...baseFiltersSchema,
});

export const fetchDataRows = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<FetchRowsResponse> => {
      const request = FetchDataRowsSchema.parse(req.body);
      const { database, table, paging: pagination, sortBy, filters } = request;
      const { limit = pageSizeValues[0], offset = 0 } = pagination ?? {};

      await dbSession.activate({ sessionData, database, refresh: true });

      const { cols, columnsOrder } = await getColumnsOrdered({
        sessionData,
        table,
        database,
      });

      if (!columnsOrder.length) {
        throw appErrors.server(404, 'A Database Table was not found');
      }

      const escapedColumns = columnsOrder
        .map((col) => {
          const type = cols[col].type.toLowerCase();

          if (isSpatial(type)) {
            return `ST_AsGeoJSON(${escapeId(col)}) AS ${escapeId(col)}`;
          }

          return escapeId(col);
        })
        .join(', ');

      const distinct = buildDistinct(filters);
      const groupBy = buildGroupBy(filters);
      const orderBy = buildOrderBy({ sortBy, firstColumn: columnsOrder[0] });
      const { sql: where, values: whereValues } = buildWhere({ filters });

      const paginationSql = `LIMIT ? OFFSET ?`;
      const sql = `SELECT ${distinct} ${escapedColumns} FROM ${escapeId(database)}.${escapeId(table)} ${where} ${groupBy} ${orderBy} ${paginationSql}`;

      const modes = groupBy.length > 0 ? ['NO_ENGINE_SUBSTITUTION'] : undefined;
      const [rowObjects] = (await compatibleQueryExecution({
        sqlSession: sessionData.sqlSession,
        modes,
        data: {
          sql,
          values: [...whereValues, limit + 1, offset],
        },
      })) as [SqlQueryRow[], unknown];

      const rowsPageResult = buildPaging({
        columnsOrder,
        rowObjects,
        limit,
        offset,
      });

      return {
        ...rowsPageResult,
        ok: true,
        message: 'Row fetch request completed',
        cols,
        columnsOrder,
        rowTokens: getRowTokens({ rows: rowsPageResult.rows, cols, offset }),
      };
    },
  });
