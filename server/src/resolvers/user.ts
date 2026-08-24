import { Prisma, type User } from '@prisma/client';
import type { Context } from '../context';
import { hashPassword, signToken, verifyPassword } from '../auth';
import { badInput, conflict } from '../errors';
import { loginInput, parseOrThrow, registerInput } from '../validation';

export const userResolvers = {
  Query: {
    me(_parent: unknown, _args: unknown, ctx: Context) {
      if (!ctx.userId) return null;
      return ctx.prisma.user.findUnique({ where: { id: ctx.userId } });
    },
  },

  Mutation: {
    async register(_parent: unknown, args: { input: unknown }, ctx: Context) {
      const input = parseOrThrow(registerInput, args.input);

      let user: User;
      try {
        user = await ctx.prisma.user.create({
          data: {
            username: input.username,
            email: input.email,
            passwordHash: await hashPassword(input.password),
          },
        });
      } catch (err) {
        // P2002 is the unique constraint violation. meta.target tells us which one.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const target = (err.meta?.target as string[] | undefined) ?? [];
          const field = target.includes('email') ? 'email' : 'username';
          throw conflict(`That ${field} is already registered.`, field);
        }
        throw err;
      }

      return { token: await signToken(user.id), user };
    },

    async login(_parent: unknown, args: { input: unknown }, ctx: Context) {
      const input = parseOrThrow(loginInput, args.input);

      const user = await ctx.prisma.user.findUnique({ where: { username: input.username } });
      // Same message either way so this can't be used to enumerate usernames.
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        throw badInput('Username or password is incorrect.');
      }

      return { token: await signToken(user.id), user };
    },
  },

  User: {
    createdAt: (user: User) => user.createdAt.toISOString(),
  },
};
