import { loadEnvFile } from 'node:process';
import fs from 'fs';
loadEnvFile();

export const envConfig = {
  ssl: {
    key: fs.readFileSync('../../websites/server.key'),
    cert: fs.readFileSync('../../websites/server.crt'),
    // passphrase: 'password',
  },
  port: 5000,
  host: '127.0.0.1',
  dbUser: {
    host: '127.0.0.1',
    port: 33060,
    user: 'root',
    password: '',
  },
  dbSqlUser: {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
  },
  dbApp: {
    host: '127.0.0.2',
    port: 33061,
    user: 'appUser',
    password: 'Pa55w0rD=R0cknr0!!',
  },
  dbSqlApp: {
    host: '127.0.0.2',
    port: 3306,
    user: 'appUser',
    password: 'Pa55w0rD=R0cknr0!!',
  },
  front: {
    client: '127.0.0.1',
    origin: 'https://127.0.0.1:5173',
  },
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

export const limitsConfig = {
  maxRowsFetch: 500,
};
