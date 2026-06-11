import { RowDataPacket } from 'mysql2';
import { FastifyRequest, FastifyReply } from 'fastify';
import { apiCallAuth, getDatabaseServerDefaults } from '>/services/apiHelpers';
import type { FetchDatabaseInfoResponse, CharsetMeta } from '>/types';

export const fetchDatabaseInfo = async (
  req: FastifyRequest,
  rsp: FastifyReply,
) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<FetchDatabaseInfoResponse> => {
      // const [charsets] =
      //   await sessionData.sqlSession.query<RowDataPacket[]>(
      //     `SHOW CHARACTER SET`,
      //   );

      // const [collations] =
      //   await sessionData.sqlSession.query<RowDataPacket[]>(`SHOW COLLATION`);

      // const [engines] =
      //   await sessionData.sqlSession.query<RowDataPacket[]>(`SHOW ENGINES`);

      // const supportedEngines = engines
      //   .filter((e) => e.Support === 'YES' || e.Support === 'DEFAULT')
      //   .map((e) => ({
      //     name: e.Engine,
      //     isDefault: e.Support === 'DEFAULT',
      //     transactions: e.Transactions === 'YES',
      //     xa: e.XA === 'YES',
      //     savepoints: e.Savepoints === 'YES',
      //   }));

      // const charsetMap = Object.fromEntries(
      //   charsets.map((c) => [c.Charset, c]),
      // );
      // const collationsByCharset = collations.reduce(
      //   (acc: Record<string, CharsetMeta>, c) => {
      //     if (!acc[c.Charset]) {
      //       const cSet = charsetMap[c.Charset];
      //       acc[c.Charset] = {
      //         defaultCollation: cSet['Default collation'],
      //         maxlen: cSet.Maxlen,
      //         collations: [],
      //       };
      //     }
      //     acc[c.Charset].collations.push(c.Collation);
      //     return acc;
      //   },
      //   {},
      // );

      const { collation, charset, engine } =
        await getDatabaseServerDefaults(sessionData);

      return {
        collationsByCharset: sessionData.collationsByCharset,
        engines: sessionData.engines,
        defaults: sessionData.defaults,
      };
      // return {
      //   collationsByCharset,
      //   engines: supportedEngines,
      //   defaults: {
      //     charset,
      //     collation,
      //     engine,
      //   },
      // };
    },
  });
