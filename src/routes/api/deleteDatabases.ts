import { escapeId, ResultSetHeader } from 'mysql2';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { dbSession } from '>/db/session';
import { apiCallAuth, systemDatabases, isSystemDatabase } from '>/services';
import type { DeleteDatabasesResponse } from '>/types';

const DeleteDatabasesSchema = z
  .object({
    names: z.array(z.string().trim().min(1).max(64)),
  })
  .refine(
    ({ names }) =>
      names.every((name) => !systemDatabases.has(name.toLowerCase())),
    {
      message: 'Cannot delete system databases',
      path: ['names'],
    },
  );

export const deleteDatabases = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<DeleteDatabasesResponse> => {
      const request = DeleteDatabasesSchema.parse(req.body);
      const dbNames = request.names;

      const deletedDbNames = await Promise.all(
        dbNames.map(async (db) => {
          const dbQuery = `DROP DATABASE IF EXISTS ${escapeId(db)}`;
          await sessionData.sqlSession.query<ResultSetHeader>(dbQuery);
          return db;
        }),
      );

      const wasSelectedDeleted =
        sessionData.dbSelected && dbNames.includes(sessionData!.dbSelected);

      if (wasSelectedDeleted) {
        await dbSession.resetDb(sessionData!);
        sessionData.dbSelected = null;
      }

      // await sessionData!.sqlSession.query('SHOW DATABASES');
      const ok = deletedDbNames.length === dbNames.length;
      return {
        ok,
        databases: deletedDbNames,
        message: ok
          ? 'Databases removed successfully'
          : 'Process was incomplete',
      };
    },
  });
