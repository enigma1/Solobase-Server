import { server } from '>/server';
import { startJanitors } from '>/db';
import { getEnvKey } from '>/config';

const host = getEnvKey('BACKEND_HOST');
const port = Number(getEnvKey('BACKEND_PORT'));

const startServer = async () => {
  try {
    // Start garbage collector;
    startJanitors();
    // Start Fastify server
    await server.listen({ host, port });
    console.log(`Started server at https://${host}:${port}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Global error handlers
server.server.on('error', (error) => {
  console.error('Global Server error:', error);
});

server.setErrorHandler((error, req, reply) => {
  console.error('Critical Error Happened:', error);
  reply.status(500).send({ error: 'Internal Server Error' });
});

startServer();
