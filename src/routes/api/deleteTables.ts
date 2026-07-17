import { escapeId, ResultSetHeader } from 'mysql2';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { apiCallAuth, isSystemDatabase } from '>/services';
import type { DeleteTablesResponse, DeleteTablesRequest } from '>/types';

const DeleteTablesSchema = z
  .object({
    database: z.string().trim().min(1).max(64),
    tables: z.array(z.string().trim().min(1).max(64)),
  })
  .refine(({ database }) => !isSystemDatabase(database), {
    message: 'Cannot modify system databases',
    path: ['database'],
  });

export const deleteTables = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<DeleteTablesResponse> => {
      const request = DeleteTablesSchema.parse(req.body);
      const { tables, database } = request;

      const deletedTables = await Promise.all(
        tables.map(async (table) => {
          const sqlQuery = `DROP TABLE IF EXISTS ${escapeId(database)}.${escapeId(table)}`;
          await sessionData.sqlSession.query<ResultSetHeader>(sqlQuery);
          return table;
        }),
      );

      const ok = deletedTables.length === tables.length;
      return {
        ok,
        database,
        tables: deletedTables,
        message: ok
          ? `Tables successfully removed from database ${database}`
          : `Table removal was incomplete in database ${database}`,
      };
    },
  });
