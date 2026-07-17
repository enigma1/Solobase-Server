import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodError, treeifyError } from 'zod';
import { CookieSerializeOptions } from '@fastify/cookie';
import { hasObjectProps, errorResolver } from '>/services';
import { dbSession, sessionStore } from '>/db';
import { getEnvKey, envConfig } from '>/config';
import { ApiResponse, SessionData } from '>/types';
import { getCurrentTimestamp, appErrors } from '>/services';

const useSsl = getEnvKey('SSL_ENABLED') === '1';
const useCookieDomain = getEnvKey('COOKIE_USE_DOMAIN') === '1';

export const processOrThrowSession = (req: FastifyRequest): SessionData => {
  const sessionId = req.cookies?.sessionId;

  if (!sessionId) {
    throw appErrors.authMissing();
  }
  return dbSession.get(sessionId);
};

export const getCookieOptions = (maxAge: number): CookieSerializeOptions => {
  const cookieParams = {
    httpOnly: true,
    path: '/',
    maxAge: maxAge / 1000,
    ...(useCookieDomain ? { domain: getEnvKey('FRONTEND_HOST') } : {}),
  };
  if (useSsl) {
    return {
      ...cookieParams,
      sameSite: 'none',
      secure: true,
    };
  } else {
    return {
      ...cookieParams,
      sameSite: 'lax',
    };
  }
};

type HandleApiFnArgs = {
  req: FastifyRequest;
  rsp: FastifyReply;
  mode?: 'json' | 'stream';
};
const handleApiFn = async <T>(
  fn: () => Promise<T>,
  { req, rsp, mode = 'json' }: HandleApiFnArgs,
): Promise<T | undefined> => {
  try {
    const sessionId = req.cookies?.sessionId;
    const sessionData = sessionId ? sessionStore.get(sessionId) : undefined;
    if (sessionData?.queries) {
      sessionData.queries.length = 0;
    }

    const result = await fn();
    if (mode === 'stream') return;

    return {
      ...result,
      route: req.url,
      queries: sessionData?.queries ?? [],
    };
  } catch (e: unknown) {
    const error = errorResolver(e);
    let result;

    switch (error?.type) {
      case 'auth': {
        const sessionId = req?.cookies?.sessionId;

        if (sessionId) {
          await dbSession.remove(sessionId);
        }

        rsp.setCookie('sessionId', '', getCookieOptions(0));
        result = rsp.status(401).send({
          error:
            error.kind === 'missing' ? 'Login required' : 'Invalid session',
          code: 401,
          message:
            error.kind === 'missing'
              ? 'You must first login'
              : 'Your session has expired',
        });
        break;
      }
      case 'domain':
        result = rsp.status(422).send({
          error: 'Request Failed',
          code: 422,
          message: error.message,
        });
        break;

      case 'validation':
        result = rsp.status(400).send({
          error: 'Invalid request',
          code: 400,
          message: 'Validation failed - see details',
          details: error.error.issues.map((issue) => issue.message),
        });
        break;

      case 'mysql':
        result = rsp.status(400).send({
          error: `${error.error.sqlState}: ${error.error.sqlMessage}`,
          code: error.error.code,
          message: `${error.error.code}: ${error.error.sql}`,
        });
        break;

      case 'server':
        result = rsp.status(error.code).send({
          error: error.message,
          code: error.code,
          message: 'Details are not available',
        });
        break;

      default:
        result = rsp.status(500).send({
          error: 'Unknown Server Error',
          code: 500,
          message: 'An unexpected error occurred',
        });
        break;
    }
    return;
  }
};

type ApiCallCommonProps = {
  req: FastifyRequest;
  rsp: FastifyReply;
};

type ApiCallAuthProps<T> = ApiCallCommonProps & {
  fn: (sessionData: SessionData) => Promise<ApiResponse<T> | T>;
};
// Use with routes the return JSON for logged-in users
export const apiCallAuth = async <T>({ req, rsp, fn }: ApiCallAuthProps<T>) =>
  handleApiFn(
    async () => {
      const sessionData = processOrThrowSession(req);
      sessionData.lastSqlActivity = getCurrentTimestamp();
      rsp.setCookie(
        'sessionId',
        sessionData.sessionId,
        getCookieOptions(envConfig.cookieTimeout),
      );

      const res = await fn(sessionData);
      if (!hasObjectProps(res, ['data'])) return res;

      if (res.effects?.headers) {
        for (const [key, value] of Object.entries(res.effects.headers)) {
          rsp.header(key, value);
        }
      }
      // optional status override
      if (res.effects?.status) {
        rsp.status(res.effects.status);
      }
      return res.data;
    },
    { req, rsp },
  );

type ApiCallUnknownProps<T> = ApiCallCommonProps & {
  fn: () => Promise<ApiResponse<T>>;
};

export const apiCallUnknown = async <T>({
  req,
  rsp,
  fn,
}: ApiCallUnknownProps<T>) =>
  handleApiFn(
    async () => {
      const res = await fn();

      if (hasObjectProps(res, ['effects', ['sessionId']])) {
        const sessionId = res.effects?.sessionId;
        if (typeof sessionId === 'string' && sessionId.length > 20) {
          rsp.setCookie(
            'sessionId',
            sessionId,
            getCookieOptions(envConfig.cookieTimeout),
          );
        } else {
          rsp.clearCookie('sessionId');
        }
      }
      if (hasObjectProps(res, ['effects', ['headers']])) {
        const headers = res.effects?.headers as Record<string, string>;
        for (const [key, value] of Object.entries(headers)) {
          rsp.header(key, value);
        }
      }
      // optional status override
      if (hasObjectProps(res, ['effects', ['status']])) {
        const status = res.effects?.status as number;
        rsp.status(status);
      }

      if (hasObjectProps(res, ['data'])) {
        return res.data;
      } else {
        return {
          ok: false,
          message: 'request failed',
        };
      }
    },
    { req, rsp },
  );

type StreamResponse = {
  effects?: {
    headers?: Record<string, string>;
    status?: number;
  };
};

type ApiCallStreamProps = ApiCallCommonProps & {
  fn: (sessionData: SessionData) => Promise<StreamResponse | void>;
};
// Use with routes the return JSON for logged-in users
export const apiCallStream = async <T>({ req, rsp, fn }: ApiCallStreamProps) =>
  handleApiFn(
    async () => {
      const sessionData = processOrThrowSession(req);
      sessionData.lastSqlActivity = getCurrentTimestamp();
      rsp.setCookie(
        'sessionId',
        sessionData.sessionId,
        getCookieOptions(envConfig.cookieTimeout),
      );
      const res = await fn(sessionData);
    },
    { req, rsp, mode: 'stream' },
  );
