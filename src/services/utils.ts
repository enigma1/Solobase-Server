export const isObjectEmpty = (obj: unknown): boolean =>
  obj !== null && typeof obj === 'object' && Object.keys(obj).length === 0;

export const isObjectWithStringProperty = <K extends string>(
  obj: unknown,
  key: K,
): obj is Record<K, string> => {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false;
  }
  return typeof (obj as Record<K, unknown>)[key] === 'string';
};

export const hasObjectProps = (
  obj: unknown,
  props: string[] | (string | string[])[],
): obj is Record<string, unknown> => {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false;
  }

  let current: unknown = obj;

  for (const prop of props) {
    if (typeof prop === 'string') {
      if (
        typeof current !== 'object' ||
        current === null ||
        !(prop in current)
      ) {
        return false;
      }

      current = (current as Record<string, unknown>)[prop];
    } else {
      if (!hasObjectProps(current, prop)) return false;
      current = current[prop[0]];
    }
  }

  return true;
};

export const sanitizeDbString = (str: unknown) => {};

export const sanitize = (input: unknown): string | null => {
  if (typeof input !== 'string') return null;
  return input.replace(/[^a-z0-9\.,_-]/gim, '').trim();
};

export const getSqlString = (input: string): string =>
  `\`${input.replace(/`/g, '``')}\``;

export const getEscapedValue = (v: unknown): string => {
  if (v === null || v === undefined) return 'NULL';

  if (typeof v === 'number') {
    return String(v);
  }

  if (typeof v === 'boolean') {
    return v ? '1' : '0';
  }

  return `'${String(v)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')}'`;
};

export const getIntegers = (input: unknown[], defaults: number[]): number[] => {
  const result = input.map((value, idx) => {
    const num = Number(value);
    return Number.isFinite(num) && Number.isInteger(num) ? num : defaults[idx];
  });
  return result;
};

export const indexBy = <T, K extends keyof T>(
  arr: T[],
  key: K,
): Record<string, T> => {
  const result: Record<string, T> = {};

  for (const item of arr) {
    const value = item[key];
    if (value != null) {
      result[String(value)] = item;
    }
  }

  return result;
};

export const makeUniqueObject = <V>(
  keys: readonly string[],
  values: readonly V[][],
  uniqueIndex: number,
): Record<string, Record<string, V>> => {
  if (!values.length || !keys.length || uniqueIndex >= values[0].length) {
    console.warn('Invalid input');
    return {};
  }

  const result: Record<string, Record<string, V>> = {};

  for (const row of values) {
    const uniqueKey = row[uniqueIndex];

    if (uniqueKey == null) continue;

    const obj: Record<string, V> = {};

    for (let i = 0; i < keys.length; i++) {
      obj[keys[i]] = row[i];
    }
    result[String(uniqueKey)] = obj;
  }

  return result;
};

export const getCurrentTimestamp = (units?: 'secs' | 'hours' | 'days') => {
  const ts = Date.now();
  switch (units) {
    case 'secs':
      return ts / 1000;
    case 'hours':
      return ts / (1000 * 3600);
    case 'days':
      return ts / (1000 * 86400);
    default:
      return ts;
  }
};

export const unknownToSql = (v: unknown): string => {
  if (v === null || v === undefined) {
    return 'NULL';
  }

  if (typeof v === 'boolean') {
    return v ? '1' : '0';
  }

  if (typeof v === 'number' || typeof v === 'bigint') {
    return String(v);
  }

  if (v instanceof Date) {
    return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
  }

  if (Buffer.isBuffer(v)) {
    return `X'${v.toString('hex')}'`;
  }

  if (typeof v === 'object') {
    return `'${getEscapedValue(JSON.stringify(v))}'`;
  }

  return `'${getEscapedValue(String(v))}'`;
};
