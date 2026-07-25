import { createHash } from 'node:crypto';
import { RowDataPacket, escape, escapeId } from 'mysql2';
import mysqlx from '@mysql/xdevapi';
import { FastifyRequest, FastifyReply } from 'fastify';
import {
  isObjectWithStringProperty,
  hasObjectProps,
  errorResolver,
  indexBy,
} from '>/services';
import { appClient, dbSession } from '>/db';
import {
  XApiSession,
  MysqlUtilityProps,
  ApiResponse,
  SessionData,
  SqlColumns,
  SqlColumnQuery,
  UserCapabilities,
  SqlColumnsShape,
  SqlRow,
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

type SqlIndexQuery = RowDataPacket & {
  INDEX_NAME: string;
  NON_UNIQUE: number;
  COLUMN_NAME: string;
};

export const getRealColumns = async ({
  sessionData,
  table,
  database,
}: MysqlUtilityProps): Promise<SqlColumns[]> => {
  const columnsSql = `
    SELECT
      COLUMN_NAME,
      DATA_TYPE,
      COLUMN_TYPE,
      IS_NULLABLE,
      COLUMN_DEFAULT,
      EXTRA
    FROM information_schema.columns
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = ?
    ORDER BY ORDINAL_POSITION
  `;

  const indexesSql = `
    SELECT
      INDEX_NAME,
      NON_UNIQUE,
      COLUMN_NAME
    FROM information_schema.statistics
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = ?
  `;

  const [[columns], [indexes]] = await Promise.all([
    sessionData.sqlSession.query<SqlColumnQuery[]>(columnsSql, [
      database,
      table,
    ]),
    sessionData.sqlSession.query<SqlIndexQuery[]>(indexesSql, [
      database,
      table,
    ]),
  ]);

  const keyMap = new Map<string, SqlColumns['key']>();

  for (const index of indexes) {
    const current = keyMap.get(index.COLUMN_NAME);

    if (index.INDEX_NAME === 'PRIMARY') {
      keyMap.set(index.COLUMN_NAME, 'PRI');
      continue;
    }

    if (index.NON_UNIQUE === 0 && current !== 'PRI') {
      keyMap.set(index.COLUMN_NAME, 'UNI');
      continue;
    }

    if (!current) {
      keyMap.set(index.COLUMN_NAME, 'MUL');
    }
  }

  return columns
    .filter((col) => !col.EXTRA?.toUpperCase().includes('GENERATED'))
    .map((col) => ({
      field: col.COLUMN_NAME,
      type: col.COLUMN_TYPE,
      nullable: col.IS_NULLABLE,
      key: keyMap.get(col.COLUMN_NAME) ?? '',
      defaultValue: col.COLUMN_DEFAULT,
      extra: col.EXTRA,
    }));
};

// export const getRealColumns = async ({
//   sessionData,
//   table,
//   database,
// }: MysqlUtilityProps): Promise<SqlColumns[]> => {
//   const [cols] = await sessionData.sqlSession.query<SqlColumnQuery[]>(
//     `SHOW COLUMNS FROM ${escapeId(database)}.${escapeId(table)}`,
//   );

//   return cols
//     .filter((col) => !col.Extra?.toUpperCase().includes('GENERATED'))
//     .map((col) => ({
//       field: col.Field,
//       type: col.Type,
//       nullable: col.Null,
//       key: col.Key,
//       defaultValue: col.Default,
//       extra: col.Extra,
//     }));
// };

const getUniqueKeys = (cols: SqlColumns[]) => {
  const primary = cols
    .filter((col) => col.key === 'PRI')
    .map((col) => col.field);

  if (primary.length > 0) {
    return primary;
  }

  return cols
    .filter((col) => col.key === 'UNI' && col.nullable === 'NO')
    .map((col) => col.field);
};

export const getAllKeys = (cols: SqlColumns[]) => {
  return cols.filter((col) => col.key !== '').map((col) => col.field);
};

export const getColumnsOrdered = async (props: MysqlUtilityProps) => {
  const columns = await getRealColumns(props);
  const uniqueKeys = getUniqueKeys(columns);
  const allKeys = getAllKeys(columns);
  const columnsOrder = columns.map((c) => c.field);
  const cols = indexBy(columns, 'field');

  return {
    cols,
    columnsOrder,
    uniqueKeys,
    allKeys,
  };
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

export const getDatabaseSchemaDetails = async (
  sessionData: SessionData,
  dbName: string,
) => {
  const escapedName = escapeId(dbName);
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

// const defaultCapabilities: UserCapabilities = {
//   canGrantPrivileges: true,
//   canViewUsers: true,
//   canManageUsers: true,
//   canCreateDatabases: true,
//   canManageTables: true,
//   canEditData: true,
// };

// const getGrants = async (sessionData: SessionData) => {
//   const [rows] = await sessionData.sqlSession.query<(RowDataPacket & string)[]>(
//     'SHOW GRANTS FOR CURRENT_USER()',
//   );
//   return rows.map((row) => Object.values(row)[0] as string);
// };

// export const getCapabilities = async (
//   sessionData: SessionData,
// ): Promise<UserCapabilities> => {
//   const grants = await getGrants(sessionData);
//   const joined = grants.join(' ');

//   return {
//     ...defaultCapabilities,
//     canViewUsers:
//       !joined.includes('ALL PRIVILEGES') &&
//       !joined.includes('SELECT ON `mysql`.*'),

//     canGrantPrivileges:
//       !joined.includes('WITH GRANT OPTION') &&
//       !joined.includes('ALL PRIVILEGES'),

//     canManageUsers:
//       !joined.includes('CREATE USER') &&
//       !joined.includes('SYSTEM_USER') &&
//       !joined.includes('ALL PRIVILEGES'),
//   };
// };

export const getCapabilities = async (
  sessionData: SessionData,
): Promise<string[]> => {
  const [rows] = await sessionData.sqlSession.query<(RowDataPacket & string)[]>(
    'SHOW GRANTS FOR CURRENT_USER()',
  );

  return rows.map((r) => Object.values(r)[0] as string).filter(Boolean);
};

export const hasIdentity = (cols: SqlColumnsShape) =>
  getUniqueKeys(Object.values(cols)).length > 0;

export const fingerprint = (row: SqlRow): string => {
  return createHash('sha1').update(JSON.stringify(row)).digest('hex');
};
