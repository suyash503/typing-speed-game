import type { GameResult } from '@prisma/client';
import type { Context } from '../context';
import { requireUserId } from '../context';
import { badInput } from '../errors';
import { checkSubmission, penaltyFor } from '../game-rules';
import { parseOrThrow, submitGameInput } from '../validation';

const MAX_PAGE = 50;

function clampLimit(limit: number | undefined) {
  return Math.min(Math.max(limit ?? 10, 1), MAX_PAGE);
}

export const gameResolvers = {
  Query: {
    myBest(_parent: unknown, _args: unknown, ctx: Context) {
      const userId = requireUserId(ctx);
      return ctx.prisma.gameResult.findFirst({
        where: { userId },
        orderBy: { durationMs: 'asc' },
      });
    },

    myGames(_parent: unknown, args: { limit?: number }, ctx: Context) {
      const userId = requireUserId(ctx);
      return ctx.prisma.gameResult.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: clampLimit(args.limit),
      });
    },

    // The board ranks players, not rounds, so this collapses every player down to
    // their fastest result first. groupBy gives us that in one query; a second
    // lookup attaches the usernames.
    async leaderboard(_parent: unknown, args: { limit?: number }, ctx: Context) {
      const take = clampLimit(args.limit);

      const best = await ctx.prisma.gameResult.groupBy({
        by: ['userId'],
        _min: { durationMs: true },
        _count: { _all: true },
        orderBy: { _min: { durationMs: 'asc' } },
        take,
      });

      const users = await ctx.prisma.user.findMany({
        where: { id: { in: best.map((row) => row.userId) } },
        select: { id: true, username: true },
      });
      const usernameById = new Map(users.map((u) => [u.id, u.username]));

      return best.map((row, index) => ({
        rank: index + 1,
        username: usernameById.get(row.userId) ?? 'unknown',
        bestDurationMs: row._min.durationMs ?? 0,
        gamesPlayed: row._count._all,
      }));
    },
  },

  Mutation: {
    async submitGame(_parent: unknown, args: { input: unknown }, ctx: Context) {
      const userId = requireUserId(ctx);
      const input = parseOrThrow(submitGameInput, args.input);

      const problem = checkSubmission(input);
      if (problem) throw badInput(problem);

      // Read the old best before inserting, otherwise the round we're about to
      // save would be part of the comparison and could never be a personal best.
      const previous = await ctx.prisma.gameResult.findFirst({
        where: { userId },
        orderBy: { durationMs: 'asc' },
        select: { durationMs: true },
      });

      const game = await ctx.prisma.gameResult.create({
        data: {
          userId,
          durationMs: input.durationMs,
          mistakes: input.mistakes,
          charCount: input.charCount,
          penaltyMs: penaltyFor(input.mistakes),
        },
      });

      const previousBestMs = previous?.durationMs ?? null;

      return {
        game,
        previousBestMs,
        isPersonalBest: previousBestMs === null || game.durationMs < previousBestMs,
      };
    },
  },

  GameResult: {
    createdAt: (game: GameResult) => game.createdAt.toISOString(),
  },
};
