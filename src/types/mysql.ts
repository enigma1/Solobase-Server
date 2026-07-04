import type { RowDataPacket, Connection as StreamConnection } from 'mysql2';
import type { Connection as SqlConnection } from 'mysql2/promise';
import type {
  Session as XSession,
  Schema,
  Scalar,
  SortExprStrList,
} from '@mysql/xdevapi';
import type { PrimeObject, QueryLogEntry } from '>/types/frontEnd';
import { WorkerConnection } from './connections';
export type XApiSession = XSession & { threadId: number };

export type MySqlCaps = {
  collationsByCharset: Record<string, CharsetMeta>;
  engines: StorageEngineMeta[];
  defaults: {
    charset: string;
    collation: string;
    engine: string;
  };
};

export type SessionData = MySqlCaps & {
  sessionId: string; // the generated UUID
  xSession: XApiSession; // the xDevApi MySQL session
  sqlSession: SqlConnection; // the classic MySQL session
  streamSession: StreamConnection; // the stream MySql session
  xWorker: WorkerConnection<XApiSession>;
  sqlWorker: WorkerConnection<SqlConnection>;
  streamWorker: WorkerConnection<StreamConnection>;

  // appSession: XApiSession; // the app MySQL session
  schemas: Schema[]; // schemas available to this session
  dbSelected: string | null; // initially null
  // tableSelected: string | null;
  username: string;
  preferences: PrimeObject;
  queries: QueryLogEntry[];
  lastSqlActivity: number;
  dateMarked: number;
};

export type EngineRow = RowDataPacket & {
  Engine: string;
  Support: 'YES' | 'NO' | 'DEFAULT';
  Comment: string;
  Transactions: 'YES' | 'NO';
  XA: 'YES' | 'NO';
  Savepoints: 'YES' | 'NO';
};

export type CharsetRow = RowDataPacket & {
  Charset: string;
  Description: string;
  Default_collation: string;
  Maxlen: number;
};

export type CollationRow = RowDataPacket & {
  Collation: string;
  Charset: string;
  Default: string;
  Compiled: string;
  Sortlen: number;
};

export type SqlColumnQuery = RowDataPacket & {
  Field: string;
  Type: string;
  Null: 'YES' | 'NO';
  Key: 'PRI' | 'UNI' | 'MUL' | '';
  Default: string | null;
  Extra: string;
};

export type CharsetMeta = {
  maxlen: number;
  defaultCollation: string;
  collations: string[];
};

export type StorageEngineMeta = {
  name: string;
  isDefault: boolean;
  transactions: boolean;
  xa: boolean;
  savepoints: boolean;
};

export type SqlRow = Scalar[];
export type SqlColumns = {
  field: string;
  type: string;
  nullable: 'YES' | 'NO';
  key: 'PRI' | 'UNI' | 'MUL' | '';
  defaultValue: string | null;
  extra: string;
};

export type MysqlUtilityProps = {
  database: string;
  table: string;
  sessionData: SessionData;
};

export type MysqlPrivileges = {
  canViewUsers: boolean;
  canManageUsers: boolean;

  canCreateDatabases: boolean;
  canDropDatabases: boolean;

  canCreateTables: boolean;
  canAlterTables: boolean;
  canDropTables: boolean;

  canEditData: boolean;
};
