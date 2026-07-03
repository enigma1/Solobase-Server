import type { Scalar, SortExprStrList } from '@mysql/xdevapi/types';
import type { FieldPacket, ResultSetHeader, OkPacketParams } from 'mysql2';
import type { JSONObject } from 'type-plus';
import type {
  SqlColumns,
  SqlRow,
  CharsetMeta,
  StorageEngineMeta,
} from './mysql';
import { GroupByModes } from '>/contracts';

export type QueryLogEntry = {
  sql: string;
  params?: unknown;
  connector: 'sql' | 'xdevapi' | 'stream';
  startedAt: number;
  durationMs?: number;
};

export type SqlColumnsShape = Record<string, SqlColumns>;

export type ApiResponse<T> = {
  data: T;
  effects?: {
    sessionId?: string;
    headers?: Record<string, string>;
    status?: number;
  };
};

export type PrimeObject<T = any> = T extends any[] | Function
  ? never
  : T extends object
    ? Record<string, T>
    : never;

export type BasicResponse = {
  ok: boolean;
  message: string;
};

export type DatabaseTableResponse = BasicResponse & {
  database?: string;
  table?: string;
  engine?: string;
};

export type BasicRowsShape = {
  rows: SqlRow[];
  cols: SqlColumnsShape;
  columnsOrder: string[];
};

export type TableBasics = {
  database: string;
  table: string;
};

export type LoginRequest = {
  username: string;
  password: string;
};

export type UserCapabilities = {
  canGrantPrivileges: boolean;
  canViewUsers: boolean;
  canManageUsers: boolean;
  canCreateDatabases: boolean;
  canManageTables: boolean;
  canEditData: boolean;
};

export type LoginResponse = {
  schemas: string[];
  preferences: Record<string, any>;
  capabilities: UserCapabilities;
};
// export type DatabaseInfo = RowDataPacket & {
//   name: string;
//   charset: string;
//   collation: string;
// };
// export type FetchDatabasesResponse = {
//   databases: DatabaseInfo[];
// };

export type FetchTablesRequest = {
  database?: string;
};

export type FetchTablesResponse = BasicRowsShape;

export type RunQueryRequest = {
  query: string;
};

export type RunRawQueryRequest = {
  query: string;
  database?: string;
  groupByMode?: GroupByModes;
};

export type ColumnInfo = {
  name: string;
  table?: string;
  type?: string;
};

type ResultSetResponse = BasicResponse & {
  mode: 'resultset';
  rows: Scalar[][];
  columnsOrder: string[];
  cols: SqlColumnsShape;
};

type CommandResponse = BasicResponse & {
  mode: 'command';
  resultInfo: OkPacketParams | ResultSetHeader;
};

export type RunRawQueryResponse = ResultSetResponse | CommandResponse;

export type SelectDatabaseRequest = {
  name: string;
};

export type SelectDatabaseResponse = BasicResponse & {
  database?: string;
};

export type FetchRowsRequest = {
  table: string;
  offset?: number;
  limit?: number;
  sortBy?: SortExprStrList;
  // sortBy?: (
  //   | `${string} ASC`
  //   | `${string} DESC`
  //   | `${string} asc`
  //   | `${string} desc`
  // )[];
};

// export type SqlColumnType = [
//   field: string,
//   type: string,
//   nullable: 'YES' | 'NO',
//   key: 'PRI' | 'UNI' | 'MUL' | '',
//   defaultValue: string | null,
//   extra: string,
// ];

export type FetchDatabasesResponse = BasicRowsShape;

export type CollectionColumns = {
  _id: string;
  doc: JSONObject;
};
export type ScalarObject = Record<string, Scalar>;
export type CollectionRow = { _id: string } & PrimeObject<JSONObject>;
export type DbTableType = 'collection' | 'table';
export type DbTableRow = CollectionRow | SqlRow;
export type DbTableColumns = CollectionColumns | Record<string, SqlColumns>;

export type DbTableData =
  | {
      type: 'table';
      rows: SqlRow[];
      cols: Record<string, SqlColumns>;
    }
  | {
      type: 'collection';
      rows: CollectionRow[];
      cols: CollectionColumns;
    };

// export type DbTableData = {
//   rows: DbTableRow[];
//   cols: DbTableColumns;
//   type: DbTableType;
// };

export type FetchRowsResponse = DbTableData & { columnsOrder: string[] };

export type NonSqlRowsRequest = {
  rows: {
    _id: string;
  }[];
  table: string;
};

export type NonSqlRowsResponse = {
  rows: CollectionColumns[];
  cols: CollectionColumns;
};

type EditedRow = {
  originalRow: SqlRow; // original row as fetched from the database
  updatedValues: ScalarObject; // column name with new value
  rowIndex?: number; // optional original row index as it was fetched
};

export type EditedCollectionRow = {
  originalRow: CollectionRow; // original row as fetched from the database
  updatedValues: CollectionRow; // column name with new value
  rowIndex?: number; // optional original row index as it was fetched
  command?: string; // original SQL command, if applicable
};

export type UpdateDataRowsRequest = {
  dataRows: EditedRow[] | EditedCollectionRow[]; // All edited rows
  command?: string; // original SQL command
  table: string;
  database: string;
};

export type UpdateDataRowsResponse = BasicResponse & {
  table: string;
  database: string;
};

export type RunQueryResponse = BasicRowsShape & {
  query: string;
  truncated: boolean;
};

// export type CharsetMeta = {
//   maxlen: number;
//   defaultCollation: string;
//   collations: string[];
// };

// type StorageEngineMeta = {
//   name: string;
//   isDefault: boolean;
//   transactions: boolean;
//   xa: boolean;
//   savepoints: boolean;
// };

export type FetchDatabaseInfoResponse = {
  collationsByCharset: Record<string, CharsetMeta>;
  engines: StorageEngineMeta[];
  defaults: {
    charset: string;
    collation: string;
    engine: string;
  };
};

export type SessionRestoreResponse = {
  schemas: BasicRowsShape;
  username: string;
  dbSelected: string | null;
  preferences: Record<string, any>;
};

export type UserShape = {
  user: string;
  host: string;
  password: string;
  profile?: UserProfile;
};

export type UserProfile = 'admin' | 'editor' | 'readOnly';
export type CreateUserRequest = UserShape;
export type CreateUserResponse = BasicResponse;

export type EditUserRequest = UserShape & {
  orgUser: string;
  orgHost: string;
  passwordChange?: boolean;
};
export type EditUserResponse = BasicResponse;

export type CreateDatabaseRequest = {
  name: string;
  charset?: string;
  collation?: string;
};

export type CreateDatabaseResponse = BasicResponse & {
  database?: string;
};

export type EditDatabaseRequest = {
  name: string;
  charset?: string;
  collation?: string;
};

export type EditDatabaseResponse = BasicResponse & {
  database?: string;
};

export type ExportDatabasesRequest = {
  databases: string[];
};

export type ExportDatabasesResponse = BasicResponse & {
  databases: string[];
};

export type DeleteDatabasesRequest = {
  names: string[];
};

export type DeleteDatabasesResponse = BasicResponse & {
  databases: string[];
};

export type DeleteTablesRequest = {
  database: string;
  tables: string[];
};

export type DeleteTablesResponse = BasicResponse & {
  database: string;
  tables: string[];
};

export type TableShapeBasics = TableBasics & {
  engine?: string;
  charset?: string;
  collation?: string;
};

export type TableShapeKey = {
  signature?: string;
  type: 'PRIMARY' | 'UNIQUE' | 'INDEX' | 'FOREIGN';
  name?: string;
  columns: string[];

  // only if FOREIGN
  references?: {
    table: string;
    columns: string[];
  };
};

export type TableShapeColumn = {
  signature?: string;
  field: string;
  type: string;
  params?: Record<string, string | number>;
  nullable?: boolean;
  defaultValue?: string | null;
  autoIncrement?: boolean;
  unsigned?: boolean;
  comment?: string;
};
export type TableShape = TableShapeBasics & {
  keys: TableShapeKey[];
  cols: TableShapeColumn[];
};

export type CreateTableRequest = TableShape;
export type CreateTableResponse = DatabaseTableResponse;

export type EditTableRequest = {
  original: TableShape;
  modified: TableShape;
};
export type EditTableResponse = DatabaseTableResponse;

export type GetTableDetailsRequest = TableBasics;
export type GetTableDetailsResponse = BasicResponse &
  TableShape & {
    engine: string;
    charset: string;
    collation: string;
  };

export type GetTableColumnsInfoRequest = TableBasics;
export type GetTableColumnsInfoResponse = BasicResponse &
  TableBasics &
  BasicRowsShape;

export type CreateDataRowsRequest = TableBasics & {
  rows: SqlRow[];
};
export type CreateDataRowsResponse = BasicResponse & TableBasics;

export type DeleteDataRowsRequest = TableBasics & {
  rows: SqlRow[];
};
export type DeleteDataRowsResponse = BasicResponse & TableBasics;

export type FetchUsersResponse = BasicResponse & BasicRowsShape;

export type DeleteUsersRequest = {
  columnsOrder: string[];
  rows: SqlRow[];
};
export type DeleteUsersResponse = BasicResponse;

export type ImportDataRequest = {
  database?: string;
  data: string;
  groupByMode?: GroupByModes;
};

export type ImportDataResponse = BasicResponse;
