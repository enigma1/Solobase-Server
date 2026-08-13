import { z } from 'zod';

export const CapabilityDecisionSchema = z.object({
  capabilityId: z.string().optional(),
  parameters: z.object({
    database: z.string().optional(),
    table: z.string().optional(),
  }),
});

export type CapabilityDecision = z.infer<typeof CapabilityDecisionSchema>;
export type CapabilityParameterName = keyof CapabilityDecision['parameters'];
