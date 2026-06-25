import { RowDataPacket, ResultSetHeader, OkPacketParams } from 'mysql2';
import { Scalar } from '@mysql/xdevapi';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { dbSession } from '>/db/session';
import {
  apiCallAuth,
  buildCols,
  buildRows,
  buildColumnsOrder,
  isRowDataPacketArray,
  setGroupByMode,
  restoreGroupByMode,
} from '>/services';
import { GroupByModesSchema } from '>/contracts';
import type { RunRawQueryResponse, RunRawQueryRequest } from '>/types';

const RunRawQuerySchema = z.object({
  query: z.string().trim().min(1),
  database: z.string().trim().min(1).max(64).optional(),
  groupByMode: GroupByModesSchema.optional(),
});

export const runRawQuery = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<RunRawQueryResponse> => {
      const request = RunRawQuerySchema.parse(req.body);
      const { query, database, groupByMode } = request;

      if (database) {
        await sessionData.sqlSession.query<RowDataPacket[]>(
          `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
          [database],
        );
        await dbSession.activate(sessionData, database);
      }

      let oldMode;
      if (groupByMode && groupByMode !== 'default') {
        oldMode = await setGroupByMode(
          sessionData.sqlSession,
          groupByMode === 'legacy',
        );
      }

      const [result, fields = []] = await sessionData.sqlSession.query({
        sql: query,
        nestTables: true,
      });

      if (oldMode) await restoreGroupByMode(sessionData.sqlSession, oldMode);

      if (!isRowDataPacketArray(result)) {
        console.log(
          '>--------------------->To Complete Result-Command components',
          result,
        );
        return {
          ok: true,
          mode: 'command',
          resultInfo: result as OkPacketParams | ResultSetHeader,
          message: 'command executed successfully',
        };
      }

      const columnsOrder = buildColumnsOrder(fields);
      const cols = buildCols({ fields, columnsOrder });
      const rows = buildRows({ fields, result });

      return {
        ok: true,
        mode: 'resultset',
        rows: rows as Scalar[][],
        cols,
        columnsOrder,
        message: 'result set successfully retrieved',
      };
    },
  });
