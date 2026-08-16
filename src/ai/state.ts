import { z } from 'zod';
import { StateSchema, MessagesValue } from '@langchain/langgraph';
import { aiModel, aiConfig } from '>/config';
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

let aiStatus = {
  active: false,
  model: aiConfig.model,
};
export const getAiStatus = () => aiStatus;
export const startAiMonitor = () => {
  const check = async () => {
    try {
      aiStatus.model = aiConfig.model;
      const response = await fetch(aiModel.baseUrl);
      aiStatus.active = response.ok;
    } catch {
      aiStatus.active = false;
    }
  };

  check();
  setInterval(check, 5 * 60 * 1000);
};
