import { RowDataPacket, escape, escapeId } from 'mysql2';
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
  indexBy,
} from '>/services';
import { appClient, dbSession } from '>/db';
import { envConfig, limitsConfig } from '>/config';
import {
  MysqlUtilityProps,
  ApiResponse,
  SessionData,
  SqlColumns,
  SqlColumnQuery,
  UserCapabilities,
} from '>/types';
import { getCurrentTimestamp } from '>/services';

export const dbNameAllowedChars = /^[a-zA-Z0-9_-]{1,64}$/;
export const sortByAllowedChars = /^[a-zA-Z_][a-zA-Z0-9_]*\s+(ASC|DESC)$/i;

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

export const getColumns = async ({
  sessionData,
  table,
  database,
}: MysqlUtilityProps): Promise<SqlColumnType[]> => {
  const colsArray = await sessionData.xSession
    .sql(`SHOW COLUMNS FROM ${escapeId(database)}.${escapeId(table)}`)
    .execute();

  const columns = colsArray.fetchAll() as SqlColumnType[];
  return columns;
};

export const getRealColumns = async ({
  sessionData,
  table,
  database,
}: MysqlUtilityProps): Promise<SqlColumns[]> => {
  const [cols] = await sessionData.sqlSession.query<SqlColumnQuery[]>(
    `SHOW COLUMNS FROM ${escapeId(database)}.${escapeId(table)}`,
  );

  return cols
    .filter((col) => !col.Extra?.toUpperCase().includes('GENERATED'))
    .map((col) => ({
      field: col.Field,
      type: col.Type,
      nullable: col.Null,
      key: col.Key,
      defaultValue: col.Default,
      extra: col.Extra,
    }));
};

export const getColumnsOrdered = async (props: MysqlUtilityProps) => {
  const columns = await getRealColumns(props);
  const cols = indexBy(columns, 'field');
  return {
    cols,
    columnsOrder: columns.map((c) => c.field),
  };
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
    table: tableName,
    database: selectedDatabase,
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

const defaultCapabilities: UserCapabilities = {
  canGrantPrivileges: true,
  canViewUsers: true,
  canManageUsers: true,
  canCreateDatabases: true,
  canManageTables: true,
  canEditData: true,
};

const getGrants = async (sessionData: SessionData) => {
  const [rows] = await sessionData.sqlSession.query<(RowDataPacket & string)[]>(
    'SHOW GRANTS FOR CURRENT_USER()',
  );
  return rows.map((row) => Object.values(row)[0] as string);
};

export const getCapabilities = async (
  sessionData: SessionData,
): Promise<UserCapabilities> => {
  const grants = await getGrants(sessionData);
  const joined = grants.join(' ');

  return {
    ...defaultCapabilities,
    canViewUsers:
      !joined.includes('ALL PRIVILEGES') &&
      !joined.includes('SELECT ON `mysql`.*'),

    canGrantPrivileges:
      !joined.includes('WITH GRANT OPTION') &&
      !joined.includes('ALL PRIVILEGES'),

    canManageUsers:
      !joined.includes('CREATE USER') &&
      !joined.includes('SYSTEM_USER') &&
      !joined.includes('ALL PRIVILEGES'),
  };
};
