import { createGzip } from 'node:zlib';
import { FastifyRequest, FastifyReply } from 'fastify';
import { escapeId, type RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { envConfig } from '>/config';
import {
  apiCall,
  apiCallStream,
  getDatabaseSchemaDetails,
  dbNameAllowedChars,
  getRealColumns,
} from '>/services/apiHelpers';
import type { ExportDatabasesRequest, ExportDatabasesResponse } from '>/types';
import { unknownToSql } from '>/services/utils';

const buildFilename = (databases: string[]) => {
  let result = '';

  for (const db of databases) {
    const next = result ? `${result}-${db}` : db;
    if (next.length > 100) break;
    result = next;
  }
  return result;
};

const ExportDatabasesSchema = z.object({
  databases: z
    .array(z.string().regex(dbNameAllowedChars, 'Invalid database name'))
    .min(1),
});
// Return promise void because of streaming mode
export const exportDatabases = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallStream({
    req,
    rsp,
    fn: async (sessionData) => {
      const request = ExportDatabasesSchema.parse(req.body);
      const { databases } = request;
      const raw = rsp.raw;

      raw.setHeader('Content-Type', 'application/gzip');
      raw.setHeader(
        'Content-Disposition',
        `attachment; filename="${buildFilename(databases)}.sql.gz"`,
      );
      raw.setHeader('Access-Control-Allow-Origin', envConfig.front.origin);
      raw.setHeader('Access-Control-Allow-Credentials', 'true');
      raw.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

      const gzip = createGzip();
      gzip.pipe(raw);
      gzip.write(`-- SQL Export for databases: ${databases.join(', ')}\n\n`);

      // Set the connection/session encoding
      gzip.write(`SET FOREIGN_KEY_CHECKS=0;\nSET NAMES utf8mb4;\n\n`);
      let rawQuery = '';
      const buffer: string[] = [];

      const exported = [];
      for (const dbName of databases) {
        try {
          const { charset, collation, escapedName } =
            await getDatabaseSchemaDetails(sessionData, dbName);
          rawQuery = `CREATE DATABASE IF NOT EXISTS ${escapedName}
              CHARACTER SET ${charset}
              COLLATE ${collation};
            `;
          gzip.write(`${rawQuery};\n\n`);

          const [tables] = await sessionData.sqlSession.query<RowDataPacket[]>(
            `SHOW TABLES FROM ${escapedName}`,
          );
          const tableNames = tables.map((row) => Object.values(row)[0]);
          for (const tableName of tableNames) {
            const escapedTable = escapeId(tableName);
            // Table Creation
            const [tableDetailRows] = await sessionData.sqlSession.query<
              RowDataPacket[]
            >(`SHOW CREATE TABLE ${escapedName}.${escapedTable}`);
            const createSql = tableDetailRows[0]['Create Table'].trimEnd();
            gzip.write(`${createSql};\n\n`);
            // Data Rows in a table
            const sql = `SELECT * FROM ${escapedName}.${escapedTable}`;
            const [rows] =
              await sessionData.sqlSession.query<RowDataPacket[]>(sql);
            // const stream = sessionData.sqlSession
            //   .query<RowDataPacket[]>(sql)
            //   .stream();
            const realColumns = await getRealColumns({
              sessionData: sessionData,
              tableName,
              dbName,
            });
            const columnNamesSql = realColumns
              .map((col) => escapeId(col[0]))
              .join(', ');

            for (const row of rows) {
              const values = realColumns
                .map((col) => {
                  const fieldName = col[0];
                  return unknownToSql(row[fieldName]);
                })
                .join(', ');

              gzip.write(
                `INSERT INTO ${escapedName}.${escapedTable} (${columnNamesSql}) VALUES (${values});\n`,
              );
            }
          }
          gzip.write('\n');
          exported.push(dbName);
        } catch (e) {
          gzip.write(
            `-- ERROR EXPORTING ${dbName}: ${(e as Error).message}\n\n`,
          );
          // failedDbs.push(dbName);
        }
        // sessionData?.sqlSession.escape;
      }
      gzip.write(`SET FOREIGN_KEY_CHECKS=1;\n`);
      gzip.end();
    },
  });
