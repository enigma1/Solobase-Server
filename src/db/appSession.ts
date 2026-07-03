import { v4 as uuidv4 } from 'uuid';
import mysqlx from '@mysql/xdevapi';
import { envConfig } from '>/config';

export const getEnvKey = (k: string) => process.env[k];

export const appClient = mysqlx.getClient(
  {
    host: envConfig.dbApp.host,
    port: envConfig.dbApp.port,
    user: envConfig.dbApp.user,
    password: envConfig.dbApp.password,
    schema: undefined,
  },
  {
    pooling: {
      enabled: true,
      maxSize: 49, // max concurrent sessions
    },
  },
);
