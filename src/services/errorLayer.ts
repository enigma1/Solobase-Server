import { ZodError } from 'zod';
import { AppError, MySqlError } from '>/types';

export const appErrors = {
  authMissing: () => ({
    type: 'auth',
    kind: 'missing',
  }),

  authInvalid: () => ({
    type: 'auth',
    kind: 'invalid',
  }),

  mysql: (error: MySqlError) => ({
    type: 'mysql',
    error,
  }),

  validation: (error: ZodError) => ({
    type: 'validation',
    error,
  }),
  domain: (code: string, message: string) => ({
    type: 'domain',
    code,
    message,
  }),
  server: (code: number, message: string) => ({
    type: 'server',
    code,
    message,
  }),
} satisfies {
  authMissing: () => AppError;
  authInvalid: () => AppError;
  mysql: (error: MySqlError) => AppError;
  validation: (error: ZodError) => AppError;
  domain: (code: string, message: string) => AppError;
  server: (code: number, message: string) => AppError;
};

export const errorResolver = (e: unknown): AppError => {
  if (typeof e === 'object' && e && 'type' in e) {
    return e as AppError;
  }

  const err = e as any;

  // Fastify HTTP errors
  if (err?.statusCode) {
    if (err.statusCode === 401) {
      return appErrors.authInvalid();
    }

    if (err.statusCode === 404) {
      return appErrors.server(404, err.message);
    }

    return appErrors.server(err.statusCode, err.message);
  }

  // Zod
  if (err instanceof ZodError) {
    return appErrors.validation(err);
  }

  // MySQL / XDevApiError
  if (err?.sqlState || err?.code) {
    return appErrors.mysql(err);
  }

  return appErrors.server(500, err?.message ?? 'Unknown error');
};
