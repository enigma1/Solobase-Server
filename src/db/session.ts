import { v4 as uuidv4 } from 'uuid';
import { Connection as StreamConnection } from 'mysql2';
import { Connection as SqlConnection, escapeId } from 'mysql2/promise';
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
  getRealColumns,
  createQueryLogger,
} from '>/services';
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

  const caps = await getMysqlCapabilities(sqlWorker.conn);

  const sessionId = uuidv4(); // generate unique session ID
  const sessionData: SessionData = {
    ...caps,
    sessionId,
    xSession: xWorker.conn,
    sqlSession: sqlWorker.conn,
    streamSession: streamWorker.conn,
    xWorker,
    sqlWorker,
    streamWorker,
    // ctrlSession,
    // appSession,
    schemaColumns: [],
    // schemas,
    dbSelected: null,
    username: request.username,
    preferences: {},
    queries: logger.queries,
    lastSqlActivity: getCurrentTimestamp(),
    dateMarked: getCurrentTimestamp(),
  };

  const columns = await getRealColumns({
    sessionData,
    database: 'information_schema',
    table: 'SCHEMATA',
  });

  sessionData.schemaColumns = columns;

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

type SessionActivateProps = {
  sessionData: SessionData;
  database?: string;
  refresh?: boolean;
};
const activate = async ({
  sessionData,
  database,
  refresh,
}: SessionActivateProps) => {
  const db = database ?? sessionData.dbSelected;

  if (!db) {
    return false;
  }

  if (!refresh && db === sessionData.dbSelected) return false;

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
  sessionData.sqlWorker.conn = await sessionData.sqlWorker.create();
  sessionData.xWorker.conn = await sessionData.xWorker.create();
  sessionData.streamWorker.conn =
    sessionData.streamWorker.create() as StreamConnection;

  sessionData.sqlSession = sessionData.sqlWorker.conn;
  sessionData.xSession = sessionData.xWorker.conn;
  sessionData.streamSession = sessionData.streamWorker.conn;
  activate({ sessionData, refresh: true });
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
