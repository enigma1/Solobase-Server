import { z } from 'zod';

export const GroupByModesSchema = z.enum(['default', 'legacy', 'strict']);
export type GroupByModes = z.infer<typeof GroupByModesSchema>;

export const TableShapeKeyTypes = z.enum([
  'PRIMARY',
  'UNIQUE',
  'INDEX',
  'FOREIGN',
]);

export const sqlQueryModes = ['default', 'legacy', 'strict'] as const;
export type SqlQueryModes = (typeof sqlQueryModes)[number];

export const pListings = [
  'userRows',
  'dbRows',
  'tableRows',
  'dataRows',
  'queryRows',
] as const;

export const PageListingsSchema = z.enum(pListings);
export type PageListings = (typeof pListings)[number];

export const pageSizeValues = [25, 50, 100, 250] as const;
export const PageSizeSchema = z.union(
  pageSizeValues.map((size) => z.literal(size)),
);

export const ScalarSchema = z.union([
  z.date(),
  z.bigint(),
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
  z.record(z.string(), z.unknown()),
]);

export const columnDirections = ['asc', 'desc'] as const;
export const SortDirectionSchema = z.enum(columnDirections);
export type SortDirection = (typeof columnDirections)[number];

const columnQueryModes = ['where', 'like', 'groupBy', 'distinct'] as const;

export const ColumnQueryModeSchema = z.enum(columnQueryModes);
export type ColumnQueryMode = (typeof columnQueryModes)[number];
