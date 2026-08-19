import { StateGraph, START, END } from '@langchain/langgraph';
import { checkpointer } from './init';
import { promptState } from './state';
import { generateSqlNode } from './decisionNodes';

const workflow = new StateGraph(promptState)
  .addNode('generateSql', generateSqlNode)
  .addEdge(START, 'generateSql')
  .addEdge('generateSql', END);

export const promptGraph = workflow.compile({
  checkpointer,
});
