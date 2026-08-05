import { z } from 'zod';
import { SqlTransportTypes } from '>/types';
import {
  TableShapeKeyTypes,
  PageSizeSchema,
  SortDirectionSchema,
  ColumnQueryModeSchema,
} from './defs';
import { emptyToUndefined } from './helpers';

const JsonValueSchema: z.ZodType<SqlTransportTypes> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);
export const TableShapeColumnSchema = z.object({
  // uid: z.string().min(1),
  signature: z.string().optional(),
  field: z.string().trim().min(1).max(64),
  type: z.string().trim().min(1),
  params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  nullable: z.boolean().optional(),
  defaultValue: z.string().nullable().optional(),
  autoIncrement: z.boolean().optional(),
  unsigned: z.boolean().optional(),
  comment: z.string().optional(),
});

export const TableShapeKeySchema = z.object({
  // uid: z.string().min(1),
  signature: z.string().optional(),
  type: TableShapeKeyTypes,
  name: z.string().optional(),
  columns: z.array(z.string().trim().min(1).max(64)).min(1),

  references: z
    .object({
      table: z.string().trim().min(1).max(64),
      columns: z.array(z.string().trim().min(1).max(64)).min(1),
    })
    .optional(),
});

export const SortByParamsSchema = z.object({
  direction: SortDirectionSchema,
});

export const baseSortSchema = {
  sortBy: z.record(z.string(), SortByParamsSchema).optional(),
};

export const baseTableSchema = {
  database: z.string().trim().min(1).max(64),
  table: z.string().trim().min(1).max(64),
};

export const FilterColumnParamsSchema = z.object({
  value: JsonValueSchema.optional(), // replace with your SqlTypes schema
  mode: ColumnQueryModeSchema,
});

export const baseFiltersSchema = {
  filters: z.record(z.string(), z.array(FilterColumnParamsSchema)).optional(),
};

export const basePaginationSchema = {
  paging: z
    .object({
      limit: PageSizeSchema,
      offset: z.coerce.number().int().min(0),
    })
    .optional(),
};

export const CommonBaseTableSchema = z.object(baseTableSchema);
export const CommonTableSchema = z.object({
  ...baseTableSchema,
  engine: z.string().trim().min(1).max(64).optional(),
  charset: z.preprocess(emptyToUndefined, z.string().optional()),
  collation: z.preprocess(emptyToUndefined, z.string().optional()),
  cols: z.array(TableShapeColumnSchema).min(1),
  keys: z.array(TableShapeKeySchema),
});

export const UserProfileSchema = z.enum(['admin', 'editor', 'readOnly']);

export const TokenRowSchema = z.object({
  rowIndex: z.number().int().min(0),
  fingerprint: z.string().trim().min(1),
});
