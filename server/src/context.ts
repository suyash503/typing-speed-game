import type { PrismaClient } from '@prisma/client';
import { userIdFromToken } from './auth';
import { unauthenticated } from './errors';

export type Context = {
  prisma: PrismaClient;
  userId: string | null;
};

export async function buildContext(request: Request, prisma: PrismaClient): Promise<Context> {
  const header = request.headers.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return { prisma, userId: null };
  }

  return { prisma, userId: await userIdFromToken(token) };
}

export function requireUserId(ctx: Context): string {
  if (!ctx.userId) throw unauthenticated();
  return ctx.userId;
}
