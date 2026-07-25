import { FastifyRequest, FastifyReply } from 'fastify';
import { escapeId, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { dbSession } from '>/db';
import {
  apiCallAuth,
  appErrors,
  getColumnsOrdered,
  fingerprint,
  isBinary,
  buildKeyWhereClause,
  selectWithKeys,
  whereWithKeys,
  whereWithValues,
  transformSqlValue,
  remapSqlValue,
} from '>/services';
import { baseTableSchema, TokenRowSchema } from '>/contracts';

import type {
  UpdateDataRowsResponse,
  UpdateDataRowsRequest,
  ChangedRow,
  SqlTransportRow,
  MySqlError,
} from '>/types';

const ChangedRowSchema = z.object({
  originalRow: z.array(z.unknown()),
  updatedValues: z.record(z.string(), z.unknown()),
  rowToken: TokenRowSchema.optional(),
});

const UpdateDataRowsSchema = z.object({
  ...baseTableSchema,
  dataRows: z.array(ChangedRowSchema),
  orderBy: z.string().trim().min(1).max(256).optional(),
});

export const updateDataRows = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<UpdateDataRowsResponse> => {
      const request = UpdateDataRowsSchema.parse(req.body);
      const { database, table, dataRows, orderBy } = request;

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

      // Construct queries for update
      const affectedRows: number[] = [];
      for (const row of dataRows) {
        const values: unknown[] = [];

        const setClauses = Object.entries(row.updatedValues)
          .filter(([name]) => cols[name])
          .map(([col, val]) => {
            if (val === null) {
              return `${escapeId(col)} = NULL`;
            }

            const type = cols[col].type;
            if (type.startsWith('json')) {
              values.push(JSON.stringify(val));
              return `${escapeId(col)} = CAST(? AS JSON)`;
            }

            values.push(transformSqlValue(type, val));
            return `${escapeId(col)} = ${remapSqlValue(type)}`;
          })
          .join(', ');

        let whereClause;
        if (keyColumns.length > 0) {
          whereClause = buildKeyWhereClause({
            cols,
            keyColumns,
            columnsOrder,
            originalRow: row.originalRow as SqlTransportRow,
            values,
          });
          const query = `UPDATE ${escapeId(database)}.${escapeId(table)} SET ${setClauses} WHERE ${whereClause}`;
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
              throw mError;
            }

            const sqlRow = columnsOrder.map((col) => sResult[0][col]);
            const sFingerprint = fingerprint(sqlRow);

            if (sFingerprint === row.rowToken?.fingerprint) {
              const withKeys = await selectWithKeys({
                cols,
                columnsOrder,
                selectFirst,
                allKeys,
                originalRow: row.originalRow as SqlTransportRow,
                sessionData,
              });

              if (withKeys) {
                whereClause = whereWithKeys({
                  cols,
                  columnsOrder,
                  row: row as ChangedRow,
                  allKeys,
                  values,
                });
              } else {
                whereClause = whereWithValues({
                  cols,
                  columnsOrder,
                  row: row as ChangedRow,
                  values,
                });
              }

              const updateQuery = `UPDATE ${escapeId(database)}.${escapeId(table)} SET ${setClauses} WHERE ${whereClause}`;
              const [result] =
                await sessionData.sqlSession.query<ResultSetHeader>(
                  updateQuery,
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
              throw mError;
            }
          } catch (e) {
            await sessionData.sqlSession.rollback();
            throw appErrors.mysql(e as MySqlError);
          }
        }
      }
      return {
        ok: affectedRows.length > 0,
        database,
        table,
        message: `Rows updated successfully`,
      };
    },
  });
