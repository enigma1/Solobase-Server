import { FastifyRequest, FastifyReply } from 'fastify';
import { escapeId, type RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { apiCallAuth, getColumnsOrdered } from '>/services';
import {
  appErrors,
  fingerprint,
  pageSizeValues,
  buildPaging,
} from '>/services';
import { dbSession } from '>/db';
import {
  hasIdentity,
  baseSortSchema,
  baseTableSchema,
  basePaginationSchema,
} from '>/services';
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
});

export const fetchDataRows = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<FetchRowsResponse> => {
      const request = FetchDataRowsSchema.parse(req.body);
      const { database, table, paging: pagination, sortBy } = request;
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
        .map((col) => escapeId(col))
        .join(', ');
      const sortByList = Array.isArray(sortBy) ? sortBy : undefined;
      const orderSql = sortByList?.length
        ? `ORDER BY ${sortByList.join(', ')}`
        : '';
      const paginationSql = `LIMIT ? OFFSET ?`;
      const sql = `SELECT ${escapedColumns} FROM ${escapeId(database)}.${escapeId(table)} ${orderSql} ${paginationSql}`;

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
