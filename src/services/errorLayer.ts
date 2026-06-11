import { ZodError } from 'zod';

export type XDevApiError = {
  info: {
    severity?: number;
    code: number;
    sqlState: string;
    msg: string;
  };
};

export type AppError =
  | { type: 'auth'; kind: 'missing' | 'invalid' }
  | { type: 'mysql'; error: XDevApiError }
  | { type: 'validation'; error: ZodError }
  | { type: 'domain'; code: string; message: string }
  | { type: 'server'; code: number; message: string };

export const appErrors = {
  authMissing: () => ({
    type: 'auth',
    kind: 'missing',
  }),

  authInvalid: () => ({
    type: 'auth',
    kind: 'invalid',
  }),

  mysql: (error: XDevApiError) => ({
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
  mysql: (error: XDevApiError) => AppError;
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

// export const mySqlErrorProps = ['info', ['code', 'sqlState', 'msg']];
// export const serverErrorProps = ['code', 'status'];

// export type ErrorItem = Error & {
//   status: string;
//   code: number;
// };

// const sessionMissing = (): ErrorItem =>
//   Object.assign(new Error('Login required'), {
//     status: 'SESSION_MISSING',
//     code: 401,
//   });

// const invalidSession = (): ErrorItem =>
//   Object.assign(new Error('Invalid session'), {
//     status: 'SESSION_INVALID',
//     code: 401,
//   });

// export const errorLayer: Record<string, () => ErrorItem> = {
//   sessionMissing,
//   invalidSession,
// };

// export const isAuthError = (error: unknown): error is ErrorItem => {
//   if (!error || typeof error !== 'object') return false;
//   if (!('status' in error)) return false;
//   const status = (error as ErrorItem).status;
//   return status === 'SESSION_INVALID' || status === 'SESSION_MISSING';
// };
