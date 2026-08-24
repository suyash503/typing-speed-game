# Walkthrough notes

Rough running order for the video, with the reasoning behind each piece so I can answer
follow-ups rather than just narrate the file tree.

## 1. Demo first (~2 min)

- Register an account, get dropped into the game.
- Press Start: timer begins at 0, one letter at a time, progress reads `n / 20`.
- Deliberately hit a wrong key - the letter shakes, mistake count goes up, and the clock
  jumps by half a second.
- Click outside the card mid-round to show focus snapping back.
- Finish the round: first round is always Success (no previous best). Play a slower second
  round to show Try again, then a faster one to show Success again.
- Leaderboard updates underneath.

## 2. Shape of the repo (~1 min)

`server/` is Bun + GraphQL Yoga + Prisma, `web/` is Vite + React, `docker-compose.yml`
brings up Postgres and the API together. No monorepo tooling - two folders and two
`bun install`s was enough.

## 3. Backend (~3 min)

**Schema.** Two tables. `GameResult.durationMs` already includes the penalty time, which is
the one modelling decision worth defending: it means the score is a single sortable column,
so the leaderboard doesn't have to compute anything at read time. The raw `penaltyMs` and
`mistakes` are stored alongside so the UI can still break a result down.

**Auth.** `Bun.password.hash` is argon2id out of the box - no bcrypt dependency. JWTs are
signed with `jose`, seven day expiry. `buildContext` pulls the Bearer token off the request
and resolves it to a user id; anything malformed or expired just means "not signed in"
rather than an error. `requireUserId` is what the protected resolvers call.

**Validation and errors.** zod schemas in `validation.ts`, and `parseOrThrow` turns the
first zod issue into a `GraphQLError` carrying `code: BAD_USER_INPUT` and the field name -
which is what lets the frontend show a useful message. Unique constraint violations from
Prisma (`P2002`) become `CONFLICT` with the field that clashed. Login failures return the
same message whether the username exists or not, so the endpoint can't be used to
enumerate accounts.

**Scoring.** `game-rules.ts` holds the constants and `checkSubmission`. The server
recomputes the penalty from the mistake count rather than storing what the client sent, and
rejects impossible times. Be honest in the video that this is a sanity check, not real
anti-cheat - the proper fix is server-generated sequences.

**Leaderboard.** `groupBy` on `userId` with `_min: { durationMs }` ranks players by their
own best round, then one `findMany` attaches usernames.

## 4. Frontend (~2 min)

**Timer.** Recomputed every tick from `performance.now() - startedAt + mistakes * 500`,
never accumulated. If the tab gets throttled the number stays honest. The final score is
computed the same way at the moment the last correct key lands.

**Focus.** A visually hidden input owns the keystrokes. It cannot be `display: none`,
because you cannot focus a hidden element - it is positioned off to the side at zero
opacity instead. It refocuses on blur while a round is running, clicking the card refocuses
it, and a warning appears if focus is lost.

Worth mentioning if asked what went wrong along the way: the refocus was originally in a
`requestAnimationFrame`, which looked fine until I tested it in a window that wasn't
actively rendering. rAF is paused when a tab isn't compositing, so focus never came back.
A `setTimeout(..., 0)` does not depend on the compositor and still runs after the click
that stole focus, which is why the code uses it.

**Best score.** Kept in `localStorage` per the spec, but reconciled with the server's
`myBest` on load so a new browser doesn't reset your record. The Success / Try again
verdict uses the server's answer because the server knows the full history.

## 5. Tests (~1 min)

`bun test`. Unit tests cover scoring rules, hashing, tokens and validation. The integration
test runs against a real Postgres database - it shells out to `prisma migrate deploy`
against `TEST_DATABASE_URL`, truncates between cases, and sends real GraphQL documents
through the Yoga app. That is why `createApp` takes a `PrismaClient` argument: the test
hands it one pointed at the test database instead of the module singleton.

Worth showing the assertions that check the database directly - counting rows after a
rejected mutation to prove nothing was written.

## 6. Close (~1 min)

Mention the tradeoffs honestly: token in `localStorage` rather than an httpOnly cookie, no
rate limiting, no frontend tests, client-generated sequences. All listed at the bottom of
the README.
