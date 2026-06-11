import { v4 as uuidv4 } from 'uuid';
import mysqlx from '@mysql/xdevapi';
import { envConfig } from '>/config';

export const appClient = mysqlx.getClient(
  {
    host: envConfig.dbApp.host,
    port: envConfig.dbApp.port,
    user: envConfig.dbApp.user,
    password: envConfig.dbApp.password,
    schema: 'db_manager',
  },
  {
    pooling: {
      enabled: true,
      maxSize: 10, // max concurrent sessions
    },
  },
);
