import { FastifyRequest, FastifyReply } from 'fastify';
import { escapeId, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import {
  apiCallAuth,
  baseTableSchema,
  getColumnsOrdered,
  appErrors,
  buildKeyWhereClause,
  selectWithKeys,
  whereWithKeys,
  whereWithValues,
  fingerprint,
  TokenRowSchema,
} from '>/services';
import { dbSession } from '>/db';
import type {
  DeleteDataRowsRequest,
  DeleteDataRowsResponse,
  SqlTransportRow,
  ChangedRow,
  MySqlError,
} from '>/types';

const DeletedRowSchema = z.object({
  originalRow: z.array(z.unknown()),
  rowToken: TokenRowSchema.optional(),
});

const DeleteDataRowsSchema = z.object({
  ...baseTableSchema,
  dataRows: z.array(DeletedRowSchema),
  orderBy: z.string().trim().min(1).max(256).optional(),
});

export const deleteDataRows = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<DeleteDataRowsResponse> => {
      const request = DeleteDataRowsSchema.parse(req.body);
      const { dataRows, database, table, orderBy } = request;

      await dbSession.activate({ sessionData, database, refresh: true });

      const {
        allKeys,
        uniqueKeys: keyColumns,
        cols,
        columnsOrder,
      } = await getColumnsOrdered({
        sessionData,
        database,
        table,
      });

      const affectedRows: number[] = [];
      for (const row of dataRows) {
        const values: unknown[] = [];

        let whereClause;
        if (keyColumns.length > 0) {
          whereClause = buildKeyWhereClause({
            keyColumns,
            columnsOrder,
            originalRow: row.originalRow as SqlTransportRow,
            values,
          });
          const query = `DELETE FROM ${escapeId(database)}.${escapeId(table)} WHERE ${whereClause}`;
          const [result] = await sessionData.sqlSession.query<ResultSetHeader>(
            query,
            values,
          );
          affectedRows.push(Number(result.affectedRows));
        } else {
          try {
            await sessionData.sqlSession.beginTransaction();
            const selectFirst = `SELECT * from ${escapeId(database)}.${escapeId(table)}`;
            const orderSql = orderBy
              ? escapeId(orderBy)
              : escapeId(columnsOrder[0]);

            const selectQuery = `${selectFirst} ORDER BY ${orderSql} LIMIT 1 OFFSET ?`;
            const sValues = [row.rowToken!.rowIndex];
            const [sResult] = await sessionData.sqlSession.query<
              RowDataPacket[]
            >(selectQuery, sValues);

            if (sResult.length === 0) {
              const mError = {
                errno: 0,
                code: 'invalid_row',
                sqlState: '0',
                sqlMessage: 'Data row does not exist',
                sql: selectQuery,
              };
              throw appErrors.mysql(mError);
            }

            const sqlRow = columnsOrder.map((col) => sResult[0][col]);
            const sFingerprint = fingerprint(sqlRow);

            if (sFingerprint === row.rowToken?.fingerprint) {
              const withKeys = await selectWithKeys({
                selectFirst,
                allKeys,
                columnsOrder,
                originalRow: row.originalRow as SqlTransportRow,
                sessionData,
              });

              if (withKeys) {
                whereClause = whereWithKeys({
                  allKeys,
                  row: row as ChangedRow,
                  columnsOrder,
                  values,
                });
              } else {
                whereClause = whereWithValues({
                  row: row as ChangedRow,
                  columnsOrder,
                  cols,
                  values,
                });
              }
              const deleteQuery = `DELETE FROM ${escapeId(database)}.${escapeId(table)} WHERE ${whereClause}`;

              const [result] =
                await sessionData.sqlSession.query<ResultSetHeader>(
                  deleteQuery,
                  values,
                );

              await sessionData.sqlSession.commit();
              affectedRows.push(Number(result.affectedRows));
            } else {
              const mError = {
                errno: 0,
                code: 'fingerprint_mismatch',
                sqlState: '0',
                sqlMessage: 'Could not match fingerprint',
                sql: selectQuery,
              };
              throw appErrors.mysql(mError);
            }
          } catch (e) {
            await sessionData.sqlSession.rollback();
            throw appErrors.mysql(e as MySqlError);
          }
        }
      }

      // const results = await Promise.allSettled(
      //   rows.map(async (row) => {
      //     const values: SqlRow = [];

      //     const whereClause = row
      //       .map((value, index) => {
      //         const col = columns[index];

      //         if (value === null) {
      //           return `${escapeId(col.field)} IS NULL`;
      //         }

      //         const normalizedValue =
      //           col.type.toLowerCase() === 'json' && value !== null
      //             ? JSON.stringify(value)
      //             : typeof value === 'boolean'
      //               ? Number(value)
      //               : value;

      //         values.push(normalizedValue as SqlTypes);

      //         return `${escapeId(col.field)} = ?`;
      //       })
      //       .join(' AND ');

      //     const sql = `DELETE FROM ${escapeId(database)}.${escapeId(table)} WHERE ${whereClause}`;
      //     const [result] = await sessionData.sqlSession.query<ResultSetHeader>(
      //       sql,
      //       values,
      //     );

      //     return {
      //       row,
      //       affectedRows: result.affectedRows,
      //     };
      //   }),
      // );

      // const affectedRows = results.reduce((acc, r) => {
      //   if (r.status === 'fulfilled') {
      //     return acc + r.value.affectedRows;
      //   }
      //   return acc;
      // }, 0);

      const ok = affectedRows.length > 0;
      const deleted = affectedRows.reduce((a, b) => a + b, 0);
      return {
        ok,
        message: ok
          ? `${deleted} rows successfully removed from ${table}`
          : `No rows were removed from in ${table}`,
        database,
        table,
      };
    },
  });
