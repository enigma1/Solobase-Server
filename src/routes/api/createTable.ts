import { escapeId, ResultSetHeader } from 'mysql2';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  apiCallAuth,
  collationExists,
  charsetExists,
  buildColumnsTransformer,
  buildKeysTransformer,
  appErrors,
} from '>/services';
import { CommonTableSchema } from '>/contracts';
import type { CreateTableResponse, CreateTableRequest } from '>/types';

const CreateTableSchema = CommonTableSchema;

export const createTable = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<CreateTableResponse> => {
      const request = CreateTableSchema.parse(req.body);
      const defaults = sessionData.defaults;
      const charset = request.charset ?? defaults.charset;
      const collation = request.collation ?? defaults.collation;
      const { database, table, cols, keys } = request;

      const charsetExistsResult = charsetExists({
        session: sessionData,
        charset,
      });
      if (!charsetExistsResult) {
        throw appErrors.domain(
          'charset_not_found',
          `Character set does not exist`,
        );
      }
      const collationExistsResult = collationExists({
        session: sessionData,
        collation,
        charset,
      });
      if (!collationExistsResult) {
        throw appErrors.domain(
          'collation_not_found',
          `Collation does not exist`,
        );
      }

      const colsList = buildColumnsTransformer({ cols });
      const keysList = buildKeysTransformer({ keys });
      const definitions = [...colsList, ...keysList].join(',\n');

      const dbQuery = `
        CREATE TABLE IF NOT EXISTS
        ${escapeId(database)}.${escapeId(table)} (
          ${definitions}
        )
        CHARACTER SET ${charset}
        COLLATE ${collation}
      `.trim();

      const [result] =
        await sessionData.sqlSession.query<ResultSetHeader>(dbQuery);

      const isCreated = result.warningStatus === 0;
      return {
        ok: isCreated,
        database,
        table,
        message: isCreated
          ? `Table ${table} created successfully in ${database}`
          : `Table ${table} already exists in ${database}`,
      };
    },
  });
