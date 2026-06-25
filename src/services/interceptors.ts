import type { Connection as PromiseConnection } from 'mysql2/promise';
import mysqlStream from 'mysql2';
import mysqlx from '@mysql/xdevapi';
import { QueryLogEntry } from '>/types';

const MAX_QUERY_LENGTH = 1024;
type SqlInterceptorProps = {
  sqlSession: PromiseConnection;
  push: (logEntry: QueryLogEntry) => void;
};
export const sqlSessionInterceptor = ({
  sqlSession,
  push,
}: SqlInterceptorProps) => {
  return new Proxy(sqlSession, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (prop === 'query' && typeof value === 'function') {
        return async (...args: any[]) => {
          const [sqlRaw, params] = args;

          if (typeof sqlRaw === 'string') {
            const start = performance.now();
            const startedAt = Date.now();
            const result = await value.apply(target, args);
            const sql =
              sqlRaw.length > MAX_QUERY_LENGTH
                ? `${sqlRaw.slice(0, MAX_QUERY_LENGTH)}...`
                : sqlRaw;

            push({
              sql,
              params,
              connector: 'sql',
              startedAt,
              durationMs: performance.now() - start,
            });

            return result;
          }
          return value.apply(target, args);
        };
      }
      return value;
    },
  });
};

type xSessionInterceptorProps = {
  xSession: mysqlx.Session;
  push: (logEntry: QueryLogEntry) => void;
};
export const xSessionInterceptor = ({
  xSession,
  push,
}: xSessionInterceptorProps) => {
  return new Proxy(xSession, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (prop === 'sql' && typeof value === 'function') {
        return (sqlRaw: string) => {
          const sql =
            sqlRaw.length > MAX_QUERY_LENGTH
              ? `${sqlRaw.slice(0, MAX_QUERY_LENGTH)}...`
              : sqlRaw;

          const statement = value.apply(target, [sqlRaw]);
          const originalExecute = statement.execute.bind(statement);

          statement.execute = async (...executeArgs: any[]) => {
            const startedAt = Date.now();
            const start = performance.now();
            const result = await originalExecute(...executeArgs);

            push({
              sql,
              connector: 'xdevapi',
              startedAt,
              durationMs: performance.now() - start,
            });
            return result;
          };
          return statement;
        };
      }
      return value;
    },
  });
};

type streamInterceptorProps = {
  streamSession: mysqlStream.Connection;
  push: (logEntry: QueryLogEntry) => void;
};

export const streamSessionInterceptor = ({
  streamSession,
  push,
}: streamInterceptorProps) => {
  return new Proxy(streamSession, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (prop === 'query' && typeof value === 'function') {
        return (...args: any[]) => {
          const [sqlRaw, params] = args;

          const startedAt = Date.now();
          const start = performance.now();
          const query = value.apply(target, args);

          if (typeof sqlRaw === 'string') {
            const sql =
              sqlRaw.length > MAX_QUERY_LENGTH
                ? `${sqlRaw.slice(0, MAX_QUERY_LENGTH)}...`
                : sqlRaw;

            query.once('end', () => {
              push({
                sql,
                params,
                connector: 'stream',
                startedAt,
                durationMs: performance.now() - start,
              });
            });

            query.once('error', () => {
              push({
                sql,
                params,
                connector: 'stream',
                startedAt,
                durationMs: performance.now() - start,
              });
            });
          }
          return query;
        };
      }
      return value;
    },
  });
};
