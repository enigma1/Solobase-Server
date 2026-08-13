import type { BaseMessage } from '@langchain/core/messages';
import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { type CapabilityDecision, CapabilityDecisionSchema } from '>/contracts';
import { aiModel } from '>/config';
import { dataCapabilities } from './collections';
import { promptState } from './state';

const capabilityDescription = dataCapabilities
  .map((capability) => {
    const required = capability.required.length
      ? capability.required
          .map((item) => `${item.name}: ${item.description}`)
          .join('\n')
      : 'None';

    return `
      ID: ${capability.id}
      Description: ${capability.description}
      Required parameters:
      ${required}
      `;
  })
  .join('\n');

const classifier = aiModel.withStructuredOutput(CapabilityDecisionSchema);

export const decideCapability = async (
  messages: BaseMessage[],
): Promise<CapabilityDecision> => {
  return classifier.invoke([
    {
      role: 'system',
      content: `
        You determine which database-management capability
        the user is requesting.

        Available capabilities:

        ${capabilityDescription}

        Rules:

          - Choose only one of the listed capability IDs.
          - If the conversation cannot be uniquely mapped to one capability, return capabilityId: null.
          - Classify the conversation and extract the parameters explicitly provided by the user.
          - Never invent parameter values.
          - Do not perform the requested operation or generate an answer for the user.
          - Return only the capability decision.
      `,
    },
    ...messages,
  ]);
};

export const decideNode = async (state: typeof promptState.State) => {
  const decision = await decideCapability(state.messages);

  return {
    decision,
  };
};
