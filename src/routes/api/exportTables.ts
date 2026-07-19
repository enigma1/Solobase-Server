import { escape } from 'mysql2';
import { createGzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { FastifyRequest, FastifyReply } from 'fastify';
import { escapeId, type RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { getEnvKey } from '>/config';
import { apiCallStream, getRealColumns, buildFilename } from '>/services';
import type { ExportTablesRequest } from '>/types';

const ExportTablesSchema = z.object({
  database: z.string().trim().min(1).max(64),
  tables: z.array(z.string().trim().min(1).max(64)).min(1),
});

// Return promise void because of streaming mode
export const exportTables = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallStream({
    req,
    rsp,
    fn: async (sessionData): Promise<void> => {
      const request = ExportTablesSchema.parse(req.body);
      const { database, tables } = request;

      const origin =
        getEnvKey('REFLECT_ORIGIN') === '1'
          ? req.headers.origin
          : getEnvKey('FRONTEND_ORIGIN');

      const raw = rsp.raw;

      raw.setHeader('Content-Type', 'application/gzip');
      raw.setHeader(
        'Content-Disposition',
        `attachment; filename="${buildFilename(tables)}.sql.gz"`,
      );
      raw.setHeader('Vary', 'Origin');
      if (origin) {
        raw.setHeader('Access-Control-Allow-Origin', origin);
      }
      raw.setHeader('Access-Control-Allow-Credentials', 'true');
      raw.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

      const gzip = createGzip();
      gzip.pipe(raw);
      gzip.write(`-- SQL Export for tables: ${tables.join(', ')}\n\n`);

      // Set the connection/session encoding
      gzip.write(`SET FOREIGN_KEY_CHECKS=0;\nSET NAMES utf8mb4;\n\n`);
      const buffer: string[] = [];

      const escapedDatabase = escapeId(database);
      gzip.write(`USE ${escapedDatabase};\n\n`);

      const exported = [];
      for (const tableName of tables) {
        try {
          const escapedTable = escapeId(tableName);

          // Optional
          gzip.write(`DROP TABLE IF EXISTS ${escapedTable};\n`);
          // Table Creation
          const [tableDetailRows] = await sessionData.sqlSession.query<
            RowDataPacket[]
          >(`SHOW CREATE TABLE ${escapedDatabase}.${escapedTable}`);
          const createSql = tableDetailRows[0]['Create Table'].trimEnd();
          gzip.write(`${createSql};\n\n`);

          const sql = `SELECT * FROM ${escapedDatabase}.${escapedTable}`;
          const stream: Readable = sessionData.streamSession
            .query(sql)
            .stream();

          const realColumns = await getRealColumns({
            sessionData,
            table: tableName,
            database: database,
          });

          const columnNamesSql = realColumns
            .map((col) => escapeId(col.field))
            .join(', ');

          for await (const row of stream) {
            const values = realColumns
              .map((col) => escape(row[col.field]))
              .join(', ');

            gzip.write(
              `INSERT INTO ${escapedDatabase}.${escapedTable} (${columnNamesSql}) VALUES (${values});\n`,
            );
          }
          gzip.write('\n');
          exported.push(tableName);
        } catch (e) {
          gzip.write(
            `-- ERROR EXPORTING ${database}.${tableName}: ${(e as Error).message}\n\n`,
          );
        }
      }
      gzip.write(`SET FOREIGN_KEY_CHECKS=1;\n`);
      gzip.end();
    },
  });
