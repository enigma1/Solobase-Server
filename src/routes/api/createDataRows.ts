import { type ResultSetHeader, escapeId } from 'mysql2';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  apiCallAuth,
  getRealColumns,
  remapSqlValue,
  transformSqlValue,
} from '>/services';
import { baseTableSchema, ScalarSchema } from '>/contracts';
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
        .map(
          (row) =>
            `(${row
              .map((_, index) => remapSqlValue(cols[index].type))
              .join(', ')})`,
        )
        .join(',\n');

      const sql = `INSERT INTO ${escapeId(database)}.${escapeId(table)} (${escapedColumns}) VALUES ${valuesSql}`;
      const params = rows.flatMap((row) =>
        row.map((value, index) => {
          const column = cols[index];
          return transformSqlValue(column.type, value);
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
