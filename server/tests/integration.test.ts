import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app';
import { GAME_LENGTH } from '../src/game-rules';

// This suite talks to a real PostgreSQL database. It uses TEST_DATABASE_URL rather
// than DATABASE_URL because it truncates every table between tests.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL is not set. Copy .env.example to .env first.');
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const yoga = createApp(prisma);

type GraphQLResponse = {
  data?: Record<string, any>;
  errors?: { message: string; extensions?: Record<string, any> }[];
};

async function gql(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string,
): Promise<GraphQLResponse> {
  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  return response.json() as Promise<GraphQLResponse>;
}

const REGISTER = /* GraphQL */ `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      user {
        id
        username
        email
      }
    }
  }
`;

const SUBMIT = /* GraphQL */ `
  mutation Submit($input: SubmitGameInput!) {
    submitGame(input: $input) {
      isPersonalBest
      previousBestMs
      game {
        id
        durationMs
        penaltyMs
        mistakes
      }
    }
  }
`;

async function registerPlayer(username: string) {
  const result = await gql(REGISTER, {
    input: { username, email: `${username}@example.com`, password: 'supersecret' },
  });
  expect(result.errors).toBeUndefined();
  return result.data!.register.token as string;
}

function round(durationMs: number, mistakes = 0) {
  return { durationMs, mistakes, charCount: GAME_LENGTH };
}

beforeAll(async () => {
  // Bring the test database up to the latest migration. Spawning bun itself keeps
  // this working regardless of what is on PATH.
  const migrate = Bun.spawn([process.execPath, 'x', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if ((await migrate.exited) !== 0) {
    const stderr = await new Response(migrate.stderr).text();
    const stdout = await new Response(migrate.stdout).text();
    throw new Error(`prisma migrate deploy failed on the test database:\n${stdout}\n${stderr}`);
  }
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "GameResult", "User" RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('registration and login', () => {
  test('registers a user, persists them, and returns a working token', async () => {
    const result = await gql(REGISTER, {
      input: { username: 'suyash', email: 'suyash@example.com', password: 'supersecret' },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data!.register.user.username).toBe('suyash');

    // The row really is in Postgres, and the password is not stored in the clear.
    const stored = await prisma.user.findUnique({ where: { username: 'suyash' } });
    expect(stored).not.toBeNull();
    expect(stored!.passwordHash).not.toBe('supersecret');

    const me = await gql('{ me { username email } }', {}, result.data!.register.token);
    expect(me.data!.me.username).toBe('suyash');
  });

  test('rejects a duplicate username with a CONFLICT error', async () => {
    await registerPlayer('suyash');

    const second = await gql(REGISTER, {
      input: { username: 'suyash', email: 'other@example.com', password: 'supersecret' },
    });

    expect(second.errors).toHaveLength(1);
    expect(second.errors![0].extensions?.code).toBe('CONFLICT');
    expect(second.errors![0].extensions?.field).toBe('username');
  });

  test('rejects invalid input before touching the database', async () => {
    const result = await gql(REGISTER, {
      input: { username: 'ab', email: 'suyash@example.com', password: 'supersecret' },
    });

    expect(result.errors![0].extensions?.code).toBe('BAD_USER_INPUT');
    expect(result.errors![0].extensions?.field).toBe('username');
    expect(await prisma.user.count()).toBe(0);
  });

  test('logs in with the right password and refuses the wrong one', async () => {
    await registerPlayer('suyash');

    const login = /* GraphQL */ `
      mutation Login($input: LoginInput!) {
        login(input: $input) {
          token
          user {
            username
          }
        }
      }
    `;

    const good = await gql(login, { input: { username: 'suyash', password: 'supersecret' } });
    expect(good.data!.login.user.username).toBe('suyash');

    const bad = await gql(login, { input: { username: 'suyash', password: 'wrongpassword' } });
    expect(bad.errors![0].message).toBe('Username or password is incorrect.');
  });

  test('me is null without a token', async () => {
    const result = await gql('{ me { username } }');
    expect(result.errors).toBeUndefined();
    expect(result.data!.me).toBeNull();
  });
});

describe('submitting games', () => {
  test('saves a round and reports the first one as a personal best', async () => {
    const token = await registerPlayer('suyash');

    const result = await gql(SUBMIT, { input: round(9_500, 2) }, token);

    expect(result.errors).toBeUndefined();
    expect(result.data!.submitGame.isPersonalBest).toBe(true);
    expect(result.data!.submitGame.previousBestMs).toBeNull();
    // The server derives the penalty itself rather than trusting the client.
    expect(result.data!.submitGame.game.penaltyMs).toBe(1_000);

    expect(await prisma.gameResult.count()).toBe(1);
  });

  test('a faster round beats the previous best, a slower one does not', async () => {
    const token = await registerPlayer('suyash');

    await gql(SUBMIT, { input: round(9_000) }, token);

    const slower = await gql(SUBMIT, { input: round(11_000) }, token);
    expect(slower.data!.submitGame.isPersonalBest).toBe(false);
    expect(slower.data!.submitGame.previousBestMs).toBe(9_000);

    const faster = await gql(SUBMIT, { input: round(7_500) }, token);
    expect(faster.data!.submitGame.isPersonalBest).toBe(true);
    expect(faster.data!.submitGame.previousBestMs).toBe(9_000);

    const best = await gql('{ myBest { durationMs } }', {}, token);
    expect(best.data!.myBest.durationMs).toBe(7_500);
    expect(await prisma.gameResult.count()).toBe(3);
  });

  test('refuses an unauthenticated submission', async () => {
    const result = await gql(SUBMIT, { input: round(9_000) });

    expect(result.errors![0].extensions?.code).toBe('UNAUTHENTICATED');
    expect(await prisma.gameResult.count()).toBe(0);
  });

  test('refuses an impossible time', async () => {
    const token = await registerPlayer('suyash');

    const result = await gql(SUBMIT, { input: round(5) }, token);

    expect(result.errors![0].extensions?.code).toBe('BAD_USER_INPUT');
    expect(await prisma.gameResult.count()).toBe(0);
  });

  test('refuses a round that is not 20 characters', async () => {
    const token = await registerPlayer('suyash');

    const result = await gql(SUBMIT, { input: { durationMs: 9_000, mistakes: 0, charCount: 3 } }, token);

    expect(result.errors![0].extensions?.code).toBe('BAD_USER_INPUT');
    expect(await prisma.gameResult.count()).toBe(0);
  });
});

describe('leaderboard', () => {
  test('ranks players by their own fastest round', async () => {
    const suyash = await registerPlayer('suyash');
    const priya = await registerPlayer('priya');
    const dev = await registerPlayer('dev');

    // suyash has a bad round and then a great one - only the great one should count.
    await gql(SUBMIT, { input: round(15_000) }, suyash);
    await gql(SUBMIT, { input: round(6_000) }, suyash);
    await gql(SUBMIT, { input: round(8_000) }, priya);
    await gql(SUBMIT, { input: round(12_000) }, dev);

    const result = await gql('{ leaderboard { rank username bestDurationMs gamesPlayed } }');
    const board = result.data!.leaderboard;

    expect(board.map((row: any) => row.username)).toEqual(['suyash', 'priya', 'dev']);
    expect(board.map((row: any) => row.rank)).toEqual([1, 2, 3]);
    expect(board[0].bestDurationMs).toBe(6_000);
    expect(board[0].gamesPlayed).toBe(2);
  });

  test('respects the limit and is readable without signing in', async () => {
    const suyash = await registerPlayer('suyash');
    const priya = await registerPlayer('priya');
    await gql(SUBMIT, { input: round(6_000) }, suyash);
    await gql(SUBMIT, { input: round(8_000) }, priya);

    const result = await gql('query Board($limit: Int) { leaderboard(limit: $limit) { username } }', {
      limit: 1,
    });

    expect(result.errors).toBeUndefined();
    expect(result.data!.leaderboard).toHaveLength(1);
    expect(result.data!.leaderboard[0].username).toBe('suyash');
  });

  test('is empty before anyone has played', async () => {
    const result = await gql('{ leaderboard { username } }');
    expect(result.data!.leaderboard).toEqual([]);
  });
});
