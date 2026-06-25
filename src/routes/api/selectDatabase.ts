import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { dbSession } from '>/db/session';
import { apiCallAuth, dbNameAllowedChars } from '>/services';

const SelectDatabaseSchema = z.object({
  name: z.string().trim().min(1).max(64),
});

export const selectDatabase = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData) => {
      const request = SelectDatabaseSchema.parse(req.body);
      const { name } = request;
      if (name === sessionData.dbSelected)
        return {
          ok: false,
          dbSelected: name,
          message: `Database ${name} is already selected`,
        };

      const [rows] = await sessionData.sqlSession.query<RowDataPacket[]>(
        `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
        [name],
      );

      if (rows.length === 0) {
        return {
          ok: false,
          dbSelected: undefined,
          message: 'Invalid Database',
        };
      }

      // Update selected database in the session
      const result = await dbSession.activate(sessionData, name);
      return {
        ok: result,
        dbSelected: name,
        message: `Database ${name} selected`,
      };
    },
  });
