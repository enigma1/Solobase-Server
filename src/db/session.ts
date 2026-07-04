import { v4 as uuidv4 } from 'uuid';
import mysqlStream, {
  Connection as StreamConnection,
  type RowDataPacket,
} from 'mysql2';
import mysql, { Connection as SqlConnection, escapeId } from 'mysql2/promise';
import mysqlx from '@mysql/xdevapi';
import { envConfig } from '>/config';
import {
  WorkerConnection,
  XApiSession,
  LoginRequest,
  SessionData,
} from '>/types';
import {
  getCurrentTimestamp,
  appErrors,
  getMysqlCapabilities,
  sqlSessionInterceptor,
  xSessionInterceptor,
  streamSessionInterceptor,
  createQueryLogger,
} from '>/services';
import { getEnvKey } from './appSession';
import {
  createXConnection,
  createSqlConnection,
  createStreamConnection,
} from './connections';

export const endSessions: SessionData[] = [];
export const sessionStore = new Map<string, SessionData>();

const startRetirementJanitor = () => {
  setInterval(async () => {
    const now = getCurrentTimestamp();

    let i = 0;

    while (i < endSessions.length) {
      const s = endSessions[i];

      if (now - s.dateMarked < envConfig.retiredSessionRemoval) {
        break;
      }

      await dbSession.release(s);
      i++;
    }
    if (i) {
      endSessions.length -= i;
    }
  }, envConfig.pollRetiredSessionInterval);
};

const startIdleJanitor = () => {
  setInterval(async () => {
    const now = getCurrentTimestamp();
    for (const [sessionId, session] of sessionStore.entries()) {
      const idle = now - session.lastSqlActivity;

      if (idle > envConfig.sqlIdleTimeout) {
        await remove(sessionId, true);
      }
    }
  }, envConfig.pollIdleInterval);
};

export const startJanitors = () => {
  startRetirementJanitor();
  startIdleJanitor();
};

// export const sessionJanitor = () => {
//   setInterval(async () => {
//     const now = getCurrentTimestamp();

//     let i = 0;

//     while (i < endSessions.length) {
//       const s = endSessions[i];

//       if (Date.now() - s.dateMarked < now) break;

//       dbSession.release(s);
//       i++;
//     }
//     endSessions.length = endSessions.length - i;

//     for (const [sessionId, session] of sessionStore.entries()) {
//       const idle = now - session.lastSqlActivity;

//       if (idle > envConfig.sqlIdleTimeout) {
//         await remove(sessionId, true);
//       }
//     }
//   }, envConfig.pollingIdleTimer);
// };

const create = async (request: LoginRequest): Promise<SessionData> => {
  const logger = createQueryLogger();

  const xWorker: WorkerConnection<XApiSession> = {
    conn: null,
    create: () => createXConnection({ ...request, push: logger.push }),
  };

  const sqlWorker: WorkerConnection<SqlConnection> = {
    conn: null,
    create: () => createSqlConnection({ ...request, push: logger.push }),
  };

  const streamWorker: WorkerConnection<StreamConnection> = {
    conn: null,
    create: () => createStreamConnection({ ...request, push: logger.push }),
  };

  xWorker.conn = await xWorker.create();
  sqlWorker.conn = await sqlWorker.create();
  streamWorker.conn = streamWorker.create() as StreamConnection;

  // xDevApi connection
  // const xSession = (await mysqlx.getSession({
  //   host: envConfig.dbUser.host,
  //   port: envConfig.dbUser.port,
  //   user: body.username,
  //   password: body.password,
  // })) as XApiSession;
  // const queryResult = await xSession
  //   .sql('SELECT CONNECTION_ID() AS id')
  //   .execute();

  // const row = queryResult.fetchOne() as any;
  // xSession.threadId = typeof row === 'object' ? row.id : row[0];

  // Classic MySQL connection use classic protocol
  // const sqlSession = await mysql.createConnection({
  //   host: envConfig.dbSqlUser.host,
  //   port: envConfig.dbSqlUser.port,
  //   user: body.username,
  //   password: body.password,
  //   database: undefined,
  //   dateStrings: true,
  //   multipleStatements: true,
  // });

  // // Classic MySQL connection use classic protocol
  // const ctrlSession = await mysql.createConnection({
  //   host: envConfig.dbSqlUser.host,
  //   port: envConfig.dbSqlUser.port,
  //   user: body.username,
  //   password: body.password,
  // });

  // const sqlPool = mysql.createPool({
  //   host: getEnvKey('DB_HOST') ?? '127.0.0.1',
  //   port: Number(getEnvKey('DB_PORT') ?? 3306),
  //   user: getEnvKey('DB_USER') ?? 'root',
  //   password: getEnvKey('DB_PASSWORD'),
  //   database: undefined,
  //   dateStrings: true,
  //   multipleStatements: true,
  // });

  // For streamed connection use a separate one
  // const streamSession = mysqlStream.createConnection({
  //   host: envConfig.dbSqlUser.host,
  //   port: envConfig.dbSqlUser.port,
  //   user: body.username,
  //   password: body.password,
  //   database: undefined,
  //   dateStrings: true,
  //   multipleStatements: true,
  // });

  // const xSessionProxy = xSessionInterceptor({ xSession, push: logger.push });
  // const sqlSessionProxy = sqlSessionInterceptor({
  //   sqlSession,
  //   push: logger.push,
  // });
  // const streamSessionProxy = streamSessionInterceptor({
  //   streamSession,
  //   push: logger.push,
  // });

  // getSchemas on xDevApi connector is async!!
  const schemas = await xWorker.conn.getSchemas();
  const caps = await getMysqlCapabilities(sqlWorker.conn);

  const sessionId = uuidv4(); // generate unique session ID
  const sessionData = {
    ...caps,
    sessionId,
    xSession: xWorker.conn,
    sqlSession: sqlWorker.conn,
    streamSession: streamWorker.conn,
    xWorker,
    sqlWorker,
    streamWorker,
    // xSession,
    // sqlSession,
    // streamSession
    // ctrlSession,
    // appSession,
    schemas,
    dbSelected: null,
    username: request.username,
    preferences: {},
    queries: logger.queries,
    lastSqlActivity: getCurrentTimestamp(),
    dateMarked: getCurrentTimestamp(),
  };

  sessionData.sqlSession.on('error', (err) => {
    console.error('sqlSession----------->', err);
  });

  sessionData.streamSession.on('error', (err) => {
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
    await Promise.allSettled([
      data.sqlSession.end(),
      data.xSession.close(),
      // data.ctrlSession.end(),
    ]);
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
  void sessionData.streamSession.query(`USE ${escapeId(db)}`);
  sessionData.dbSelected = db;
  return true;
};

const resetDb = async (sessionData: SessionData) => {
  await sessionData.sqlSession.query(`USE mysql`);
  await sessionData.xSession.sql(`USE mysql`).execute();
  sessionData.streamSession.query(`USE mysql`);
};

const refresh = async (sessionData: SessionData) => {
  endSessions.push({
    ...sessionData,
    dateMarked: Date.now(),
    sqlSession: sessionData.sqlSession,
    streamSession: sessionData.streamSession,
    xSession: sessionData.xSession,
  });
  sessionData.sqlSession = await sessionData.sqlWorker.create();
  sessionData.xSession = await sessionData.xWorker.create();
  sessionData.streamSession =
    sessionData.streamWorker.create() as StreamConnection;
};

const release = async (sessionData: SessionData) => {
  await Promise.allSettled([
    sessionData.sqlSession.end(),
    sessionData.xSession.close(),
  ]);
  sessionData.streamSession.end();
};

export const dbSession = {
  create,
  set,
  get,
  remove,
  release,
  refresh,
  activate,
  resetDb,
};
