import { ExprOrLiteral } from '@mysql/xdevapi';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  apiCallAuth,
  withAppSession,
  formatQuery,
  normalizeColumn,
  appErrors,
  indexBy,
} from '>/services';
import { envConfig, limitsConfig } from '>/config';
import { dbSession } from '>/db';
import type {
  PrimeObject,
  BasicResponse,
  ApiResponse,
  RunQueryRequest,
  RunQueryResponse,
} from '>/types';

export const runQuery = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<RunQueryResponse> => {
      const data = dbSession.get(sessionData!.sessionId);
      const { query } = req.body as RunQueryRequest;
      if (!data.dbSelected) {
        throw appErrors.server(
          500,
          'No Database selected - Invalid Query Request',
        );
      }
      const executableQuery = formatQuery(query);
      const result = await data.xSession.sql(executableQuery).execute();

      const rows = [];
      let row;
      let count = 0;
      while ((row = result.fetchOne())) {
        rows.push(row);
        count++;
        if (count >= limitsConfig.maxRowsFetch) break;
      }
      const truncated = count >= limitsConfig.maxRowsFetch;
      // const cols: SqlColumns[] = result.getColumns().map(normalizeColumn);
      const normalizedCols = result.getColumns().map(normalizeColumn);
      const columnsOrder = normalizedCols.map((c) => c.field);
      const cols = indexBy(normalizedCols, 'field');

      // const cols: Record<string, SqlColumns> = result.getColumns().reduce(
      //   (acc, col) => {
      //     const normalized = normalizeColumn(col);
      //     acc[normalized.field] = normalized;
      //     return acc;
      //   },
      //   {} as Record<string, SqlColumns>,
      // );
      // const rows = result.fetchAll();
      // const cols = result.getColumns().map((col) => col.getColumnLabel());
      return { rows, cols, columnsOrder, query, truncated };
    },
  });
