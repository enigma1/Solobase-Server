import { z } from 'zod';
import { StateSchema, MessagesValue } from '@langchain/langgraph';
import {
  FrontRequestSchema,
  CapabilityDecisionSchema,
  ResolutionSchema,
} from '>/contracts';
import type { FrontRequestObject } from '>/types';

export type PromptResult = {
  status: 'needs_information' | 'condition_failed' | 'execute';
  answer: string;
  frontRequest?: FrontRequestObject;
};

export const promptState = new StateSchema({
  messages: MessagesValue,
  decision: CapabilityDecisionSchema.optional(),
  resolution: ResolutionSchema,
  frontRequest: FrontRequestSchema.optional(),
  answer: z.string().default(''),
  // other graph state...
});
