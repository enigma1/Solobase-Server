import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AIMessage } from '@langchain/core/messages';
import { FrontRequestSchema, QueryScopeSchema } from '>/contracts';
import { aiModel } from '>/config';
import { promptState } from './state';

const promptDir = resolve(process.cwd(), 'src/ai/assistText');
const scopePrompt = readFileSync(
  resolve(promptDir, 'scopePrompt.txt'),
  'utf8',
).trim();

const rules = readFileSync(resolve(promptDir, 'rules.txt'), 'utf8').trim();
const examples = readFileSync(
  resolve(promptDir, 'examples.txt'),
  'utf8',
).trim();
const systemPrompt = readFileSync(resolve(promptDir, 'system.txt'), 'utf8')
  .replace('{RULES}', rules)
  .replace('{EXAMPLES}', examples)
  .trim();

const scopeClassifier = aiModel.withStructuredOutput(QueryScopeSchema);
const sqlGenerator = aiModel.withStructuredOutput(FrontRequestSchema);

export const classifyScopeNode = async (state: typeof promptState.State) => {
  const currentMessage = state.messages.at(-1);
  const currentRequest = String(currentMessage?.content ?? '');

  const scopeResult = await scopeClassifier.invoke([
    {
      role: 'system',
      content: scopePrompt,
    },
    {
      role: 'user',
      content: currentRequest,
    },
  ]);

  return {
    queryScope: scopeResult,
  };
};

export const generateSqlNode = async (state: typeof promptState.State) => {
  const currentMessage = state.messages.at(-1);
  const currentRequest = String(currentMessage?.content ?? '');

  let userPrompt = `CURRENT USER REQUEST: ${currentRequest}`;

  if (state.queryScope === 'thread') {
    userPrompt += `CONVERSATION HISTORY:${JSON.stringify(state.messages)}`;
  }

  const result = await sqlGenerator.invoke([
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: userPrompt,
    },
  ]);

  const answer = result.completed
    ? 'I have prepared the SQL query:'
    : `I need clarification on the following:\n${result.missing
        .map((item) => item.question)
        .join('\n')}`;

  return {
    frontRequest: result,
    messages: [
      new AIMessage({
        content: answer,
        additional_kwargs: {
          frontRequest: result,
        },
      }),
    ],
  };
};
