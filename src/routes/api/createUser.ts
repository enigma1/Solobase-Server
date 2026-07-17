import { escape, ResultSetHeader } from 'mysql2';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  apiCallAuth,
  UserProfileSchema,
  profileGrants,
  emptyToUndefined,
} from '>/services';
import type { CreateUserResponse, CreateUserRequest } from '>/types';

const CreateUserSchema = z.object({
  user: z.string().trim().min(2).max(64),
  host: z.string().trim().min(1).max(256),
  password: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(256).optional(),
  ),
  profile: z.preprocess(emptyToUndefined, UserProfileSchema),
});

export const createUser = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<CreateUserResponse> => {
      const request = CreateUserSchema.parse(req.body);
      const { user, host, password, profile } = request;

      // Create User
      const account = `${escape(user)}@${escape(host)}`;
      const dbQuery = password
        ? `CREATE USER ${account} IDENTIFIED BY ?`
        : `CREATE USER ${account}`;

      await sessionData.sqlSession.query<ResultSetHeader>(
        dbQuery,
        password ? [password] : undefined,
      );

      // Grant privileges
      const grants = profileGrants[profile];
      for (const grant of grants) {
        const sql = `GRANT ${grant} TO ${account}`;
        await sessionData.sqlSession.query<ResultSetHeader>(sql);
      }

      return {
        ok: true,
        message: `Account: ${account} created successfully`,
      };
    },
  });
