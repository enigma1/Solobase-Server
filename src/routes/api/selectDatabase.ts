import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { dbSession } from '>/db/session';
import { apiCallAuth, dbNameAllowedChars } from '>/services';
import { SelectDatabaseRequest, SelectDatabaseResponse } from '>/types';

const SelectDatabaseSchema = z.object({
  database: z.string().trim().min(1).max(64),
});

export const selectDatabase = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<SelectDatabaseResponse> => {
      const request = SelectDatabaseSchema.parse(req.body);
      const { database } = request;

      if (database === sessionData.dbSelected)
        return {
          ok: false,
          database: database,
          message: `Database ${database} is already selected`,
        };

      const [rows] = await sessionData.sqlSession.query<RowDataPacket[]>(
        `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
        [database],
      );

      if (rows.length === 0) {
        return {
          ok: false,
          database: undefined,
          message: 'Invalid Database',
        };
      }

      // Update selected database in the session
      const result = await dbSession.activate(sessionData, database);
      return {
        ok: result,
        database,
        message: `Database ${database} selected`,
      };
    },
  });
