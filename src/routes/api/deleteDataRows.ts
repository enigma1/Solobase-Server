import { type ResultSetHeader, escapeId } from 'mysql2';
import { Scalar } from '@mysql/xdevapi';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  apiCallAuth,
  baseTableSchema,
  ScalarSchema,
  getRealColumns,
} from '>/services';
import type {
  SessionData,
  DeleteDataRowsRequest,
  DeleteDataRowsResponse,
} from '>/types';

const DeleteDataRowsSchema = z.object({
  ...baseTableSchema,
  rows: z.array(z.array(ScalarSchema)).min(1),
});

export const deleteDataRows = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<DeleteDataRowsResponse> => {
      const request = DeleteDataRowsSchema.parse(req.body);
      const { rows, database, table } = request;
      const columns = await getRealColumns({
        sessionData,
        database,
        table,
      });

      const results = await Promise.allSettled(
        rows.map(async (row) => {
          const values: Scalar[] = [];

          const whereClause = row
            .map((value, index) => {
              const col = columns[index];

              if (value === null) {
                return `${escapeId(col.field)} IS NULL`;
              }

              const normalizedValue =
                col.type.toLowerCase() === 'json' && value !== null
                  ? JSON.stringify(value)
                  : typeof value === 'boolean'
                    ? Number(value)
                    : value;

              values.push(normalizedValue as Scalar);

              return `${escapeId(col.field)} = ?`;
            })
            .join(' AND ');

          const sql = `DELETE FROM ${escapeId(database)}.${escapeId(table)} WHERE ${whereClause}`;
          const [result] = await sessionData.sqlSession.query<ResultSetHeader>(
            sql,
            values,
          );

          return {
            row,
            affectedRows: result.affectedRows,
          };
        }),
      );

      const affectedRows = results.reduce((acc, r) => {
        if (r.status === 'fulfilled') {
          return acc + r.value.affectedRows;
        }
        return acc;
      }, 0);

      const ok = affectedRows === rows.length;
      return {
        ok,
        message: ok
          ? `${affectedRows} rows successfully removed from ${table}`
          : `No rows were removed from in ${table}`,
        database,
        table,
      };
    },
  });
