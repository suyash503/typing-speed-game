# Typing Speed Game

A typing speed test: you get 20 random letters one at a time, and the clock counts up from
zero. Every wrong key costs you half a second. Finish all 20 and your time is saved, ranked
against everyone else, and compared with your own previous best.

- **Frontend** - Vite, React, TypeScript, plain CSS
- **Backend** - Bun, TypeScript, GraphQL Yoga, Prisma, PostgreSQL
- **Infra** - Docker Compose

## Running it

### With Docker (easiest)

```bash
docker compose up --build
```

That starts Postgres, applies the migrations and serves GraphQL on
`http://localhost:4000/graphql`. Then start the frontend separately:

```bash
cd web && bun install && bun run dev
```

The app is on `http://localhost:5173`.

> If you already run Postgres locally, port 5432 will be taken. Either stop your local
> instance or change the host port in `docker-compose.yml`.

### Without Docker

You need [Bun](https://bun.sh) and a PostgreSQL server.

```bash
createdb typing_speed
createdb typing_speed_test

cd server
cp .env.example .env      # edit DATABASE_URL if your setup differs
bun install
bunx prisma migrate deploy
bun run dev
```

```bash
cd web
bun install
bun run dev
```

## Tests

```bash
cd server && bun test
```

The unit tests cover the scoring rules, password hashing, tokens and input validation.
`tests/integration.test.ts` runs against a **real PostgreSQL database** - it applies the
migrations to `TEST_DATABASE_URL`, truncates between cases, and drives real GraphQL
documents through the server: registration, login, submitting rounds, personal bests,
leaderboard ranking, and the error cases. It needs `typing_speed_test` to exist.

## How the game works

The timer starts at 0 when you press Start. Display time is always recalculated from the
start timestamp plus `mistakes x 500ms`, never accumulated tick by tick, so a backgrounded
tab does not drift. Wrong keys add the penalty and shake the letter; correct keys advance.
Modifier keys and anything that isn't a single printable character are ignored.

The final score is one number: wall-clock time with the penalties folded in. Lower wins.
That is what gets stored, and it is why the leaderboard can sort on a single column.

Keyboard focus is held by a visually hidden input that refocuses itself on blur. Clicking
anywhere on the game card also returns focus, and a warning shows if focus is ever lost.

Your best score is kept in `localStorage` as the spec asks. On load the app also asks the
server for your best and takes whichever is lower, so switching browsers doesn't lose your
record. The Success / Try again verdict comes from the server's answer, since the server is
the one that actually knows your history.

## API

```graphql
type Query {
  me: User
  myBest: GameResult
  myGames(limit: Int = 10): [GameResult!]!
  leaderboard(limit: Int = 10): [LeaderboardEntry!]!
}

type Mutation {
  register(input: RegisterInput!): AuthPayload!
  login(input: LoginInput!): AuthPayload!
  submitGame(input: SubmitGameInput!): SubmitGameResult!
}
```

GraphiQL is available at `http://localhost:4000/graphql` in development.

Errors carry a machine-readable code in `extensions`, and input errors also name the field
that failed:

```json
{
  "message": "Username must be at least 3 characters.",
  "extensions": { "code": "BAD_USER_INPUT", "field": "username" }
}
```

The codes used are `BAD_USER_INPUT`, `UNAUTHENTICATED` and `CONFLICT`. Anything unexpected
is masked by Yoga rather than leaking a stack trace.

## Some decisions worth explaining

**Passwords use `Bun.password`**, which is argon2id by default. Bun ships it, so there was
no reason to add bcrypt as a dependency.

**Auth is a JWT in `localStorage`, sent as a Bearer header.** An httpOnly cookie would be
the better answer for a real product because it is not reachable from JavaScript, but it
brings CSRF protection and cookie/CORS setup along with it. For a take-home with a separate
frontend origin I took the simpler route deliberately, not by accident.

**The server does not trust the submitted score.** It recomputes the penalty from the
mistake count, insists a round is exactly 20 characters, and rejects times that are
physically impossible or absurdly long. It is a sanity check, not real anti-cheat - a
determined user can still call the mutation directly with a believable time. Proper
protection would mean the server generating and holding the sequence, which felt like more
machinery than this brief wanted.

**The leaderboard ranks players, not rounds.** A `groupBy` collapses each player to their
fastest result and a second query attaches usernames - two simple queries instead of one
clever one.

**No Apollo on the frontend.** The whole app makes about six requests, so a small `fetch`
wrapper does the job with less to explain.

## What I'd do with more time

- Move the token into an httpOnly cookie and add CSRF protection
- Rate limit login and registration - right now you can hammer them
- Have the server generate the letter sequence so scores can be properly verified
- Constant-time login: an unknown username returns faster than a known one with a bad
  password, which leaks whether an account exists
- Frontend tests (there are none) and an end-to-end test that actually plays a round
- Pagination on the leaderboard instead of a hard limit of 50
