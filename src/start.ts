import { server } from '>/server';
import { envConfig } from '>/config';
import { sessionJanitor } from '>/db';
// import { appClient } from '>/db/appSession';
const { port, host } = envConfig;

async function startServer() {
  try {
    // Test app DB connection at startup
    // const session = await appClient.getSession();
    // console.log('App DB connected');
    // await session.close();

    // Start garbage collector;
    sessionJanitor();
    // Start Fastify server
    await server.listen({ port, host });
    console.log(`Started server at https://${host}:${port}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Global error handlers
server.server.on('error', (error) => {
  console.error('SERVERSERVER error:', error);
});

server.setErrorHandler((error, req, reply) => {
  console.error('Critical Error Happened:', error);
  reply.status(500).send({ error: 'Internal Server Error' });
});

startServer();
