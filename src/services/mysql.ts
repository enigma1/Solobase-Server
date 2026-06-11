import { type RowDataPacket } from 'mysql2';
import type { Connection } from 'mysql2/promise';
import { CharsetMeta, MySqlCaps, SessionData } from '>/types';

export const getMysqlCapabilities = async (
  sqlSession: Connection,
): Promise<MySqlCaps> => {
  const [charsets] =
    await sqlSession.query<RowDataPacket[]>(`SHOW CHARACTER SET`);
  const [collations] =
    await sqlSession.query<RowDataPacket[]>(`SHOW COLLATION`);
  const [engines] = await sqlSession.query<RowDataPacket[]>(`SHOW ENGINES`);

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
