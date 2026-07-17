import { z } from 'zod';
import { sortByAllowedChars } from './apiHelpers';
import { SqlTransportTypes } from '>/types';

export const emptyToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

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
  type: z.enum(['PRIMARY', 'UNIQUE', 'INDEX', 'FOREIGN']),
  name: z.string().optional(),
  columns: z.array(z.string().trim().min(1).max(64)).min(1),

  references: z
    .object({
      table: z.string().trim().min(1).max(64),
      columns: z.array(z.string().trim().min(1).max(64)).min(1),
    })
    .optional(),
});

export const baseSortSchema = {
  sortBy: z
    .array(z.string().regex(sortByAllowedChars, 'Invalid sortBy format'))
    .optional(),
};

export const baseTableSchema = {
  database: z.string().trim().min(1).max(64),
  table: z.string().trim().min(1).max(64),
};

export const pageSizeValues = [5, 25, 50, 100, 250] as const;
const PageSizeSchema = z.union(pageSizeValues.map((size) => z.literal(size)));

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

export const ScalarSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.record(z.string(), z.any()),
]);

export const UserProfileSchema = z.enum(['admin', 'editor', 'readOnly']);

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

export const TokenRowSchema = z.object({
  rowIndex: z.number().int().min(0),
  fingerprint: z.string().trim().min(1),
});
