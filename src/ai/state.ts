import { StateSchema, MessagesValue } from '@langchain/langgraph';
import { aiModel, aiConfig, envConfig } from '>/config';
import { FrontRequestSchema, QueryScopeSchema } from '>/contracts';
import type { FrontRequestObject } from '>/types';

export type PromptResult = {
  status: 'needs_information' | 'condition_failed' | 'execute';
  answer: string;
  frontRequest?: FrontRequestObject;
};

export const promptState = new StateSchema({
  messages: MessagesValue,
  frontRequest: FrontRequestSchema,
  queryScope: QueryScopeSchema,
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
      await fetch(aiConfig.healthUrl);
      aiStatus.active = true;
    } catch (e) {
      aiStatus.active = false;
    }
  };
  check();
  setInterval(check, envConfig.aiCheckConnectionInterval);
};
