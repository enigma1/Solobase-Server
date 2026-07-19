import { loadEnvFile } from 'node:process';
import fs from 'fs';
loadEnvFile();

export const SOLOBASE_SERVER_VERSION = 1;

export const getEnvKey = (k: string) => process.env[k];
const useSsl = getEnvKey('SSL_ENABLED') === '1';
export const envConfig = {
  ssl: useSsl
    ? {
        key: fs.readFileSync(getEnvKey('TLS_KEY') ?? ''),
        cert: fs.readFileSync(getEnvKey('TLS_CERT') ?? ''),
        // passphrase: 'password', // certificate passowrd if used
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
