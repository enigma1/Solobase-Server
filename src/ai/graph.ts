import { MemorySaver } from '@langchain/langgraph';
import { StateGraph, START, END } from '@langchain/langgraph';
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
