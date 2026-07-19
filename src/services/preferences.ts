import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { rename, writeFile, readFile } from 'node:fs/promises';
import { getEnvKey } from '>/config';

export const getPreferencesFilename = (username: string) => {
  const encodingKey = getEnvKey('ENCODING_KEY');
  if (!encodingKey) {
    return `${username}.json`;
  }

  return (
    createHmac('sha256', encodingKey).update(username).digest('hex') + '.json'
  );
};

export const getPreferencesPath = (username: string) => {
  const dir = getEnvKey('PREFERENCES_DIR') ?? 'prefs';
  const filename = getPreferencesFilename(username);
  return join(dir, filename);
};

export const savePreferencesFile = async (filename: string, data: unknown) => {
  const temp = `${filename}.tmp`;
  await writeFile(temp, JSON.stringify(data, null, 2), 'utf8');
  await rename(temp, filename);
};

export const loadPreferencesFile = async (path: string) => {
  const text = await readFile(path, 'utf8');
  return JSON.parse(text);
};
