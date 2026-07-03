import { escapeId, ResultSetHeader } from 'mysql2';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  apiCallAuth,
  collationExists,
  charsetExists,
  dbNameAllowedChars,
  getDatabaseServerDefaults,
  emptyToUndefined,
} from '>/services';
import type {
  SessionData,
  EditDatabaseResponse,
  EditDatabaseRequest,
} from '>/types';

const EditDatabaseSchema = z.object({
  name: z.string().regex(dbNameAllowedChars, 'Invalid database name'),
  charset: z.preprocess(emptyToUndefined, z.string().optional()),
  collation: z.preprocess(emptyToUndefined, z.string().optional()),
});

export const editDatabase = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<EditDatabaseResponse> => {
      const request = EditDatabaseSchema.parse(req.body);
      const defaults = await getDatabaseServerDefaults(sessionData!);
      const charset = request.charset ?? defaults.charset;
      const collation = request.collation ?? defaults.collation;
      const name = request.name;
      const charsetExistsResult = await charsetExists({
        session: sessionData,
        charset,
      });
      if (!charsetExistsResult) {
        return {
          ok: false,
          database: undefined,
          message: 'Character set does not exist',
        };
      }
      const collationExistsResult = await collationExists({
        session: sessionData,
        collation,
        charset,
      });
      if (!collationExistsResult) {
        return {
          ok: false,
          database: undefined,
          message: 'Collation does not exist',
        };
      }
      const dbQuery = `ALTER DATABASE ${escapeId(name)} CHARACTER SET ${charset} COLLATE ${collation}`;
      const [result] =
        await sessionData.sqlSession.query<ResultSetHeader>(dbQuery);

      const isUpdated = result.warningStatus === 0;
      return {
        ok: isUpdated,
        database: name,
        message: isUpdated
          ? `Database ${name} changed successfully`
          : `Database ${name} update failed`,
      };
    },
  });
