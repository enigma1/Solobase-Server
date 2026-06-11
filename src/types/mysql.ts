import type { Connection as StreamConnection } from 'mysql2';
import type { Connection as PromiseConnection } from 'mysql2/promise';
import type {
  Session as XSession,
  Schema,
  Scalar,
  SortExprStrList,
} from '@mysql/xdevapi';
import type { PrimeObject } from '>/types/frontEnd';

export type SessionData = MySqlCaps & {
  sessionId: string; // the generated UUID
  xSession: XSession; // the xDevApi MySQL session
  sqlSession: PromiseConnection; // the classic MySQL session
  sqlStreamSession: StreamConnection; // the stream MySql session
  // appSession: mysqlx.Session; // the app MySQL session
  schemas: Schema[]; // schemas available to this session
  dbSelected: string | null; // initially null
  // tableSelected: string | null;
  username: string;
  preferences: PrimeObject;
  lastSqlActivity: number;
};

// export type EngineRow = {
//   Engine: string;
//   Support: 'YES' | 'NO' | 'DEFAULT';
//   Comment: string;
//   Transactions: 'YES' | 'NO';
//   XA: 'YES' | 'NO';
//   Savepoints: 'YES' | 'NO';
// };

// export type CharsetRow = {
//   Charset: string;
//   Description: string;
//   Default_collation: string;
//   Maxlen: number;
// };

// export type CollationRow = {
//   Collation: string;
//   Charset: string;
//   Default: string;
//   Compiled: string;
//   Sortlen: number;
// };

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

export type MySqlCaps = {
  collationsByCharset: Record<string, CharsetMeta>;
  engines: StorageEngineMeta[];
  defaults: {
    charset: string;
    collation: string;
    engine: string;
  };
};
