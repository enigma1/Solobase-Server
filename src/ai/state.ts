import { StateSchema, MessagesValue } from '@langchain/langgraph';
import { aiModel, aiConfig, envConfig } from '>/config';
import { FrontRequestSchema } from '>/contracts';
import type { FrontRequestObject } from '>/types';

export type PromptResult = {
  status: 'needs_information' | 'condition_failed' | 'execute';
  answer: string;
  frontRequest?: FrontRequestObject;
};

export const promptState = new StateSchema({
  messages: MessagesValue,
  frontRequest: FrontRequestSchema,
});

let aiStatus = {
  active: false,
  model: aiConfig.model,
};
export const getAiStatus = () => aiStatus;

// Check if llm service is running
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
  setInterval(check, envConfig.aiCheckConnectionInterval);
};
