import { BaseChatModel } from '@langchain/core/language_models/chat_models';
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
  aiCheckConnectionInterval: 3 * 60 * 1000, // check every 3 minutes
};

export const fastifyConfig = {
  bodyLimit: 10 * 1024 * 1024, // 10MB common body request max size
  routerOptions: {
    ignoreTrailingSlash: true,
  },
  logger: true,
  https: envConfig.ssl,
};

type AIProviderConfig = {
  model: string;
  healthUrl: string;
};
const createAIConfig = (): AIProviderConfig => {
  const model = getEnvKey('AI_MODEL') ?? 'ollama:qwen3.5:9b';

  if (model.startsWith('ollama:')) {
    return {
      model,
      healthUrl: 'http://localhost:11434/api/tags',
    };
  }

  if (model.startsWith('openai:')) {
    return {
      model,
      healthUrl: 'https://api.openai.com/v1/models',
    };
  }

  if (model.startsWith('anthropic:')) {
    return {
      model,
      healthUrl: 'https://api.anthropic.com/v1/models',
    };
  }

  if (model.startsWith('google-genai:')) {
    return {
      model,
      healthUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    };
  }

  // Unknown configuration → Ollama
  return {
    model: 'ollama:qwen3.5:9b',
    healthUrl: 'http://localhost:11434/api/tags',
  };
};

const createAIModel = async (model: string): Promise<BaseChatModel> => {
  if (model.startsWith('ollama:')) {
    return new ChatOllama({
      model: model.slice('ollama:'.length),
      temperature: 0,
      think: false,
    });
  }

  return initChatModel(model, {
    temperature: 0,
  });
};

export const aiConfig = createAIConfig();
export const aiModel = await createAIModel(aiConfig.model);
