import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AIMessage } from '@langchain/core/messages';
import { FrontRequestSchema } from '>/contracts';
import { aiModel } from '>/config';
import { promptState } from './state';

const promptDir = resolve(process.cwd(), 'src/ai/assistText');

const rules = readFileSync(resolve(promptDir, 'rules.txt'), 'utf8').trim();
const examples = readFileSync(
  resolve(promptDir, 'examples.txt'),
  'utf8',
).trim();
const systemPrompt = readFileSync(resolve(promptDir, 'system.txt'), 'utf8')
  .replace('{RULES}', rules)
  .replace('{EXAMPLES}', examples)
  .trim();

const sqlGenerator = aiModel.withStructuredOutput(FrontRequestSchema);

export const generateSqlNode = async (state: typeof promptState.State) => {
  const currentMessage = state.messages.at(-1);

  const result = await sqlGenerator.invoke([
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: `CURRENT USER REQUEST: ${String(currentMessage?.content ?? '')}`,
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
