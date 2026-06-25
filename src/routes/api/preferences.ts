import { ExprOrLiteral } from '@mysql/xdevapi';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { apiCallAuth, withAppSession } from '>/services';
import { dbSession } from '>/db';
import type { PrimeObject, BasicResponse, ApiResponse } from '>/types';

export const savePreferences = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<void> => {
      const { preferences } = req.body as { preferences: PrimeObject };

      // 1. update session
      sessionData!.preferences = preferences;
      dbSession.set(sessionData!.sessionId, sessionData!);

      // 2. persist to DB
      const info = await withAppSession(async (session) => {
        const collection = session
          .getSchema('db_manager')
          .getCollection('preferences');
        // collection.replaceOne(sessionData!.username, { preferences });
        await collection
          .modify('_id = :id')
          // .set('preferences', JSON.parse(JSON.stringify(preferences)))
          .set('preferences', structuredClone(preferences) as ExprOrLiteral)
          .bind('id', sessionData!.username)
          .execute();
      });
      return info;
    },
  });

export const loadPreferences = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<{ preferences: PrimeObject }> => {
      return { preferences: sessionData!.preferences || {} };
    },
  });
