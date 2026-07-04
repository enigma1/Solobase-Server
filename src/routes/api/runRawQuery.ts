import { RowDataPacket, ResultSetHeader, OkPacketParams } from 'mysql2';
import { Scalar } from '@mysql/xdevapi';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { dbSession } from '>/db/session';
import {
  appErrors,
  apiCallAuth,
  buildCols,
  buildRows,
  buildColumnsOrder,
  isRowDataPacketArray,
  compatibleQueryExecution,
  // setGroupByMode,
  // restoreGroupByMode,
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

      const modes =
        groupByMode === 'legacy' ? ['NO_ENGINE_SUBSTITUTION'] : undefined;
      const response = await compatibleQueryExecution({
        sqlSession: sessionData.sqlSession,
        modes,
        data: {
          sql: query,
          nestTables: true,
        },
      });

      const [result, fields] = response;
      const isMulti = Array.isArray(result) && Array.isArray(result[0]);
      if (isMulti) {
        throw appErrors.domain(
          'multi_statements_in_run_query',
          `Multiple statements in arbitrary query runs are not supported. Use Import of Data instead`,
        );
      }

      if (!isRowDataPacketArray(result)) {
        const command = query.trim().match(/^\w+/)?.[0].toUpperCase();
        return {
          ok: true,
          mode: 'command',
          resultInfo: result as OkPacketParams,
          message: `${command} executed successfully`,
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
