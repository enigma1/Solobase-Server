import { FastifyRequest, FastifyReply } from 'fastify';
import {
  apiCallAuth,
  getTableInfo,
  isObjectEmpty,
  indexBy,
  appErrors,
  CommonBaseTableSchema,
} from '>/services';

import type {
  GetTableColumnsInfoRequest,
  GetTableColumnsInfoResponse,
} from '>/types';

export const getTableColumnsInfo = async (
  req: FastifyRequest,
  rsp: FastifyReply,
) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<GetTableColumnsInfoResponse> => {
      const request = CommonBaseTableSchema.parse(req.body);
      const { database, table } = request;
      const info = await getTableInfo(sessionData, table, database);
      if (!info) {
        throw appErrors.server(404, 'A Database and/or Table was not found');
      }
      const { cols } = info;
      const colNames = cols.map((c) => c.field);
      if (!colNames.length) {
        throw appErrors.server(500, 'Query error - No columns found in table');
      }

      const columnsObj = indexBy(cols, 'field');

      if (isObjectEmpty(columnsObj)) {
        throw appErrors.server(500, 'Query error - No columns found in table');
      }

      return {
        ok: true,
        message: `Information from ${database}/${table} retrieved successfully`,
        database,
        table,
        rows: [],
        cols: columnsObj,
        columnsOrder: cols.map((c) => c.field),
      };
    },
  });
