import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  apiCallAuth,
  getPreferencesFilename,
  getPreferencesPath,
  savePreferencesFile,
  loadPreferencesFile,
} from '>/services';
import { UserPrefsSchema } from '>/contracts';

import type {
  SavePreferencesResponse,
  SavePreferencesRequest,
  LoadPreferencesResponse,
  LoadPreferencesRequest,
  // UserPrefs,
} from '>/types';

const PreferencesSchema = z.object({
  version: z.number().int().positive(),
  userPrefs: UserPrefsSchema,
});
export const savePreferences = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<SavePreferencesResponse> => {
      const request = PreferencesSchema.parse(req.body);
      const { version, userPrefs } = request;
      sessionData.allowSystemDatabases =
        userPrefs.allowSystemDatabases ?? false;
      const path = getPreferencesPath(sessionData.username);
      await savePreferencesFile(path, {
        version,
        userPrefs,
      });

      return {
        ok: true,
        message: `Preferences: saved successfully`,
      };
    },
  });

export const loadPreferences = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<LoadPreferencesResponse> => {
      try {
        const path = getPreferencesPath(sessionData.username);
        const prefs = await loadPreferencesFile(path);
        const parsed = UserPrefsSchema.parse(prefs.userPrefs);
        sessionData.allowSystemDatabases = parsed.allowSystemDatabases ?? false;

        return {
          ok: true,
          message: `Preferences loaded successfully`,
          userPrefs: {
            ...parsed,
          },
        };
      } catch (e) {
        return {
          ok: false,
          message: `Invalid or corrupted preferences - save preferences again`,
        };
      }
    },
  });
