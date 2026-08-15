import type { BaseMessage } from '@langchain/core/messages';
import { appErrors } from '>/services';
import { type CapabilityDecision, CapabilityDecisionSchema } from '>/contracts';
import { aiModel } from '>/config';
import { dataCapabilities } from './collections';
import { promptState } from './state';
import { DecisionParameters } from '>/contracts';

const capabilityDescription = dataCapabilities
  .map((capability) => {
    const required = capability.conditions.length
      ? capability.conditions
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
          - Classify the user's most recent request, not the previous requests in the conversation.
          - Use earlier messages only when the most recent request explicitly depends on them or contains a reference that requires context.
          - The most recent user request takes precedence over previous requests.
          - Extract only parameters that are explicitly provided by the user in the current request or are unambiguously resolved from the conversation context.
          - Never reuse a parameter from a previous request unless the current request clearly refers to it.
          - Never invent parameter values.
          - If the most recent request cannot be uniquely mapped to one capability, return capabilityId: null.
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

export const resolveConditionsNode = async (
  state: typeof promptState.State,
) => {
  const { decision } = state;

  if (!decision?.capabilityId) {
    return {
      resolution: {
        satisfied: false,
        reason: 'ambiguous',
        message:
          'What would you like to see: databases, tables, or table data?',
      },
    };
  }

  const capability = dataCapabilities.find(
    (item) => item.id === decision.capabilityId,
  );

  if (!capability) {
    throw appErrors.domain(
      'caps_error',
      `Unknown capability: ${decision.capabilityId}`,
    );
  }

  const parameters = decision.parameters as DecisionParameters;

  for (const condition of capability.conditions) {
    if (!condition.resolve) {
      continue;
    }

    const satisfied = await condition.resolve(parameters);

    if (!satisfied) {
      return {
        resolution: {
          satisfied: false,
          condition: condition.name,
          reason: 'not_found',
          value: decision.parameters[condition.name],
        },
      };
    }
  }

  return {
    resolution: {
      satisfied: true,
    },
  };
};

export const buildResponseNode = async (state: typeof promptState.State) => {
  const { decision, resolution } = state;

  if (!decision?.capabilityId) {
    return {
      answer: 'What would you like to see: databases, tables, or table data?',
      frontRequest: undefined,
    };
  }

  if (!resolution.satisfied) {
    return {
      answer: `I couldn't find ${resolution.condition} "${resolution.value}". Reason: ${resolution.reason}.`,
      frontRequest: undefined,
    };
  }

  const response = {
    answer: `Executing ${decision.capabilityId}.`,
    frontRequest: {
      ...decision.parameters,
      route: decision.capabilityId,
      paging: {
        limit: 50,
        offset: 0,
      },
    },
  };
  return response;
};
