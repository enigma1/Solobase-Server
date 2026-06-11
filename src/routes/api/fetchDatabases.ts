import { FastifyRequest, FastifyReply } from 'fastify';
import { apiCallAuth } from '>/services/apiHelpers';
import { SessionData, SqlColumns, FetchDatabasesResponse } from '>/types';
import { indexBy } from '>/services/utils';

export const fetchDatabasesCommon = async (sessionData: SessionData) => {
  const queryResult = await sessionData.xSession
    .sql('SELECT * FROM information_schema.SCHEMATA')
    .execute();
  const columns = queryResult.getColumns();
  const rows = queryResult.fetchAll();
  const columnsOrder: string[] = [];

  const cols = indexBy(
    columns.map((c): SqlColumns => {
      const fieldName = c.getColumnName();
      columnsOrder.push(fieldName);
      return {
        field: fieldName,
        type: 'unknown',
        nullable: 'YES',
        key: '',
        defaultValue: null,
        extra: '',
      };
    }),
    'field',
  );

  const result = {
    rows,
    cols,
    columnsOrder,
  };
  return result;
};

export const fetchDatabases = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth<FetchDatabasesResponse>({
    req,
    rsp,
    fn: async (sessionData) => {
      return fetchDatabasesCommon(sessionData);
    },
  });
