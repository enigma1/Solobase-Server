import {
  StateGraph,
  StateSchema,
  MessagesValue,
  START,
  END,
} from '@langchain/langgraph';
import { CapabilityDecisionSchema } from '>/contracts';

export const promptState = new StateSchema({
  messages: MessagesValue,
  decision: CapabilityDecisionSchema.optional(),
  // other graph state...
});
