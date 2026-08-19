import { DecisionParameters, CapabilityParameterName } from '>/contracts';

export type ConversationMessage = {
  role: 'user' | 'llm';
  content: string;
};

export type PromptData = {
  prompts: ConversationMessage[];
};

export type SqlHistory = {
  sqlHistory: string[];
};

export type ParameterResolver = (param: DecisionParameters) => Promise<boolean>;

export type CapabilityParameter = {
  name: CapabilityParameterName;
  description: string;
  type: string;
  resolve?: ParameterResolver;
};

export type Capability = {
  id: string;
  description: string;
  conditions: CapabilityParameter[];
};
