import { RowDataPacket } from 'mysql2';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { dbSession } from '>/db';
import { apiCallAuth, compatibleQueryExecution } from '>/services';
import { emptyToUndefined, GroupByModesSchema } from '>/contracts';
import type { ImportDataResponse, ImportDataRequest } from '>/types';

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
        await dbSession.activate({ sessionData, database });
      }

      const modes =
        groupByMode === 'legacy' ? ['NO_ENGINE_SUBSTITUTION'] : undefined;
      const response = await compatibleQueryExecution({
        sqlSession: sessionData.sqlSession,
        modes,
        data,
      });

      sessionData.dbSelected = null;

      return {
        ok: true,
        message: 'Data import processed successfully',
      };
    },
  });
