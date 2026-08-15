import { AsyncLocalStorage } from 'node:async_hooks';
import type { SessionData } from '>/types';
import { appErrors } from './errorLayer';

export const requestContext = new AsyncLocalStorage<SessionData>();

export const getSessionData = (): SessionData => {
  const sessionData = requestContext.getStore();

  if (!sessionData) {
    throw appErrors.domain(
      'invalid_session_data',
      'SessionData is not available in the current request',
    );
  }
  return sessionData;
};
