import { StateGraph, START, END } from '@langchain/langgraph';
import { checkpointer } from './init';
import { promptState } from './state';
import { generateSqlNode, classifyScopeNode } from './decisionNodes';

const workflow = new StateGraph(promptState)
  .addNode('classifyScope', classifyScopeNode)
  .addNode('generateSql', generateSqlNode)
  .addEdge(START, 'classifyScope')
  .addEdge('classifyScope', 'generateSql')
  .addEdge('generateSql', END);

export const promptGraph = workflow.compile({
  checkpointer,
});
