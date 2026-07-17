import { escapeId, ResultSetHeader } from 'mysql2/promise';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  apiCallAuth,
  collationExists,
  charsetExists,
  emptyToUndefined,
} from '>/services';
import type { CreateDatabaseResponse, CreateDatabaseRequest } from '>/types';

const CreateDatabaseSchema = z
  .object({
    name: z.string().trim().min(1).max(64),
    charset: z.preprocess(emptyToUndefined, z.string().optional()),
    collation: z.preprocess(emptyToUndefined, z.string().optional()),
  })
  .refine(
    (data) => {
      return !data.charset || !!data.collation;
    },
    {
      message: 'Collation is required when charset is specified',
      path: ['collation'],
    },
  );

export const createDatabase = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<CreateDatabaseResponse> => {
      const request = CreateDatabaseSchema.parse(req.body);
      const defaults = sessionData.defaults;
      const charset = request.charset ?? defaults.charset;
      const collation = request.collation ?? defaults.collation;
      const name = request.name;

      const charsetExistsResult = charsetExists({
        session: sessionData!,
        charset,
      });

      if (!charsetExistsResult) {
        return {
          ok: false,
          database: undefined,
          message: 'Character set does not exist',
        };
      }
      const collationExistsResult = collationExists({
        session: sessionData!,
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

      const dbQuery = `CREATE DATABASE IF NOT EXISTS ${escapeId(name)} CHARACTER SET ${charset} COLLATE ${collation}`;
      const [result] =
        await sessionData.sqlSession.query<ResultSetHeader>(dbQuery);

      const isCreated = result.warningStatus === 0;

      return {
        ok: isCreated,
        database: name,
        message: isCreated
          ? `Database ${name} created successfully`
          : `Database ${name} already exists`,
      };
    },
  });
