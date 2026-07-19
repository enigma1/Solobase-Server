import { escape, ResultSetHeader } from 'mysql2/promise';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { apiCallAuth, profileGrants } from '>/services';
import { UserProfileSchema, emptyToUndefined } from '>/contracts';
import type { EditUserRequest, EditUserResponse } from '>/types';

const EditUserSchema = z.object({
  orgUser: z.string().trim().min(2).max(64),
  orgHost: z.string().trim().min(1).max(256),
  user: z.string().trim().min(2).max(64),
  host: z.string().trim().min(1).max(256),
  password: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(256).optional(),
  ),
  profile: z.preprocess(emptyToUndefined, UserProfileSchema.optional()),
  passwordChange: z.boolean().optional(),
});

export const editUser = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<EditUserResponse> => {
      const request = EditUserSchema.parse(req.body);
      const {
        user,
        host,
        orgUser,
        orgHost,
        password,
        passwordChange,
        profile,
      } = request;

      // Get User
      const account = `${escape(user)}@${escape(host)}`;
      const oldAccount = `${escape(orgUser)}@${escape(orgHost)}`;
      let dbQuery;

      if (orgUser !== user || orgHost !== host) {
        dbQuery = `RENAME USER ${oldAccount} TO ${account}`;
        await sessionData.sqlSession.query<ResultSetHeader>(dbQuery);
      }

      if (passwordChange) {
        const sql = `ALTER USER ${account} IDENTIFIED BY ?`;
        await sessionData.sqlSession.query(sql, [password ?? '']);
      }

      if (profile) {
        dbQuery = `REVOKE ALL PRIVILEGES, GRANT OPTION FROM ${account}`;
        await sessionData.sqlSession.query<ResultSetHeader>(dbQuery);
        for (const grant of profileGrants[profile]) {
          dbQuery = `GRANT ${grant} TO ${account}`;
          await sessionData.sqlSession.query<ResultSetHeader>(dbQuery);
        }
      }

      return {
        ok: true,
        message: `Account: ${account} updated successfully`,
      };
    },
  });
