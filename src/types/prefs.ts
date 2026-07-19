import type { SqlQueryModes } from '>/contracts/defs';
import type { SqlRow } from './db';

export const pListings = [
  'userRows',
  'dbRows',
  'tableRows',
  'dataRows',
  'queryRows',
] as const;

export type PageListings = (typeof pListings)[number];
export type CopiedRow = { row: SqlRow; columnsOrder: string[] };

export type QueryItem = {
  title: string;
  query: string;
  database?: string;
  mode?: SqlQueryModes;
  multi?: boolean;
};

export type SidebarVisibility = {
  sideDatabases: boolean;
  sideTables: boolean;
  sideQueries: boolean;
};
export type SidebarOptions = keyof SidebarVisibility;

// export type StorageConfig = {
//   hiddenColumns: Record<string, boolean>;
//   sidebarVisibility: SidebarVisibility;
//   headerVisibility: boolean;
//   theme: string;
//   sidebarWidth: number;
//   backPort: number;
//   frontPort: number;
//   pageSizes: Record<PageListings, number>;
// };

// export type UserPrefs = StorageConfig & {
//   queries: Record<string, QueryItem>;
//   copiedRows: Record<string, SqlRow[]>;
// };
