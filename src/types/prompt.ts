import { DecisionParameters, CapabilityParameterName } from '>/contracts';

export type PromptItem = {
  asked: string;
  answered: string;
};
export type PromptData = {
  prompts: PromptItem[];
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
