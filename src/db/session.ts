import { v4 as uuidv4 } from 'uuid';
import mysqlStream, { type RowDataPacket } from 'mysql2';
import mysql, { escapeId } from 'mysql2/promise';
import mysqlx from '@mysql/xdevapi';
import { envConfig } from '>/config';
import { LoginRequest, SessionData } from '>/types';
import {
  getCurrentTimestamp,
  appErrors,
  getMysqlCapabilities,
  sqlSessionInterceptor,
  xSessionInterceptor,
  streamSessionInterceptor,
  createQueryLogger,
} from '>/services';

export const sessionStore = new Map<string, SessionData>();
export const sessionJanitor = () => {
  setInterval(async () => {
    const now = getCurrentTimestamp();

    for (const [sessionId, session] of sessionStore.entries()) {
      const idle = now - session.lastSqlActivity;

      if (idle > envConfig.sqlIdleTimeout) {
        await remove(sessionId, true);
      }
    }
  }, envConfig.pollingIdleTimer);
};

const create = async (body: LoginRequest): Promise<SessionData> => {
  // xDevApi connection
  const xSession = await mysqlx.getSession({
    host: envConfig.dbUser.host,
    port: envConfig.dbUser.port,
    user: body.username,
    password: body.password,
  });

  // Classic MySQL connection use classic protocol
  const sqlSession = await mysql.createConnection({
    host: envConfig.dbSqlUser.host,
    port: envConfig.dbSqlUser.port,
    user: body.username,
    password: body.password,
    database: undefined,
    dateStrings: true,
    multipleStatements: false,
  });

  // For streamed connection use a separate one
  const streamSession = mysqlStream.createConnection({
    host: envConfig.dbSqlUser.host,
    port: envConfig.dbSqlUser.port,
    user: body.username,
    password: body.password,
    database: undefined,
    dateStrings: true,
    multipleStatements: false,
  });

  const logger = createQueryLogger();
  const xSessionProxy = xSessionInterceptor({ xSession, push: logger.push });
  const sqlSessionProxy = sqlSessionInterceptor({
    sqlSession,
    push: logger.push,
  });
  const streamSessionProxy = streamSessionInterceptor({
    streamSession,
    push: logger.push,
  });

  // getSchemas on xDevApi connector might be async!!
  const schemas = await xSession.getSchemas();
  const caps = await getMysqlCapabilities(sqlSession);

  const sessionId = uuidv4(); // generate unique session ID
  const sessionData = {
    ...caps,
    sessionId,
    // xSession,
    // sqlSession,
    xSession: xSessionProxy,
    sqlSession: sqlSessionProxy,
    streamSession: streamSessionProxy,
    // appSession,
    schemas,
    dbSelected: null,
    username: body.username,
    preferences: {},
    queries: logger.queries,
    lastSqlActivity: getCurrentTimestamp(),
  };

  sqlSession.on('error', (err) => {
    console.error('sqlSession----------->', err);
  });

  streamSession.on('error', (err) => {
    console.error('streamSession---------->', err);
  });

  return sessionData;
};

const set = (sessionId: string, session: SessionData) => {
  sessionStore.set(sessionId, session);
};

const get = (sessionId: string | undefined | null) => {
  if (!sessionId) throw appErrors.authMissing();
  const data = sessionStore.get(sessionId);
  if (!data) throw appErrors.authInvalid();
  return data;
};

const remove = async (
  sessionId: string,
  clearSession?: boolean,
): Promise<boolean> => {
  const data = sessionStore.get(sessionId);

  if (data) {
    await Promise.allSettled([data.sqlSession.end(), data.xSession.close()]);
    data.streamSession.end();
    sessionStore.delete(sessionId);
    return true;
  } else if (clearSession) {
    sessionStore.delete(sessionId);
  }
  return false;
};

const activate = async (sessionData: SessionData, dbName?: string) => {
  const db = dbName ?? sessionData.dbSelected;

  if (!db || db === sessionData.dbSelected) {
    return false;
  }

  await sessionData.sqlSession.query(`USE ${escapeId(db)}`);
  await sessionData.xSession.sql(`USE ${escapeId(db)}`).execute();
  sessionData.streamSession.query(`USE ${escapeId(db)}`);
  sessionData.dbSelected = db;
  return true;
};

const resetDb = async (sessionData: SessionData) => {
  await sessionData.sqlSession.query(`USE mysql`);
  await sessionData.xSession.sql(`USE mysql`).execute();
  sessionData.streamSession.query(`USE mysql`);
};
export const dbSession = {
  create,
  set,
  get,
  remove,
  activate,
  resetDb,
};
