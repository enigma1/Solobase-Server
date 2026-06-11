import { envConfig, limitsConfig } from '>/config';
import { v4 as uuidv4 } from 'uuid';
import { JSONObject } from 'type-plus';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { apiCall } from '>/services/apiHelpers';
import { appErrors } from '>/services';
import {
  NonSqlRowsRequest,
  NonSqlRowsResponse,
  // SqlColumnType,
} from '>/types';
import {
  login,
  logout,
  selectDatabase,
  createDatabase,
  editDatabase,
  deleteDatabases,
  exportDatabases,
  getTableDetails,
  fetchDatabaseInfo,
  fetchDatabases,
  fetchDataRows,
  fetchDatabasesCommon,
  fetchTables,
  updateRows,
  presence,
  savePreferences,
  loadPreferences,
  runQuery,
  createTable,
  editTable,
  deleteTables,
} from './api';

const getNonSqlRows = (req: FastifyRequest, rsp: FastifyReply) =>
  apiCall({
    req,
    rsp,
    fn: async (sessionData): Promise<NonSqlRowsResponse> => {
      const { table, rows: rowsIds } = req.body as NonSqlRowsRequest;
      const schema = sessionData!.dbSelected
        ? sessionData!.xSession.getSchema(sessionData!.dbSelected)
        : null;
      if (!schema) {
        throw appErrors.server(404, 'A Database was not selected');
      }

      const cTable = schema.getCollection(table);
      const ids = rowsIds.map((r) => `"${r._id}"`).join(', ');
      const whereStr = `_id in (${ids})`;
      const docs = await cTable.find(whereStr).execute();
      const rows = docs.fetchAll();
      return { rows } as NonSqlRowsResponse;
    },
  });

const setNonSqlRows = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCall({
    req,
    rsp,
    fn: async (sessionData): Promise<NonSqlRowsResponse> => {
      const { table, rows: rowsIds } = req.body as NonSqlRowsRequest;
      const schema = sessionData!.dbSelected
        ? sessionData!.xSession.getSchema(sessionData!.dbSelected)
        : null;
      if (!schema) {
        throw appErrors.server(500, 'A Database was not selected');
      }

      const cTable = schema.getCollection(table);
      // cTable.modify(rowsIds[0]._id).set(rowsIds[0]).execute();
      // cTable.replaceOne(rowsIds[0]._id, rowsIds[0]);
      const ids = rowsIds.map((r) => `"${r._id}"`).join(', ');
      const whereStr = `_id in (${ids})`;
      const docs = await cTable.find(whereStr).execute();
      const rows = docs.fetchAll();
      // cTable.modify(whereStr).set( (e) => {})
      return { rows } as NonSqlRowsResponse;
    },
  });

// const updateRows = async (req: FastifyRequest, rsp: FastifyReply) =>
//   apiCall({
//     req,
//     rsp,
//     fn: async (sessionData): Promise<UpdateRowsResponse> => {
//       const { table, dataRows, command } = req.body as UpdateRowsRequest;
//       const schema = sessionData!.dbSelected
//         ? sessionData!.xSession.getSchema(sessionData!.dbSelected)
//         : null;
//       if (!schema) {
//         throw req.server.httpErrors.notFound('A Database was not selected');
//       }
//       const tableInfo = await getTableInfo(sessionData!, table);
//       if (!tableInfo) {
//         throw req.server.httpErrors.notFound('Database Table not found');
//       }
//       const { tableType, cols: colsArray } = tableInfo;
//       if (tableType === 'collection') {
//         return await updateCollections({
//           req,
//           schema,
//         });
//       }
//       const colNames = colsArray.map((c) => c.field);
//       // Construct queries for update
//       const affectedRowsInt64 = await Promise.all(
//         dataRows.map(async (row) => {
//           const values: Literal = [];
//           const setClauses = Object.entries(row.updatedValues)
//             .filter(([name]) => colNames.includes(name))
//             .map(([col, val]) => {
//               if (val === null) {
//                 return `${getSqlString(col)} = NULL`; // no placeholder
//               }
//               values.push(val);
//               return `${getSqlString(col)} = ?`;
//             })
//             .join(', ');

//           const whereClause = Object.entries(row.originalRow)
//             .filter((_, idx) => colNames[idx])
//             .map(([, val], idx) => {
//               if (val === null) {
//                 return `${getSqlString(colNames[idx])} IS NULL`; // special syntax
//               }
//               values.push(val);
//               return `${getSqlString(colNames[idx])} = ?`;
//             })
//             .join(' AND ');
//           const query = `UPDATE ${getSqlString(table)} SET ${setClauses} WHERE ${whereClause}`;
//           const result = await sessionData!.xSession
//             .sql(query)
//             .bind(values)
//             .execute();
//           return result.getAffectedItemsCount();
//         }),
//       );
//       // Execute updates in a transaction
//       const affectedRows = affectedRowsInt64.map((n) => Number(n));
//       return affectedRows;
//     },
//   });

// type UpdateCollectionsProps = {
//   req: FastifyRequest;
//   // session: mysqlx.Session;
//   schema: mysqlx.Schema;
// };

// const updateCollections = async ({
//   req,
//   // session,
//   schema,
// }: UpdateCollectionsProps): Promise<UpdateRowsResponse> => {
//   const { table, dataRows } = req.body as {
//     table: string;
//     dataRows: EditedCollectionRow[];
//   };

//   const cTable = schema.getCollection(table);

//   const affectedRows = await Promise.all(
//     dataRows.map(async (row) => {
//       const result = cTable.replaceOne(row.originalRow._id, row.updatedValues);
//       return Number(result.getAffectedItemsCount());
//     }),
//   );

//   return affectedRows;

//   // cTable.modify(rowsIds[0]._id).set(rowsIds[0]).execute();
//   // cTable.replaceOne(rowsIds[0]._id, rowsIds[0]);
//   // Implementation for updating non-SQL rows
// };

// const exportDatabase = async (req: FastifyRequest, rsp: FastifyReply) =>
//   apiCall({
//     req,
//     rsp,
//     fn: async (sessionData) => {
//       const { xSession, dbSelected } = sessionData as SessionData;
//       if (!dbSelected) {
//         throw req.server.httpErrors.notFound('A Database was not selected');
//       }
//       const schema = xSession.getSchema(dbSelected);
//       const tables = await schema.getTables();
//       const exportData: Record<string, unknown[]> = {};
//       for (const table of tables) {
//         const tableName = table.getName();
//         const cTable = schema.getCollection(tableName); // use getCollection instead of getTable
//         const docs = await cTable.find().execute(); // get all rows
//         const rows = docs.fetchAll(); // array of documents
//         exportData[tableName] = rows;
//       }
//       return exportData;
//     },
//   });

// const fetchTables2 = async (req: FastifyRequest, rsp: FastifyReply) =>
//   apiCall({
//     req,
//     rsp,
//     fn: async (sessionData) => {
//       const { xSession, dbSelected, schemas } = sessionData as SessionData;
//       const request = req.body as FetchTablesRequest;
//       const dbName = request.database ?? dbSelected;
//       const dbSafeName = schemas.find((s) => s.getName() === dbName)?.getName();

//       if (!dbSafeName) {
//         throw req.server.httpErrors.notFound('No database found');
//       }
//       // Update selected database in the session
//       sessionData!.dbSelected = dbSafeName;
//       const tables = await xSession.getSchema(dbSafeName).getTables();
//       return {
//         tables: tables.reduce(
//           (acc, t) => {
//             acc[t.getName()] = t;
//             return acc;
//           },
//           {} as Record<string, Table>,
//         ),
//       };
//     },
//   });

export const routes = async (server: FastifyInstance) => {
  server.get('/api/active', async () => {
    return { ok: true };
  });
  server.get('/auth/presence', presence);
  server.post('/auth/login', login);
  server.get('/auth/logout', logout);
  server.post('/db/select-database', selectDatabase);
  server.get('/db/fetch-databases', fetchDatabases);
  server.post('/db/fetch-tables', fetchTables);
  server.post('/db/run-query', runQuery);
  server.post('/db/fetch-rows', fetchDataRows);
  server.post('/db/update-rows', updateRows);
  // server.post('/db/export-database', exportDatabase);
  server.post('/db/create-table', createTable);
  server.post('/db/edit-table', editTable);
  server.post('/db/delete-tables', deleteTables);
  server.post('/db/export-databases', exportDatabases);
  server.post('/db/create-database', createDatabase);
  server.post('/db/edit-database', editDatabase);
  server.post('/db/delete-databases', deleteDatabases);
  server.post('/db/get-table-details', getTableDetails);
  server.get('/db/fetch-database-info', fetchDatabaseInfo);
  server.get('/app/load-preferences', loadPreferences);
  server.post('/app/save-preferences', savePreferences);

  // server.post('/db/nosql/update', updateCollections);
  server.post('/db/nosql/get-rows', getNonSqlRows);
  server.post('/db/nosql/set-rows', setNonSqlRows);
};
