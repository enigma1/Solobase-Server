import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  NonSqlRowsRequest,
  NonSqlRowsResponse,
  // SqlColumnType,
} from '>/types';
import {
  abortSql,
  login,
  logout,
  selectDatabase,
  createDatabase,
  editDatabase,
  deleteDatabases,
  exportDatabases,
  getTableDetails,
  getTableColumnsInfo,
  fetchDatabaseInfo,
  fetchDatabases,
  fetchDataRows,
  fetchTables,
  fetchUsers,
  deleteUsers,
  createUser,
  editUser,
  createDataRows,
  deleteDataRows,
  updateDataRows,
  presence,
  savePreferences,
  loadPreferences,
  runRawQuery,
  createTable,
  editTable,
  deleteTables,
  checkSession,
  importData,
} from './api';

// const getNonSqlRows = (req: FastifyRequest, rsp: FastifyReply) =>
//   apiCallAuth({
//     req,
//     rsp,
//     fn: async (sessionData): Promise<NonSqlRowsResponse> => {
//       const { table, rows: rowsIds } = req.body as NonSqlRowsRequest;
//       const schema = sessionData!.dbSelected
//         ? sessionData!.xSession.getSchema(sessionData!.dbSelected)
//         : null;
//       if (!schema) {
//         throw appErrors.server(404, 'A Database was not selected');
//       }

//       const cTable = schema.getCollection(table);
//       const ids = rowsIds.map((r) => `"${r._id}"`).join(', ');
//       const whereStr = `_id in (${ids})`;
//       const docs = await cTable.find(whereStr).execute();
//       const rows = docs.fetchAll();
//       return { rows } as NonSqlRowsResponse;
//     },
//   });

// const setNonSqlRows = async (req: FastifyRequest, rsp: FastifyReply) =>
//   apiCallAuth({
//     req,
//     rsp,
//     fn: async (sessionData): Promise<NonSqlRowsResponse> => {
//       const { table, rows: rowsIds } = req.body as NonSqlRowsRequest;
//       const schema = sessionData!.dbSelected
//         ? sessionData!.xSession.getSchema(sessionData!.dbSelected)
//         : null;
//       if (!schema) {
//         throw appErrors.server(500, 'A Database was not selected');
//       }

//       const cTable = schema.getCollection(table);
//       // cTable.modify(rowsIds[0]._id).set(rowsIds[0]).execute();
//       // cTable.replaceOne(rowsIds[0]._id, rowsIds[0]);
//       const ids = rowsIds.map((r) => `"${r._id}"`).join(', ');
//       const whereStr = `_id in (${ids})`;
//       const docs = await cTable.find(whereStr).execute();
//       const rows = docs.fetchAll();
//       // test2
//       return { rows } as NonSqlRowsResponse;
//     },
//   });

export const routes = async (server: FastifyInstance) => {
  server.get('/api/active', async () => {
    return { ok: true };
  });
  server.get('/api/check-session', checkSession);
  server.get('/auth/presence', presence);
  server.get('/db/abort', abortSql);
  server.post('/auth/login', login);
  server.get('/auth/logout', logout);
  server.post('/db/select-database', selectDatabase);
  server.post('/db/create-user', createUser);
  server.post('/db/edit-user', editUser);
  server.get('/db/fetch-users', fetchUsers);
  server.post('/db/delete-users', deleteUsers);
  server.get('/db/fetch-databases', fetchDatabases);
  server.post('/db/fetch-tables', fetchTables);
  server.post('/db/run-raw-query', runRawQuery);
  server.post('/db/create-data-rows', createDataRows);
  server.post('/db/delete-data-rows', deleteDataRows);
  server.post('/db/update-data-rows', updateDataRows);
  server.post('/db/fetch-rows', fetchDataRows);
  server.post(
    '/db/import-data',
    {
      config: {
        bodyLimit: 50 * 1024 * 1024,
      },
    },
    importData,
  );
  server.post('/db/create-table', createTable);
  server.post('/db/edit-table', editTable);
  server.post('/db/delete-tables', deleteTables);
  server.post('/db/export-databases', exportDatabases);
  server.post('/db/create-database', createDatabase);
  server.post('/db/edit-database', editDatabase);
  server.post('/db/delete-databases', deleteDatabases);
  server.post('/db/get-table-details', getTableDetails);
  server.post('/db/get-table-columns-info', getTableColumnsInfo);
  server.get('/db/fetch-database-info', fetchDatabaseInfo);
  server.get('/app/load-preferences', loadPreferences);
  server.post('/app/save-preferences', savePreferences);

  // server.post('/db/nosql/update', updateCollections);
  // server.post('/db/nosql/get-rows', getNonSqlRows);
  // server.post('/db/nosql/set-rows', setNonSqlRows);
};
