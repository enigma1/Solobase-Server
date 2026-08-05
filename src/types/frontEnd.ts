import type { ResultSetHeader, OkPacketParams } from 'mysql2/promise';
import type { SqlColumns, CharsetMeta, StorageEngineMeta } from './mysql';
import type {
  SqlRow,
  SqlTransportObject,
  SqlTransportRow,
  SqlTypes,
} from './db';
// import type { UserPrefs } from './prefs';
import type { ColumnQueryMode, GroupByModes, UserPrefs } from '>/contracts';

export type FilterColumnParams = {
  value?: SqlTypes;
  mode: ColumnQueryMode;
};

export type FilterColumnsRequest = {
  filters?: Record<string, FilterColumnParams[]>;
};

export type SortByParams = {
  direction: 'asc' | 'desc';
};

export type SortByRequest = {
  sortBy?: Record<string, SortByParams>;
};

export type PagingResponse = {
  paging?: {
    hasNext: boolean;
    hasPrevious: boolean;
  };
};

export type PagingRequest = {
  paging?: {
    offset: number;
    limit: number;
  };
};

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

export type BasicDataResponse = BasicResponse & BasicRowsShape & PagingResponse;

export type DatabaseTableResponse = BasicResponse & {
  database?: string;
  table?: string;
  engine?: string;
};

export type TokenRow = {
  rowIndex: number;
  fingerprint: string;
};
export type BasicRowsShape = {
  rows: SqlRow[];
  cols: SqlColumnsShape;
  columnsOrder: string[];
  rowTokens?: TokenRow[];
  orderBy?: string;
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

export type CleanupResponse = BasicResponse;

export type LoginResponse = BasicResponse & {
  preferences: Record<string, any>;
  capabilities: string[];
};

export type AbortSqlRequest = {};
export type AbortSqlResponse = BasicResponse;

export type FetchTablesRequest = PagingRequest &
  SortByRequest & {
    database?: string;
  };

export type FetchTablesResponse = BasicDataResponse;

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
  rows: SqlRow[];
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

export type FetchRowsRequest = TableBasics &
  PagingRequest &
  SortByRequest &
  FilterColumnsRequest;
export type FetchRowsResponse = BasicDataResponse;

export type FetchDatabasesRequest = PagingRequest & SortByRequest;
export type FetchDatabasesResponse = BasicRowsShape & PagingResponse;

// export type FetchRowsResponse = DbTableData & { columnsOrder: string[] };

export type ChangedRow = {
  updatedValues: SqlTransportObject; // column name with new value
  originalRow: SqlTransportRow; // original row as fetched from the database
  rowToken?: TokenRow; // Fingerprint with offset if applicable
};

export type UpdateDataRowsRequest = TableBasics & {
  dataRows: ChangedRow[]; // All edited rows
  orderBy?: string;
};

export type UpdateDataRowsResponse = BasicResponse & {
  table: string;
  database: string;
};

export type RunQueryResponse = BasicRowsShape & {
  query: string;
  truncated: boolean;
};

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
  username: string;
  dbSelected: string | null;
  preferences: Record<string, any>;
  capabilities: string[];
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

export type ExportTablesRequest = {
  database: string;
  tables: string[];
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

export type DeletedRow = {
  originalRow: SqlTransportRow; // original row as fetched from the database
  rowToken?: TokenRow; // Fingerprint with offset if applicable
};

export type DeleteDataRowsRequest = TableBasics & {
  dataRows: DeletedRow[]; // All edited rows
  orderBy?: string;
};
export type DeleteDataRowsResponse = BasicResponse & TableBasics;

export type FetchUsersResponse = BasicDataResponse;

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

export type SavePreferencesRequest = {
  version: number;
  userPrefs: UserPrefs;
};

export type SavePreferencesResponse = BasicResponse;

export type LoadPreferencesRequest = {
  user: string;
};

export type LoadPreferencesResponse = BasicResponse & {
  userPrefs?: UserPrefs;
};
