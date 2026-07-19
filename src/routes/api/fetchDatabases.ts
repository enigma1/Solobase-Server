import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { apiCallAuth, indexBy, buildPaging } from '>/services';
import { basePaginationSchema, pageSizeValues } from '>/contracts';
import {
  SessionData,
  SqlQueryRow,
  SqlColumns,
  PagingRequest,
  FetchDatabasesResponse,
} from '>/types';

export const fetchDatabasesCommon = async (
  sessionData: SessionData,
  pagination?: PagingRequest,
) => {
  const { limit = pageSizeValues[0], offset = 0 } = pagination?.paging ?? {};

  const columnsOrder: string[] = [];
  const cols = indexBy(
    sessionData.schemaColumns.map((c): SqlColumns => {
      columnsOrder.push(c.field);
      return c;
    }),
    'field',
  );

  const sql = `SELECT * FROM information_schema.SCHEMATA LIMIT ? OFFSET ?`;
  const [rowObjects] = await sessionData.sqlSession.query<SqlQueryRow[]>(sql, [
    limit + 1,
    offset,
  ]);

  const rowsPageResult = buildPaging({
    columnsOrder,
    rowObjects,
    limit,
    offset,
  });

  const result = {
    ...rowsPageResult,
    ok: true,
    message: 'Databases Request completed successfully',
    cols,
    columnsOrder,
  };
  return result;
};

const FetchDatabasesSchema = z.object({
  ...basePaginationSchema,
});

export const fetchDatabases = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<FetchDatabasesResponse> => {
      const request = FetchDatabasesSchema.parse(req.body);
      return fetchDatabasesCommon(sessionData, request);
    },
  });
