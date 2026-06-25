import { type RowDataPacket } from 'mysql2';
import type { Connection } from 'mysql2/promise';
import {
  CharsetMeta,
  MySqlCaps,
  SessionData,
  EngineRow,
  CharsetRow,
  CollationRow,
  UserProfile,
} from '>/types';

export const getMysqlCapabilities = async (
  sqlSession: Connection,
): Promise<MySqlCaps> => {
  const [charsets] = await sqlSession.query<CharsetRow[]>(`SHOW CHARACTER SET`);
  const [collations] = await sqlSession.query<CollationRow[]>(`SHOW COLLATION`);
  const [engines] = await sqlSession.query<EngineRow[]>(`SHOW ENGINES`);

  const supportedEngines = engines
    .filter((e) => e.Support === 'YES' || e.Support === 'DEFAULT')
    .map((e) => ({
      name: e.Engine,
      isDefault: e.Support === 'DEFAULT',
      transactions: e.Transactions === 'YES',
      xa: e.XA === 'YES',
      savepoints: e.Savepoints === 'YES',
    }));

  const charsetMap = Object.fromEntries(charsets.map((c) => [c.Charset, c]));
  const collationsByCharset = collations.reduce(
    (acc: Record<string, CharsetMeta>, c) => {
      if (!acc[c.Charset]) {
        const cSet = charsetMap[c.Charset];
        acc[c.Charset] = {
          defaultCollation: cSet['Default collation'],
          maxlen: cSet.Maxlen,
          collations: [],
        };
      }
      acc[c.Charset].collations.push(c.Collation);
      return acc;
    },
    {},
  );

  const [defaults] = await sqlSession.query<RowDataPacket[]>(
    `SELECT
      @@character_set_server AS charset,
      @@collation_server AS collation,
      @@default_storage_engine AS engine
    `,
  );

  const { charset, collation, engine } = defaults[0];

  return {
    collationsByCharset,
    engines: supportedEngines,
    defaults: {
      collation,
      charset,
      engine,
    },
  };
};

export const setGroupByMode = async (
  sqlSession: Connection,
  legacyMode: boolean,
) => {
  const [rows] = await sqlSession.query<
    (RowDataPacket & { sql_mode: string })[]
  >('SELECT @@SESSION.sql_mode AS sql_mode');

  const originalMode = rows?.[0]?.sql_mode ?? '';

  if (legacyMode) {
    await sqlSession.query(`
      SET SESSION sql_mode =
      REPLACE(@@SESSION.sql_mode, 'ONLY_FULL_GROUP_BY', '')
    `);
  } else {
    await sqlSession.query(`
      SET SESSION sql_mode =
      CONCAT(@@SESSION.sql_mode, ',ONLY_FULL_GROUP_BY')
    `);
  }

  return originalMode;
};

export const restoreGroupByMode = async (
  sqlSession: Connection,
  originalMode: string,
) => {
  await sqlSession.query('SET SESSION sql_mode = ?', [originalMode]);
};

export const getCharsets = (session: SessionData) =>
  Object.keys(session.collationsByCharset);

type GetCollationsProps = {
  session: SessionData;
  charset: string;
};
export const getCollations = ({ session, charset }: GetCollationsProps) =>
  session.collationsByCharset[charset]?.collations ?? [];

type EngineExistsProps = {
  session: SessionData;
  engine: string;
};
export const engineExists = ({ session, engine }: EngineExistsProps) =>
  session.engines.some((e) => e.name === engine);

type CharsetExistsProps = {
  session: SessionData;
  charset: string;
};
export const charsetExists = ({ session, charset }: CharsetExistsProps) =>
  charset in session.collationsByCharset;

type CollationExistsProps = {
  session: SessionData;
  charset: string;
  collation: string;
};
export const collationExists = ({
  session,
  charset,
  collation,
}: CollationExistsProps) =>
  session.collationsByCharset[charset]?.collations.includes(collation) ?? false;

export const profileGrants: Record<UserProfile, string[]> = {
  admin: ['ALL PRIVILEGES ON *.*'],

  editor: [
    'CREATE ON *.*',
    'ALTER ON *.*',
    'DROP ON *.*',
    'CREATE VIEW ON *.*',
  ],

  readOnly: ['SELECT ON *.*'],
};
