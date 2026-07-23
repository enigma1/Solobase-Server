import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { FastifyRequest } from 'fastify';

export const routeToName = (route: string) =>
  route.replace(/^\/+/, '').replace(/\//g, '_');

export const routeToFile = (req: FastifyRequest, rsp: unknown) => {
  const routeName = routeToName(req.originalUrl);

  if (rsp === undefined || rsp === null) {
    return {
      path: routeName,
      file: null,
    };
  }

  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify(rsp))
    .digest('hex');

  return {
    path: routeName,
    file: hash,
  };
};

type SaveMockResponse = {
  req: FastifyRequest;
  rsp: unknown;
  outputDir: string;
};
export const saveMockResponse = async ({
  req,
  rsp,
  outputDir,
}: SaveMockResponse) => {
  const parts = routeToFile(req, rsp);
  if (!parts.file) return;

  const dir = path.join(outputDir, parts.path);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(
    path.join(dir, `${parts.file}.json`),
    JSON.stringify(rsp, null, 2),
    'utf8',
  );
};
