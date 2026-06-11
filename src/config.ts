import fs from 'fs';

export const envConfig = {
  ssl: {
    key: fs.readFileSync('../../websites/rootCA.key'),
    cert: fs.readFileSync('../../websites/rootCA.pem'),
    passphrase: 'password',
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
  pollingIdleTimer: 1000 * 60 * 10, // check every 10 minutes
};

export const fastifyConfig = {
  routerOptions: {
    ignoreTrailingSlash: true,
  },
  logger: true,
  https: envConfig.ssl,
};

export const limitsConfig = {
  maxRowsFetch: 500,
};
