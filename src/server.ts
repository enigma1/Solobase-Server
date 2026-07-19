import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifySensible from '@fastify/sensible';
import { fastifyConfig, getEnvKey } from '>/config';
import { routes } from '>/routes/routes';

const reflectOrigin = getEnvKey('REFLECT_ORIGIN') === '1';

// Show NodeJS unexpected errors
process.on('uncaughtException', (err) => {
  console.error('uncaughtException-------------->', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection------------>', reason);
});

export const server = Fastify(fastifyConfig);

await server.register(fastifyCors, {
  origin: reflectOrigin
    ? (origin, cb) => {
        cb(null, origin ?? false);
      }
    : getEnvKey('FRONTEND_ORIGIN'),
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Solobase-SPA-Version'], // include Content-Type
  exposedHeaders: ['Set-Cookie', 'Content-Disposition'],
  methods: ['GET', 'POST', 'OPTIONS'], // allow all used methods
});
await server.register(fastifySensible);
await server.register(cookie, {
  secret: 'secret hash key', // used to sign cookies
  parseOptions: { httpOnly: true }, // optional, e.g., { httpOnly: true }
});

await server.register(routes);

server.addHook('onRequest', (req, rsp, done) => {
  console.log('Cookies received:', req.cookies);
  done();
});
