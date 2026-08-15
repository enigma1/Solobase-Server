import { z } from 'zod';
import {
  baseTableUndefinedSchema,
  baseFiltersSchema,
  basePaginationSchema,
  baseSortSchema,
} from './db';

export const CapabilityDecisionSchema = z.object({
  capabilityId: z.string().optional(),
  parameters: z.object({
    database: z.string().optional(),
    table: z.string().optional(),
  }),
});

export type CapabilityDecision = z.infer<typeof CapabilityDecisionSchema>;
export type CapabilityParameterName = keyof CapabilityDecision['parameters'];
export type DecisionParameters = Record<
  CapabilityParameterName,
  string | undefined
>;

export const ResolutionSchema = z.object({
  satisfied: z.boolean(),
  condition: z.string().optional(),
  reason: z.string().optional(),
  value: z.string().optional(),
});

export type Resolution = z.infer<typeof ResolutionSchema>;

export const FrontRequestSchema = z.object({
  ...baseTableUndefinedSchema,
  ...basePaginationSchema,
  ...baseSortSchema,
  ...baseFiltersSchema,

  route: z.string().trim().min(5).max(128),
});

export type FrontRequestObject = z.infer<typeof FrontRequestSchema>;
