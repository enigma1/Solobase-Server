import { CapabilityParameterName } from '>/contracts';

export type PromptItem = {
  asked: string;
  answered: string;
};
export type PromptData = {
  prompts: PromptItem[];
};

export type CapabilityParameter = {
  name: CapabilityParameterName;
  description: string;
  type: string;
};

export type Capability = {
  id: string;
  description: string;
  required: CapabilityParameter[];
};
