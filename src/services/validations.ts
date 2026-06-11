import { z } from 'zod';

const emptyToUndefined = (v: unknown) =>
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

export const CommonTableSchema = z.object({
  database: z.string().trim().min(1).max(64),
  table: z.string().trim().min(1).max(64),
  engine: z.string().trim().min(1).max(64).optional(),
  charset: z.preprocess(emptyToUndefined, z.string().optional()),
  collation: z.preprocess(emptyToUndefined, z.string().optional()),
  cols: z.array(TableShapeColumnSchema).min(1),
  keys: z.array(TableShapeKeySchema),
});
