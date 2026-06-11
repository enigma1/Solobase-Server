import { FastifyRequest, FastifyReply } from 'fastify';
import { SortExprStrList } from '@mysql/xdevapi/types';
import { escapeId, ResultSetHeader, RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { JSONObject } from 'type-plus';
import { apiCallAuth, getTableInfo } from '>/services/apiHelpers';
import {
  getIntegers,
  isObjectEmpty,
  indexBy,
  sortByAllowedChars,
  appErrors,
} from '>/services';
import { envConfig, limitsConfig } from '>/config';
import type {
  SessionData,
  FetchRowsRequest,
  FetchRowsResponse,
  CollectionRow,
} from '>/types';

const FetchDataRowsSchema = z.object({
  table: z.string(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  sortBy: z
    .array(z.string().regex(sortByAllowedChars, 'Invalid sortBy format'))
    .optional(),
});

export const fetchDataRows = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<FetchRowsResponse> => {
      const schema = sessionData.dbSelected
        ? sessionData.xSession.getSchema(sessionData.dbSelected)
        : null;

      if (!schema) {
        throw appErrors.server(404, 'A Database was not selected');
      }

      const request = FetchDataRowsSchema.parse(req.body);
      const {
        table,
        limit = 100,
        offset = 0,
        sortBy,
      } = request as FetchRowsRequest;

      // const tables = await schema.getTables();
      // if (!tables.some((t) => t.getName() === table)) {
      //   throw req.server.httpErrors.notFound('Database Table not found');
      // }

      // console.log(
      //   'fetchRows Call',
      //   sessionData!.dbSelected,
      //   table,
      //   offset,
      //   limit,
      // );

      // .sort(['name ASC', 'age DESC'])
      // const cTable = schema.getCollection(table); // use getCollection instead of getTable
      // const docs = await cTable.find().limit(limit).offset(offset).execute(); // get all rows
      // const rows = docs.fetchAll(); // array of documents

      // use dbSession.activate for raw queries when db changes
      const range = getIntegers(
        [limit, offset],
        [limitsConfig.maxRowsFetch, 0],
      );
      const [safeLimit, safeOffset] = [
        Math.min(range[0], limitsConfig.maxRowsFetch),
        Math.max(range[1], 0),
      ];

      const info = await getTableInfo(sessionData, table);
      if (!info) {
        throw appErrors.server(404, 'A Database Table was not found');
      }
      const { tableType, cols } = info;

      if (tableType === 'collection') {
        const cTable = schema.getCollection(table); // use getCollection instead of getTable
        const find = cTable.find();
        let cmdObj = find;
        if (sortBy) {
          cmdObj = find.sort(sortBy);
        }
        cmdObj = cmdObj.offset(safeOffset).limit(safeLimit);
        const docs = await cmdObj.execute();
        const rows = docs.fetchAll() as CollectionRow[];
        const columnsOrder = cols.map((c) => c.field);
        return {
          type: 'collection',
          rows,
          cols: { _id: '', doc: {} satisfies JSONObject },
          columnsOrder,
        };
      } else {
        // const colNames = cols.map((c) => getSqlString(c.field));
        const colNames = cols.map((c) => c.field);
        if (!colNames.length) {
          throw appErrors.server(
            500,
            'Query error - No columns found in table',
          );
        }

        const columnsObj = indexBy(cols, 'field');

        if (isObjectEmpty(columnsObj)) {
          throw appErrors.server(
            500,
            'Query error - No columns found in table',
          );
        }

        const paginationSql = `LIMIT ${safeLimit} OFFSET ${safeOffset}`;
        const dbQuery = `SELECT ${colNames.join(', ')} FROM ${escapeId(table)} ${paginationSql}`;
        const [sqlRows] =
          await sessionData!.sqlSession.query<RowDataPacket[]>(dbQuery);
        const rows = sqlRows.map((row) => colNames.map((col) => row[col]));
        // const rowsArray = await sessionData!.xSession.sql(dbQuery).execute();
        // const rows = rowsArray.fetchAll();
        // console.log('fetchRows Query', colNames, rows);
        // throw req.server.httpErrors.internalServerError(
        //   'Forcing error to test client handling of server errors',
        // );

        return {
          type: 'table',
          rows,
          cols: columnsObj,
          columnsOrder: cols.map((c) => c.field),
        };
      }
    },
  });
