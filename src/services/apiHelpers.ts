import { RowDataPacket } from 'mysql2';
import mysqlx from '@mysql/xdevapi';
import mysql from 'mysql2';
import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodError, treeifyError } from 'zod';
import { CookieSerializeOptions } from '@fastify/cookie';
import {
  isObjectWithStringProperty,
  hasObjectProps,
  getSqlString,
  errorResolver,
} from '>/services';
import { appClient, dbSession } from '>/db';
import { envConfig, limitsConfig } from '>/config';
import { ApiResponse, SessionData, SqlColumns } from '>/types';
import { getCurrentTimestamp } from '>/services';

export const dbNameAllowedChars = /^[a-zA-Z0-9_-]{1,64}$/;
export const sortByAllowedChars = /^[a-zA-Z_][a-zA-Z0-9_]*\s+(ASC|DESC)$/i;

export const processOrThrowSession = (req: FastifyRequest): SessionData => {
  const sessionId = req.cookies?.sessionId;

  if (!sessionId) {
    const error = Object.assign(new Error('Login required'), {
      type: 'auth',
      status: 'SESSION_MISSING',
      code: 401,
    });
    throw error;
    // throw req.server.httpErrors.unauthorized('Login required');
  }
  return dbSession.get(sessionId);
};

export const getSessionFromRequest = (
  req: FastifyRequest,
): SessionData | undefined => {
  const sessionId = req.cookies?.sessionId;
  if (!sessionId) {
    return undefined;
  }
  try {
    return dbSession.get(sessionId);
  } catch (e) {
    console.warn('Invalid sessionId in cookie:', sessionId);
    return undefined;
  }
};

const handleApiFn = async <T>(
  fn: () => Promise<T>,
  { req, rsp }: { req: FastifyRequest; rsp: FastifyReply },
): Promise<T> => {
  try {
    return await fn();
  } catch (e: unknown) {
    const error = errorResolver(e);
    // const error = e as AppError;

    console.log('Error --------------------------->', error);
    switch (error?.type) {
      case 'auth': {
        const sessionId = req?.cookies?.sessionId;

        if (sessionId) {
          dbSession.remove(sessionId);
        }

        rsp.setCookie('sessionId', '', getCookieOptions(0));

        return rsp.status(401).send({
          error:
            error.kind === 'missing' ? 'Login required' : 'Invalid session',
          code: 401,
          message:
            error.kind === 'missing'
              ? 'You must first login'
              : 'Your session has expired',
        });
      }
      case 'domain':
        return rsp.status(422).send({
          error: 'Request Failed',
          code: 422,
          message: error.message,
        });

      case 'validation':
        return rsp.status(400).send({
          error: 'Invalid request',
          code: 400,
          message: treeifyError(error.error),
        });

      case 'mysql':
        return rsp.status(400).send({
          error: error.error.info.msg,
          code: error.error.info.code,
          message: error.error.info.sqlState,
        });

      case 'server':
        return rsp.status(error.code).send({
          error: error.message,
          code: error.code,
          message: 'Details are not available',
        });

      default:
        return rsp.status(500).send({
          error: 'Unknown Server Error',
          code: 500,
          message: 'An unexpected error occurred',
        });
    }
  }
};

type ApiCallCommonProps = {
  req: FastifyRequest;
  rsp: FastifyReply;
};

type ApiCallAuthProps<T> = ApiCallCommonProps & {
  fn: (sessionData: SessionData) => Promise<ApiResponse<T> | T>;
};
// Use with routes the return JSON for logged-in users
export const apiCallAuth = async <T>({ req, rsp, fn }: ApiCallAuthProps<T>) =>
  handleApiFn(
    async () => {
      const sessionData = processOrThrowSession(req);
      sessionData.lastSqlActivity = getCurrentTimestamp();
      rsp.setCookie(
        'sessionId',
        sessionData.sessionId,
        getCookieOptions(envConfig.cookieTimeout),
      );

      const res = await fn(sessionData);
      if (!hasObjectProps(res, ['data'])) return res;

      // const sessionId = res.effects?.sessionId;
      // if (sessionId !== undefined) {
      //   rsp.setCookie(
      //     'sessionId',
      //     sessionId,
      //     getCookieOptions(envConfig.cookieTimeout),
      //   );
      // }

      // future-proof: headers
      if (res.effects?.headers) {
        for (const [key, value] of Object.entries(res.effects.headers)) {
          rsp.header(key, value);
        }
      }
      // optional status override
      if (res.effects?.status) {
        rsp.status(res.effects.status);
      }
      return res.data;
    },
    { req, rsp },
  );

type ApiCallUnknownProps<T> = ApiCallCommonProps & {
  fn: () => Promise<ApiResponse<T>>;
};

export const apiCallUnknown = async <T>({
  req,
  rsp,
  fn,
}: ApiCallUnknownProps<T>) =>
  handleApiFn(
    async () => {
      const res = await fn();
      if (hasObjectProps(res, ['effects', ['sessionId']])) {
        const sessionId = res.effects?.sessionId;
        if (typeof sessionId === 'string' && sessionId.length > 20) {
          rsp.setCookie(
            'sessionId',
            sessionId,
            getCookieOptions(envConfig.cookieTimeout),
          );
        } else {
          rsp.clearCookie('sessionId');
        }
      }
      if (hasObjectProps(res, ['effects', ['headers']])) {
        const headers = res.effects?.headers as Record<string, string>;
        for (const [key, value] of Object.entries(headers)) {
          rsp.header(key, value);
        }
      }
      // optional status override
      if (hasObjectProps(res, ['effects', ['status']])) {
        const status = res.effects?.status as number;
        rsp.status(status);
      }

      if (hasObjectProps(res, ['data'])) {
        return res.data;
      } else {
        return {
          ok: false,
          message: 'request failed',
        };
      }
    },
    { req, rsp },
  );

type StreamResponse = {
  effects?: {
    headers?: Record<string, string>;
    status?: number;
  };
};

type ApiCallStreamProps = ApiCallCommonProps & {
  fn: (sessionData: SessionData) => Promise<StreamResponse | void>;
};
// Use with routes the return JSON for logged-in users
export const apiCallStream = async <T>({ req, rsp, fn }: ApiCallStreamProps) =>
  handleApiFn(
    async () => {
      const sessionData = processOrThrowSession(req);
      sessionData.lastSqlActivity = getCurrentTimestamp();
      rsp.setCookie(
        'sessionId',
        sessionData.sessionId,
        getCookieOptions(envConfig.cookieTimeout),
      );

      const res = await fn(sessionData);
      const headers = res?.effects?.headers;
      if (headers !== undefined) {
        for (const [key, value] of Object.entries(headers)) {
          rsp.header(key, value);
        }
      }
      const status = res?.effects?.status;
      if (status !== undefined) {
        rsp.status(status);
      }
    },
    { req, rsp },
  );

type ApiCallOptions = {
  allowAnonymous?: boolean;
  setCookie?: (reply: FastifyReply, sessionId: string) => void;
};

type ApiResult<T> = T & {
  sessionId?: string;
};

type ApiCallArgs<T> = {
  req: FastifyRequest;
  rsp: FastifyReply;
  // fn: (sessionData: SessionData | undefined) => Promise<T>;
  fn: (sessionData: SessionData | undefined) => Promise<ApiResult<T>>;
  options?: ApiCallOptions;
};

export const apiCall = async <T>({
  req,
  rsp,
  fn,
  options = {},
}: ApiCallArgs<T>): Promise<T> =>
  handleApiFn(
    async () => {
      const { allowAnonymous = false, setCookie } = options;
      // Extract sessionId from cookie
      let sessionData: SessionData | undefined;
      // let sessionId = req?.cookies?.sessionId;
      if (!allowAnonymous) {
        // sessionData = dbSession.get(sessionId); // throws if invalid
        sessionData = processOrThrowSession(req);
      }

      // Keep sqlSession alive
      if (sessionData) {
        sessionData.lastSqlActivity = getCurrentTimestamp();
      }

      const fnResult = await fn(sessionData);

      // Assign sessionId if not already set and result has a string sessionId
      const hasSessionId = isObjectWithStringProperty(fnResult, 'sessionId');
      const canSendCookie = setCookie;
      if (!hasSessionId) {
        // clear the cookie
        if (canSendCookie) {
          rsp.setCookie('sessionId', '', getCookieOptions(0));
        }
        return fnResult;
      } else if (canSendCookie) {
        rsp.setCookie(
          'sessionId',
          fnResult.sessionId,
          getCookieOptions(envConfig.cookieTimeout),
        );
        setCookie(rsp, fnResult.sessionId);
      }
      const { sessionId: removed, ...result } = fnResult;
      return result as T;
    },
    { req, rsp },
  );

export const getCookieOptions = (maxAge: number): CookieSerializeOptions => ({
  httpOnly: true,
  path: '/',
  maxAge: maxAge / 1000,
  sameSite: 'none',
  secure: true,
  domain: envConfig.front.client,
});

type SqlColumnType = [
  field: string,
  type: string,
  nullable: 'YES' | 'NO',
  key: 'PRI' | 'UNI' | 'MUL' | '',
  defaultValue: string | null,
  extra: string,
];

type ColumnInput =
  | SqlColumnType
  | {
      getColumnLabel?: () => string;
      getColumnName?: () => string;
      getColumnType?: () => string;
      isNullable?: () => boolean;
      isPrimaryKey?: () => boolean;
      getDefault?: () => any;
      getExtra?: () => string;
    };

export const normalizeColumn = (col: ColumnInput): SqlColumns => {
  // if tuple from SHOW COLUMNS
  if (Array.isArray(col)) {
    return {
      field: col[0] ?? 'unknown',
      type: col[1] ?? 'UNKNOWN',
      nullable: col[2] ?? 'NO',
      key: col[3] ?? '',
      defaultValue: col[4] ?? null,
      extra: col[5] ?? '',
    };
  } else {
    // MySQL meta object
    return {
      field: col.getColumnLabel?.() || col.getColumnName?.() || 'unknown',
      type: col.getColumnType?.() || 'UNKNOWN',
      nullable: col.isNullable?.() ? 'YES' : 'NO',
      key: col.isPrimaryKey?.() ? 'PRI' : '',
      defaultValue: col.getDefault?.() ?? null,
      extra: col.getExtra?.() || '',
    };
  }
};

type GetColumnsProps = {
  sessionData: SessionData;
  tableName: string;
  dbName: string;
};

export const getColumns = async ({
  sessionData,
  tableName,
  dbName,
}: GetColumnsProps): Promise<SqlColumnType[]> => {
  const colsArray = await sessionData.xSession
    .sql(
      `
      SHOW COLUMNS FROM
      ${getSqlString(dbName)}.${getSqlString(tableName)}
    `,
    )
    .execute();

  const columns = colsArray.fetchAll() as SqlColumnType[];
  return columns;
};

type GetRealColumnsProps = {
  sessionData: SessionData;
  tableName: string;
  dbName: string;
};
export const getRealColumns = async ({
  sessionData,
  tableName,
  dbName,
}: GetRealColumnsProps): Promise<SqlColumnType[]> => {
  const columns = await getColumns({ sessionData, tableName, dbName });

  // filter out virtual columns
  return columns.filter((col) => {
    const extra = col[5].toUpperCase();
    return !extra.includes('GENERATED');
  });
};

/*
      const colsData = await sessionData!.session
        .sql(
          `
  SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = ?
  AND TABLE_NAME = ?
  ORDER BY ORDINAL_POSITION
`,
        )
        .bind(sessionData!.dbSelected, table)
        .execute();
        */

export const getTableInfo = async (
  session: SessionData,
  tableName: string,
  dbName?: string,
): Promise<{
  tableType: 'table' | 'collection';
  cols: SqlColumns[];
} | null> => {
  const selectedDatabase = dbName ?? session.dbSelected;

  if (!selectedDatabase) return null;

  const rawCols = await getColumns({
    sessionData: session,
    tableName,
    dbName: selectedDatabase,
  });

  if (!rawCols || rawCols.length === 0) {
    return null;
  }

  const cols = rawCols.map(normalizeColumn);
  const isCollection =
    cols.filter((c) => c.field === 'doc' || c.field === '_id').length === 2;

  return {
    tableType: isCollection ? 'collection' : 'table',
    cols,
  };
};

export const formatQuery = (query: string): string => {
  let formattedQuery = query.trim();
  if (/^\s*select/i.test(query) && !/limit\s+\d+/i.test(query)) {
    formattedQuery += ` LIMIT ${limitsConfig.maxRowsFetch}`;
  }
  return formattedQuery;
};

export const withAppSession = async <T>(
  fn: (session: mysqlx.Session) => Promise<T>,
) => {
  const session = await appClient.getSession();
  try {
    return await fn(session);
  } finally {
    await session.close();
  }
};

// type CharsetCheckResult = {
//   session: SessionData;
//   charset: string;
// };
// export const charsetExists = async ({
//   session,
//   charset,
// }: CharsetCheckResult): Promise<boolean> => {
//   const [rows] = await session.sqlSession.query<RowDataPacket[]>(
//     `
//       SELECT 1
//       FROM information_schema.CHARACTER_SETS
//       WHERE CHARACTER_SET_NAME = ?
//     `,
//     [charset],
//   );
//   return !!rows.length;
// };

// type CollationCheckResult = {
//   session: SessionData;
//   collation: string;
//   charset: string;
// };
// export const collationExists = async ({
//   session,
//   collation,
//   charset,
// }: CollationCheckResult): Promise<boolean> => {
//   const [rows] = await session.sqlSession.query<RowDataPacket[]>(
//     `
//       SELECT 1
//       FROM information_schema.COLLATIONS
//       WHERE COLLATION_NAME = ?
//       AND CHARACTER_SET_NAME = ?
//     `,
//     [collation, charset],
//   );
//   return rows.length > 0;
// };

// export const getEngines = async (sessionData: SessionData) => {
//   const [engines] =
//     await sessionData.sqlSession.query<RowDataPacket[]>(`SHOW ENGINES`);
//   return engines;
// };

// type EngineExistsProps = {
//   session: SessionData;
//   engine: string;
// };
// export const engineExists = async ({ session, engine }: EngineExistsProps) => {
//   const engines = session.engines;
//   const normalizeEngine = (e: string) => e.toLowerCase();
//   return engines.some(
//     (e) => normalizeEngine(e.name) === normalizeEngine(engine),
//   );
// };

export const getDatabaseSchemaDetails = async (
  sessionData: SessionData,
  dbName: string,
) => {
  const escapedName = getSqlString(dbName);
  const [schemaRows] = await sessionData.sqlSession.query<RowDataPacket[]>(
    `
    SELECT
      DEFAULT_CHARACTER_SET_NAME,
      DEFAULT_COLLATION_NAME
    FROM information_schema.SCHEMATA
    WHERE SCHEMA_NAME = ?
    `,
    [dbName],
  );

  const schema = schemaRows[0];
  return {
    charset: schema.DEFAULT_CHARACTER_SET_NAME,
    collation: schema.DEFAULT_COLLATION_NAME,
    escapedName,
  };
};

export const getDatabaseServerDefaults = async (sessionData: SessionData) => {
  const [defaults] = await sessionData.sqlSession.query<RowDataPacket[]>(
    `SELECT
      @@character_set_server AS charset,
      @@collation_server AS collation,
      @@default_storage_engine AS engine
    `,
  );
  return {
    charset: defaults[0].charset,
    collation: defaults[0].collation,
    engine: defaults[0].engine,
  };
};
