import { FastifyRequest, FastifyReply } from 'fastify';
import mysqlx, { Literal } from '@mysql/xdevapi';
import { z } from 'zod';
import { apiCallAuth, getTableInfo, getSqlString, appErrors } from '>/services';

import type {
  SessionData,
  EditedCollectionRow,
  UpdateDataRowsResponse,
  UpdateDataRowsRequest,
  BasicResponse,
} from '>/types';
import { envConfig } from '>/config';

type UpdateCollectionsProps = {
  req: FastifyRequest;
  schema: mysqlx.Schema;
};

const updateCollections = async ({
  req,
  // session,
  schema,
}: UpdateCollectionsProps) => {
  const { table, dataRows } = req.body as {
    table: string;
    dataRows: EditedCollectionRow[];
  };

  const cTable = schema.getCollection(table);

  const affectedRows = await Promise.all(
    dataRows.map(async (row) => {
      const result = cTable.replaceOne(row.originalRow._id, row.updatedValues);
      return Number(result.getAffectedItemsCount());
    }),
  );

  return affectedRows;

  // cTable.modify(rowsIds[0]._id).set(rowsIds[0]).execute();
  // cTable.replaceOne(rowsIds[0]._id, rowsIds[0]);
  // Implementation for updating non-SQL rows
};

export const updateDataRows = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<UpdateDataRowsResponse> => {
      const { table, dataRows, command, database } =
        req.body as UpdateDataRowsRequest;
      const schema = sessionData.dbSelected
        ? sessionData.xSession.getSchema(sessionData.dbSelected)
        : null;
      if (!schema) {
        throw appErrors.server(404, 'A Database was not selected');
      }
      const tableInfo = await getTableInfo(sessionData, table);
      if (!tableInfo) {
        throw appErrors.server(404, 'Database Table was not found');
      }
      const { tableType, cols: colsArray } = tableInfo;
      if (tableType === 'collection') {
        const cRows = await updateCollections({
          req,
          schema,
        });
        return {
          ok: cRows.length > 0,
          database,
          table,
          message: `Rows updated successfully`,
        };
      }
      // SQL Rows
      const colNames = colsArray.map((c) => c.field);
      // Construct queries for update
      const affectedRowsInt64 = await Promise.all(
        dataRows.map(async (row) => {
          const values: Literal = [];
          const setClauses = Object.entries(row.updatedValues)
            .filter(([name]) => colNames.includes(name))
            .map(([col, val]) => {
              if (val === null) {
                return `${getSqlString(col)} = NULL`; // no placeholder
              }
              values.push(val);
              return `${getSqlString(col)} = ?`;
            })
            .join(', ');

          const whereClause = Object.entries(row.originalRow)
            .filter((_, idx) => colNames[idx])
            .map(([, val], idx) => {
              if (val === null) {
                return `${getSqlString(colNames[idx])} IS NULL`; // special syntax
              }
              values.push(val);
              return `${getSqlString(colNames[idx])} = ?`;
            })
            .join(' AND ');
          const query = `UPDATE ${getSqlString(table)} SET ${setClauses} WHERE ${whereClause}`;
          const result = await sessionData.xSession
            .sql(query)
            .bind(values)
            .execute();
          return result.getAffectedItemsCount();
        }),
      );
      // Execute updates in a transaction
      const affectedRows = affectedRowsInt64.map((n) => Number(n));
      return {
        ok: affectedRows.length > 0,
        database,
        table,
        message: `Rows updated successfully`,
      };
    },
  });
