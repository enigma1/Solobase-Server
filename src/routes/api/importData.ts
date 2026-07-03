import { RowDataPacket } from 'mysql2';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { dbSession } from '>/db/session';
import {
  apiCallAuth,
  emptyToUndefined,
  // setGroupByMode,
  // restoreGroupByMode,
  compatibleQueryExecution,
} from '>/services';
import type { ImportDataResponse, ImportDataRequest } from '>/types';
import { GroupByModesSchema } from '>/contracts';

const ImportDataSchema = z.object({
  data: z.string().trim().min(4),
  database: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1).max(64).optional(),
  ),
  groupByMode: GroupByModesSchema.optional(),
});

export const importData = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<ImportDataResponse> => {
      const request = ImportDataSchema.parse(req.body);
      const { database, data, groupByMode } = request;

      if (database) {
        await sessionData.sqlSession.query<RowDataPacket[]>(
          `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
          [database],
        );
        await dbSession.activate(sessionData, database);
      }

      const modes =
        groupByMode === 'legacy'
          ? ['NO_ENGINE_SUBSTITUTION', 'ONLY_FULL_GROUP_BY']
          : undefined;
      const response = await compatibleQueryExecution({
        sqlSession: sessionData.sqlSession,
        modes,
        data,
      });
      // if (groupByMode && groupByMode !== 'default') {
      //   oldMode = await setGroupByMode(
      //     sessionData.sqlSession,
      //     groupByMode === 'legacy',
      //   );
      // }

      //await sessionData.sqlSession.query(data);
      //if (oldMode) await restoreGroupByMode(sessionData.sqlSession, oldMode);

      sessionData.schemas = await sessionData.xSession.getSchemas();
      sessionData.dbSelected = null;

      return {
        ok: true,
        message: 'Data import processed successfully',
      };
    },
  });
