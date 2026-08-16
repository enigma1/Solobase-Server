import { MemorySaver } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';

import { StateGraph, START, END } from '@langchain/langgraph';
import { ConversationMessage } from '>/types';
import { promptState } from './state';
import {
  decideNode,
  resolveConditionsNode,
  buildResponseNode,
} from './decisionNodes';

const checkpointer = new MemorySaver();

const workflow = new StateGraph(promptState)
  .addNode('decide', decideNode)
  .addNode('resolveConditions', resolveConditionsNode)
  .addNode('buildResponse', buildResponseNode)
  .addEdge(START, 'decide')
  .addEdge('decide', 'resolveConditions')
  .addEdge('resolveConditions', 'buildResponse')
  .addEdge('buildResponse', END);

export const promptGraph = workflow.compile({
  checkpointer,
});

export const getConversationMessages = async (
  conversationId: string,
): Promise<ConversationMessage[]> => {
  const state = await promptGraph.getState({
    configurable: {
      thread_id: conversationId,
    },
  });

  return (state.values.messages ?? [])
    .map((message: BaseMessage): ConversationMessage | null => {
      const type = message.getType();

      if (type === 'human') {
        return {
          role: 'user',
          content: String(message.content),
        };
      }

      if (type === 'ai') {
        return {
          role: 'llm',
          content: String(message.content),
        };
      }

      return null;
    })
    .filter(
      (message: ConversationMessage | null): message is ConversationMessage =>
        message !== null,
    );
};
