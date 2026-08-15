import { z } from 'zod';
import { pageSizeValues, FetchDatabasesSchema } from '>/contracts';
import {
  getSessionData,
  indexBy,
  systemDatabases,
  buildOrderBy,
  buildWhere,
} from '>/services';
import type { SqlQueryRow, SqlColumns } from '>/types';

export const queryDatabases = async (
  req: z.infer<typeof FetchDatabasesSchema>,
) => {
  const request = FetchDatabasesSchema.parse(req);
  const sessionData = getSessionData();
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
    cols,
    columnsOrder,
    rowObjects,
    limit,
    offset,
  };
};
