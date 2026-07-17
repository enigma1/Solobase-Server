import mysqlx from '@mysql/xdevapi';
import { getEnvKey } from '>/config';

export const appClient = mysqlx.getClient(
  {
    host: getEnvKey('DB_APP_XHOST'),
    port: Number(getEnvKey('DB_APP_XPORT')),
    user: getEnvKey('DB_APP_XUSER')!,
    password: getEnvKey('DB_APP_XPASSWORD'),
    schema: undefined,
  },
  {
    pooling: {
      enabled: true,
      maxSize: 49, // max concurrent sessions
    },
  },
);
