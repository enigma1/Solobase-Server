import { createConnection as streamConnnection } from 'mysql2';
import { createConnection as sqlConnection } from 'mysql2/promise';
import { createPool as sqlPool } from 'mysql2/promise';
import { getSession } from '@mysql/xdevapi';
import { getEnvKey } from './appSession';
import { XApiSession, PrimeObject, QueryLogEntry, SessionData } from '>/types';
import {
  sqlSessionInterceptor,
  xSessionInterceptor,
  streamSessionInterceptor,
} from '>/services';

type CreateConnectionProps = {
  push: (entry: QueryLogEntry) => void;
  username: string;
  password: string;
};
const getCommonSqlConnectionParams = (username: string, password: string) =>
  ({
    host: getEnvKey('DB_HOST') ?? '127.0.0.1',
    port: Number(getEnvKey('DB_PORT') ?? 3306),
    user: username,
    password: password,
  }) as const;

export const createXConnection = async ({
  push,
  username,
  password,
}: CreateConnectionProps) => {
  const xConnection = (await getSession({
    host: getEnvKey('DB_XHOST') ?? '127.0.0.1',
    port: Number(getEnvKey('DB_XPORT') ?? 33060),
    user: username,
    password: password,
  })) as XApiSession;
  const queryResult = await xConnection
    .sql('SELECT CONNECTION_ID() AS id')
    .execute();
  const row = queryResult.fetchOne() as PrimeObject;
  xConnection.threadId = typeof row === 'object' ? row.id : row[0];
  const xSessionProxy = xSessionInterceptor({ xSession: xConnection, push });
  return xSessionProxy;
};

export const createSqlConnection = async ({
  push,
  username,
  password,
}: CreateConnectionProps) => {
  const sqlSession = await sqlConnection({
    ...getCommonSqlConnectionParams(username, password),
    database: undefined,
    dateStrings: true,
    multipleStatements: true,
  });
  const sqlSessionProxy = sqlSessionInterceptor({
    sqlSession,
    push,
  });
  return sqlSessionProxy;
};

export const createSqlPoolConnection = ({
  push,
  username,
  password,
}: CreateConnectionProps) => {
  const sqlSession = sqlPool({
    ...getCommonSqlConnectionParams(username, password),
    database: undefined,
    dateStrings: true,
    multipleStatements: true,
  });
  const sqlSessionProxy = sqlSessionInterceptor({
    sqlSession,
    push,
  });
  return sqlSessionProxy;
};

export const createStreamConnection = ({
  push,
  username,
  password,
}: CreateConnectionProps) => {
  const streamSession = streamConnnection({
    ...getCommonSqlConnectionParams(username, password),
    database: undefined,
    dateStrings: true,
    multipleStatements: true,
  });
  const sqlSessionProxy = streamSessionInterceptor({
    streamSession,
    push,
  });
  return sqlSessionProxy;
};

export const ctrlSession = await sqlConnection({
  host: getEnvKey('DB_HOST') ?? '127.0.0.1',
  port: Number(getEnvKey('DB_PORT') ?? 3306),
  user: getEnvKey('DB_USER') ?? 'root',
  password: getEnvKey('DB_PASSWORD'),
});
