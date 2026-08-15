import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  apiCallAuth,
  indexBy,
  buildPaging,
  systemDatabases,
  buildOrderBy,
  buildWhere,
} from '>/services';
import { pageSizeValues, FetchDatabasesSchema } from '>/contracts';
import { queryDatabases } from '>/queries';

import {
  SessionData,
  SqlQueryRow,
  SqlColumns,
  FetchDatabasesResponse,
  FetchDatabasesRequest,
} from '>/types';

export const fetchDatabasesCommon = async (
  sessionData: SessionData,
  request: z.infer<typeof FetchDatabasesSchema>,
) => {
  const { paging: pagination, sortBy, filters } = request;

  const { limit = pageSizeValues[0], offset = 0 } = pagination ?? {};

  const columnsOrder: string[] = [];
  const cols = indexBy(
    sessionData.schemaColumns.map((c): SqlColumns => {
      columnsOrder.push(c.field);
      return c;
    }),
    'field',
  );

  const extraConditions = [];
  const dbSystemNames = [...systemDatabases];

  if (!sessionData.allowSystemDatabases) {
    extraConditions.push({
      sql: `SCHEMA_NAME NOT IN (${dbSystemNames.map(() => '?').join(', ')})`,
      values: dbSystemNames,
    });
  }

  const { sql: where, values: whereValues } = buildWhere({
    filters,
    extraConditions,
  });

  const orderBy = buildOrderBy({
    sortBy,
    firstColumn: 'SCHEMA_NAME',
  });

  const sql = `
    SELECT *
    FROM information_schema.SCHEMATA
    ${where}
    ${orderBy}
    LIMIT ? OFFSET ?
  `;

  const [rowObjects] = await sessionData.sqlSession.query<SqlQueryRow[]>(sql, [
    ...whereValues,
    limit + 1,
    offset,
  ]);

  return {
    ...buildPaging({
      columnsOrder,
      rowObjects,
      limit,
      offset,
    }),
    ok: true,
    message: 'Databases Request completed successfully',
    cols,
    columnsOrder,
  };
};

// export const fetchDatabases = async (req: FastifyRequest, rsp: FastifyReply) =>
//   apiCallAuth({
//     req,
//     rsp,
//     fn: async (sessionData): Promise<FetchDatabasesResponse> => {
//       const request = FetchDatabasesSchema.parse(req.body);
//       return fetchDatabasesCommon(sessionData, request);
//     },
//   });

export const fetchDatabases = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (): Promise<FetchDatabasesResponse> => {
      const result = await queryDatabases(
        req.body as z.infer<typeof FetchDatabasesSchema>,
      );
      const { cols, columnsOrder, rowObjects, limit, offset } = result;
      return {
        ...buildPaging({
          columnsOrder,
          rowObjects,
          limit,
          offset,
        }),
        ok: true,
        message: 'Databases Request completed successfully',
        cols,
        columnsOrder,
      };
    },
  });
