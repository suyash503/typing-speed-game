import { createApp } from './app';
import { config } from './config';
import { prisma } from './db';

const yoga = createApp(prisma);

const server = Bun.serve({
  port: config.port,
  fetch: yoga,
});

console.log(`GraphQL ready at http://localhost:${server.port}/graphql`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
