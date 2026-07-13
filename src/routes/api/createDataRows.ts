import { type ResultSetHeader, escapeId } from 'mysql2';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  apiCallAuth,
  baseTableSchema,
  ScalarSchema,
  getRealColumns,
} from '>/services';
import type { CreateDataRowsRequest, CreateDataRowsResponse } from '>/types';

const InsertDataRowsSchema = z.object({
  ...baseTableSchema,
  rows: z.array(z.array(ScalarSchema)).min(1),
});

export const createDataRows = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<CreateDataRowsResponse> => {
      const request = InsertDataRowsSchema.parse(req.body);
      const { rows, database, table } = request;
      const cols = await getRealColumns({
        sessionData,
        database,
        table,
      });
      const columnsOrder = cols.map((c) => c.field);

      const escapedColumns = columnsOrder
        .map((col) => escapeId(col))
        .join(', ');

      const valuesSql = rows
        .map((row) => `(${row.map(() => '?').join(', ')})`)
        .join(',\n');

      const sql = `INSERT INTO ${escapeId(database)}.${escapeId(table)} (${escapedColumns}) VALUES ${valuesSql}`;
      const params = rows.flatMap((row) =>
        row.map((value, index) => {
          const column = cols[index];
          if (column.type.toLowerCase() === 'json' && value !== null) {
            return JSON.stringify(value);
          }

          return value;
        }),
      );
      const [result] = await sessionData.sqlSession.query<ResultSetHeader>(
        sql,
        params,
      );
      const wereInserted = result.warningStatus === 0;

      return {
        ok: wereInserted,
        message: wereInserted
          ? `${result.affectedRows} rows successfully inserted in ${table}`
          : `No rows were inserted in ${table}`,
        database,
        table,
      };
    },
  });
