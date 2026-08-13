import { MemorySaver } from '@langchain/langgraph';
import { StateGraph, START, END } from '@langchain/langgraph';
import { promptState } from './state';
import { decideNode } from './decisions';

const checkpointer = new MemorySaver();

const workflow = new StateGraph(promptState)
  .addNode('decide', decideNode)
  .addEdge(START, 'decide')
  .addEdge('decide', END);

export const promptGraph = workflow.compile({
  checkpointer,
});
