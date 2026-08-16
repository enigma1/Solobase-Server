import { mkdir } from 'node:fs/promises';
import { server } from '>/server';
import { startPeriodicProcesses } from '>/db';
import { getEnvKey } from '>/config';

const host = getEnvKey('BACKEND_HOST');
const port = Number(getEnvKey('BACKEND_PORT'));
const prefsDir = getEnvKey('PREFERENCES_DIR') ?? 'prefs';

const startServer = async () => {
  try {
    // Start garbage collector;
    startPeriodicProcesses();
    // Start Fastify server
    await mkdir(prefsDir, { recursive: true });
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
