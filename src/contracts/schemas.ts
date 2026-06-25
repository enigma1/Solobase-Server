import { z } from 'zod';

export const GroupByModesSchema = z.enum(['default', 'legacy', 'strict']);
export type GroupByModes = z.infer<typeof GroupByModesSchema>;
