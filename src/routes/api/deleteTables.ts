import { escapeId, ResultSetHeader } from 'mysql2';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { apiCallAuth, appErrors } from '>/services';
import type { DeleteTablesResponse, DeleteTablesRequest } from '>/types';

const DeleteTablesSchema = z.object({
  database: z.string().trim().min(1).max(64),
  tables: z.array(z.string().trim().min(1).max(64)),
});

export const deleteTables = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<DeleteTablesResponse> => {
      const request = DeleteTablesSchema.parse(req.body);
      const { tables, database } = request;
      throw appErrors.domain('delete_tables', `Table Delete Test`);

      const deletedTables = await Promise.all(
        tables.map(async (table) => {
          const sqlQuery = `DROP TABLE IF EXISTS ${escapeId(database)}.${escapeId(table)}`;
          await sessionData.sqlSession.query<ResultSetHeader>(sqlQuery);
          return table;
        }),
      );

      // await sessionData!.sqlSession.query('SHOW DATABASES');
      const ok = deletedTables.length === tables.length;
      return {
        ok,
        database,
        tables: deletedTables,
        message: ok
          ? `Tables successfully removed from ${database}`
          : `Table removal was incomplete in ${database}`,
      };
    },
  });
