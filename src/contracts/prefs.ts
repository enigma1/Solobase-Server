import { z } from 'zod';
import {
  PageListingsSchema,
  PageSizeSchema,
  ScalarSchema,
  sqlQueryModes,
} from './defs';

export const QueryItemSchema = z.object({
  title: z.string().trim().min(1),
  query: z.string(),
  database: z.string().trim().optional(),
  mode: z.enum(sqlQueryModes).optional(),
  multi: z.boolean().optional(),
});

const CopiedRowSchema = z.object({
  row: z.array(z.unknown()),
  columnsOrder: z.array(z.string()),
});
const SidebarVisibilitySchema = z.object({
  sideDatabases: z.boolean(),
  sideTables: z.boolean(),
  sideQueries: z.boolean(),
});

const StorageConfigSchema = z.object({
  backPort: z.number().int().min(1).max(65535),
  hiddenColumns: z.record(z.string(), z.boolean()),
  sidebarVisibility: SidebarVisibilitySchema,
  headerVisibility: z.boolean(),
  theme: z.string(),
  sidebarWidth: z.number().int().nonnegative(),
  frontPort: z.number().int(),
  pageSizes: z.record(PageListingsSchema, PageSizeSchema),
  allowSystemDatabases: z.boolean().optional(),
});

export const UserPrefsSchema = StorageConfigSchema.extend({
  queries: z.record(z.string(), QueryItemSchema),
  copiedRows: z.record(z.string(), z.array(z.array(ScalarSchema))),
});
export type UserPrefs = z.infer<typeof UserPrefsSchema>;
