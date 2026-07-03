import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  apiCallAuth,
  dbNameAllowedChars,
  appErrors,
  emptyToUndefined,
} from '>/services';
import { getSqlString, indexBy } from '>/services/utils';
import type {
  SessionData,
  FetchTablesRequest,
  SqlColumns,
  BasicRowsShape,
  FetchTablesResponse,
} from '>/types';

const FetchTablesSchema = z.object({
  database: z.preprocess(
    emptyToUndefined,
    z.string().regex(dbNameAllowedChars, 'Invalid database name').optional(),
  ),
});

export const fetchTables = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<FetchTablesResponse> => {
      const request = FetchTablesSchema.parse(req.body);
      const { xSession, dbSelected, schemas } = sessionData as SessionData;
      const dbName = request.database ?? dbSelected;
      const dbSafeName = schemas.find((s) => s.getName() === dbName)?.getName();
      if (!dbSafeName) {
        return {
          rows: [],
          cols: {},
          columnsOrder: [],
        };
        // throw appErrors.server(404, 'No database found');
      }
      // Update selected database in the session
      sessionData.dbSelected = dbSafeName;
      // const tables = await xSession.getSchema(dbSafeName).getTables();
      const sql = `SELECT * FROM information_schema.tables WHERE table_schema = ?`;
      const queryResult = await xSession.sql(sql).bind([dbSafeName]).execute();
      const columns = queryResult.getColumns();
      const rows = queryResult.fetchAll();
      const columnsOrder = columns.map((c) => c.getColumnName());
      const colsArray: SqlColumns[] = columns.map((c) => ({
        field: c.getColumnName(),
        type: String(c.getType()),
        nullable: 'NO',
        key: '',
        defaultValue: null,
        extra: '',
      }));
      const cols = indexBy(colsArray, 'field');

      const result = {
        rows,
        cols,
        columnsOrder,
      };
      return result;
    },
  });
