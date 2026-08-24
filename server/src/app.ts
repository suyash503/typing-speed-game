import { createYoga } from 'graphql-yoga';
import type { PrismaClient } from '@prisma/client';
import { buildContext } from './context';
import { schema } from './schema';
import { config } from './config';

// Takes the client as an argument so the integration test can hand in one pointed
// at the test database instead of reaching for a module-level singleton.
export function createApp(prisma: PrismaClient) {
  return createYoga({
    schema,
    context: ({ request }) => buildContext(request, prisma),
    cors: {
      origin: config.corsOrigin,
      credentials: true,
    },
    graphiql: process.env.NODE_ENV !== 'production',
  });
}
