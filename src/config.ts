import { initChatModel } from 'langchain';
import { loadEnvFile } from 'node:process';
import fs from 'fs';
import { ChatOllama } from '@langchain/ollama';

loadEnvFile();
export const getEnvKey = (k: string) => process.env[k];
process.env.ANTHROPIC_API_KEY = getEnvKey('ANTHROPIC_API_KEY');
process.env.OPENAI_API_KEY = getEnvKey('OPENAI_API_KEY');
process.env.GOOGLE_API_KEY = getEnvKey('GOOGLE_API_KEY');

export const SOLOBASE_SERVER_VERSION = 1;
const useSsl = getEnvKey('SSL_ENABLED') === '1';
export const envConfig = {
  ssl: useSsl
    ? {
        key: fs.readFileSync(getEnvKey('TLS_KEY') ?? ''),
        cert: fs.readFileSync(getEnvKey('TLS_CERT') ?? ''),
        ...(getEnvKey('TLS_PASSPHRASE')
          ? { passphrase: getEnvKey('TLS_PASSPHRASE') }
          : {}),
      }
    : undefined,
  cookieTimeout: 1000 * 3600 * 2, // 2 hours
  sqlIdleTimeout: 1000 * 3600 * 2, // ditto
  pollIdleInterval: 1000 * 60 * 24, // check every 24 minutes

  retiredSessionRemoval: 1000 * 60 * 5, // release after 5 minutes
  pollRetiredSessionInterval: 1000 * 60 * 2, // check every 2 minutes
};

export const fastifyConfig = {
  bodyLimit: 10 * 1024 * 1024, // 10MB common body request max size
  routerOptions: {
    ignoreTrailingSlash: true,
  },
  logger: true,
  https: envConfig.ssl,
};

// const aiConfig = {
//   model: getEnvKey('AI_MODEL'),
// };

// export const aiModel = await initChatModel(aiConfig.model);

export const aiModel = new ChatOllama({
  model: 'qwen3.5:9b',
  temperature: 0,
  think: false,
});
