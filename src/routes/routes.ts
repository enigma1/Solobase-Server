import { FastifyInstance } from 'fastify';
import {
  abortSql,
  cleanup,
  login,
  logout,
  selectDatabase,
  createDatabase,
  editDatabase,
  deleteDatabases,
  exportDatabases,
  exportTables,
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

export const routes = async (server: FastifyInstance) => {
  server.get('/api/active', async () => {
    return { ok: true };
  });
  server.get('/api/check-session', checkSession);
  server.get('/auth/presence', presence);
  server.post('/auth/login', login);
  server.get('/auth/logout', logout);
  server.get('/auth/cleanup', cleanup);

  server.get('/db/abort', abortSql);
  server.post('/db/select-database', selectDatabase);
  server.post('/db/create-user', createUser);
  server.post('/db/edit-user', editUser);
  server.post('/db/fetch-users', fetchUsers);
  server.post('/db/delete-users', deleteUsers);
  server.post('/db/fetch-databases', fetchDatabases);
  server.post('/db/fetch-tables', fetchTables);
  server.post('/db/run-raw-query', runRawQuery);
  server.post('/db/create-data-rows', createDataRows);
  server.post('/db/delete-data-rows', deleteDataRows);
  server.post('/db/update-data-rows', updateDataRows);
  server.post('/db/fetch-rows', fetchDataRows);
  server.post(
    '/db/import-data',
    {
      bodyLimit: 50 * 1024 * 1024,
    },
    importData,
  );
  server.post('/db/create-table', createTable);
  server.post('/db/edit-table', editTable);
  server.post('/db/delete-tables', deleteTables);
  server.post('/db/export-databases', exportDatabases);
  server.post('/db/export-tables', exportTables);
  server.post('/db/create-database', createDatabase);
  server.post('/db/edit-database', editDatabase);
  server.post('/db/delete-databases', deleteDatabases);
  server.post('/db/get-table-details', getTableDetails);
  server.post('/db/get-table-columns-info', getTableColumnsInfo);
  server.get('/db/fetch-database-info', fetchDatabaseInfo);
  server.post('/app/load-preferences', loadPreferences);
  server.post('/app/save-preferences', savePreferences);
};
