import { z } from 'zod';
import { baseSortSchema, baseFiltersSchema, basePaginationSchema } from './db';

export const FetchDatabasesSchema = z.object({
  ...basePaginationSchema,
  ...baseSortSchema,
  ...baseFiltersSchema,
  system: z.boolean().optional(),
});
