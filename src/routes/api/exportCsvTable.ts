import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { FastifyRequest, FastifyReply } from 'fastify';
import { escapeId } from 'mysql2';
import { stringify } from 'csv-stringify';
import { z } from 'zod';
import { getEnvKey } from '>/config';
import {
  apiCallStream,
  isSpatial,
  buildOrderBy,
  buildWhere,
  getColumnsOrdered,
} from '>/services';
import {
  baseTableSchema,
  baseSortSchema,
  baseFiltersSchema,
} from '>/contracts';

export const ExportFileFormatSchema = z.enum(['csv', 'xlsx']);

const ExportTableSchema = z.object({
  ...baseTableSchema,
  ...baseSortSchema,
  ...baseFiltersSchema,
  format: ExportFileFormatSchema,
});

// Return promise void because of streaming mode
export const exportCsvTable = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallStream({
    req,
    rsp,
    fn: async (sessionData): Promise<void> => {
      const request = ExportTableSchema.parse(req.body);
      const { database, table, sortBy, filters } = request;

      const origin =
        getEnvKey('REFLECT_ORIGIN') === '1'
          ? req.headers.origin
          : getEnvKey('FRONTEND_ORIGIN');

      const raw = rsp.raw;

      raw.setHeader('Content-Type', 'application/gzip');
      raw.setHeader(
        'Content-Disposition',
        `attachment; filename="${table}.csv.gz"`,
      );

      raw.setHeader('Vary', 'Origin');
      if (origin) {
        raw.setHeader('Access-Control-Allow-Origin', origin);
      }
      raw.setHeader('Access-Control-Allow-Credentials', 'true');
      raw.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

      const { cols, columnsOrder } = await getColumnsOrdered({
        sessionData,
        table,
        database,
      });

      const gzip = createGzip();
      const csv = stringify({
        header: true,
        columns: columnsOrder,
      });
      const pipelinePromise = pipeline(csv, gzip, raw);
      const escapedColumns = columnsOrder
        .map((col) => {
          const type = cols[col].type.toLowerCase();

          if (isSpatial(type)) {
            return `ST_AsGeoJSON(${escapeId(col)}) AS ${escapeId(col)}`;
          }

          return escapeId(col);
        })
        .join(', ');

      const orderBy = buildOrderBy({ sortBy, firstColumn: columnsOrder[0] });
      const { sql: where, values: whereValues } = buildWhere({ filters });

      const escapedDatabase = escapeId(database);
      const escapedTable = escapeId(table);

      const sql = `SELECT ${escapedColumns} FROM ${escapedDatabase}.${escapedTable} ${where} ${orderBy}`;

      const stream: Readable = sessionData.streamSession
        .query(sql, whereValues)
        .stream();

      for await (const row of stream) {
        csv.write(row);
      }

      csv.end();
      await pipelinePromise;
    },
  });
