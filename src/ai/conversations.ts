import {
  AIMessage,
  HumanMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import { FrontRequestSchema } from '>/contracts';
import { ConversationMessage } from '>/types';
import { FrontRequestObject } from '>/types';
import { promptGraph } from './graph';

export const getConversationSql = async (
  conversationId: string,
): Promise<string[]> => {
  const state = await promptGraph.getState({
    configurable: {
      thread_id: conversationId,
    },
  });

  const messages = (state.values.messages ?? []) as BaseMessage[];
  return messages
    .filter((message) => message.type === 'ai')
    .map(
      (message) =>
        message.additional_kwargs?.frontRequest as FrontRequestObject,
    )
    .filter((request) => request.completed)
    .map((request) => request.sqlQuery);
};

export const getConversationMessages = async (
  conversationId: string,
): Promise<ConversationMessage[]> => {
  const state = await promptGraph.getState({
    configurable: {
      thread_id: conversationId,
    },
  });

  const messages = state.values?.messages ?? [];

  return messages
    .map((message: BaseMessage): ConversationMessage | null => {
      if (message instanceof HumanMessage) {
        return {
          role: 'user',
          content: String(message.content),
        };
      }

      if (message instanceof AIMessage) {
        const frontRequest = message.additional_kwargs.frontRequest;

        return {
          role: 'llm',
          content: String(message.content),
          ...(frontRequest
            ? { frontRequest: FrontRequestSchema.parse(frontRequest) }
            : {}),
        };
      }

      return null;
    })
    .filter(
      (message: ConversationMessage | null): message is ConversationMessage =>
        message !== null,
    );
};
