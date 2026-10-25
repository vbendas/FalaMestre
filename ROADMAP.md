# Roadmap

Concrete next items for Fala Mestre!, drawn from the existing plans
([phase3-plan](docs/plans/phase3-plan.md), [ongoing-plan](docs/plans/ongoing-plan.md),
[PHASE2_MATCH_ENGINE](docs/PHASE2_MATCH_ENGINE.md), [VR_IMMERSIVE_PLAN](docs/plans/VR_IMMERSIVE_PLAN.md))
and from the current state of the code. Each item below was checked against the
code as of October 2026.

## How items are picked

Items that make the repository build, lint and test cleanly come first, because
everything else depends on a trustworthy CI run. After that, items are chosen
by how much they improve the core loop (talk to the assistant, manage the
squad, play a match) relative to their size. Each item should fit in one or a
few focused pull requests. LLM features use API calls to hosted models only;
there is no model training on this roadmap.

## Done

- **Get the unit tests green.** `npm run test:run` passes (573 tests across 11
  files). The decision-engine and game-engine failures are fixed. The body
  limit, logger and body-shape work above is covered by
  `src/app/api/__tests__/body-limit.test.ts` (270 tests, every body route
  against an oversized body, a body that only claims a huge length, a malformed
  body and `null`/array/number, plus request IDs on the logger-only handlers),
  `src/lib/__tests__/api-route.test.ts` (21), `request-body.test.ts` (28) and
  `logger.test.ts` (36).
- **Fix the typecheck error in the share card.** `html2canvas` is listed in
  `app/package.json` and `npx tsc --noEmit` is clean.
- **Fix the conditional React hooks in `SquadView`.** ESLint reports no
  `react-hooks/rules-of-hooks` errors; the lint step passes with warnings only.
- **Request size limits on every public API route.** `src/lib/request-body.ts`
  provides `readJsonBody()`, which caps a body at 64 KiB
  (`DEFAULT_MAX_BODY_BYTES`, overridable per route and per call) and answers an
  oversized one with 413 `Request body too large` before parsing. It checks
  `Content-Length` when present and counts bytes while reading, so a chunked
  body with no declared length is still bounded. All 21 handlers that read a
  body use it: the four wired first (`/api/conversation`, `/api/match`,
  `/api/match/decide`, `/api/match/stream`) call it directly, and the other 17
  go through the shared wrapper below. The two cron routes and `/api/predictions`
  never read a body and are unaffected.
- **Shared route wrapper.** `src/lib/api-route.ts` provides `withApiRoute()`,
  which wraps a handler and hands it an `ApiContext` with a logger already bound
  to the route name and request ID, and a `readJson()` that applies the size
  cap, the shape check and the standard replies. It is used by 25 exported
  handlers across 20 route files; 17 of those handlers read a body, the rest
  take only the logger. `readJson` is a context method rather than
  something the wrapper runs up front on purpose: routes differ in whether they
  check auth, a shared secret or the body first, and reading eagerly would move
  the size rejection ahead of the auth check on every route that authenticates
  first. Routes keep their own order by calling it where `request.json()` used
  to sit. `invalidJsonResponse` lets a route keep wording that differs from the
  default; only `/api/insights` needs it, for its `Invalid JSON`.
- **Structured logging with request IDs on every route.** `src/lib/logger.ts`
  provides `createRequestLogger()`, which writes one JSON object per line with
  time, level, route, request ID, message and extra fields, expands `Error`
  values into name/message/stack, and reuses a sanitised `x-request-id` header
  when one is present. No `console` call is left anywhere under
  `src/app/api`; the bracketed tags (`[Insights]`, `[Migrate]`, `[TransferBuy]`,
  `[Train]`) are gone, replaced by the `route` field. Levels and response bodies
  were kept as each route had them. The cron routes and the GET handlers take
  the logger even though they read no body. `/api/auth/[...nextauth]` is
  NextAuth's own handler and is left alone.
- **Non-object JSON bodies rejected on every body route.** A body that parses
  but is `null`, an array or a bare primitive used to reach the 500 handler on
  15 of the 21 body routes, and produced a misleading 403 or 404 on most of the
  rest; only the five schema-validated routes answered sensibly. `readJsonBody`
  now requires a plain object and answers anything else with 400
  `Request body must be a JSON object`, so the check covers every route that
  reads a body rather than `/api/match/stream` alone. The wording matches the
  sentence `/api/match/decide` already used in its own validation. All three
  rejections — too large, unparseable, not an object — are logged at warn as one
  JSON line carrying the route name and request ID.
- **Deterministic match mode.** A match is replayable end to end from a seed.
  `src/lib/rng.ts` holds the seeded source; `game-engine.ts`,
  `decision-engine.ts`, `match-segment-engine.ts`, `commentary.ts`,
  `matchScriptGenerator.ts` and the new `src/lib/match-setup.ts` (opponent
  morale, opponent choice, next fixture, the filler standings table) all draw
  from it. `/api/match`, `/api/match/decide` and `/api/match/stream` take an
  optional `seed`, validated by `seedSchema` in `src/lib/validations.ts` (a
  1-64 character token or a safe integer) and rejected with a 400 when
  malformed. Each route reports the seed it used — in the response body for the
  first two, on the existing `kickoff` event for the stream — so an unseeded
  match can be replayed afterwards. `callAIMock` takes the same seed, so the
  post-match narration replays with the match. Because `withSeed` is
  synchronous and cannot span an `await`, each handler keeps its random draws
  in a single synchronous seeded block between awaits rather than wrapping the
  handler. Event ids stay outside the seeded stream by design: an id is
  identity, not match content, so two replays agree on everything but their
  ids and timestamps. Covered by `src/app/api/__tests__/match-seed.test.ts`,
  `src/lib/__tests__/match-setup.test.ts` and
  `src/app/api/__tests__/match-seed-concurrency.test.ts`, which overlaps
  differently-seeded requests at the database and narrator awaits and checks
  each response still matches its solo run.

## Next items

1. **Move the library modules onto the structured logger.** The API routes are
   done, but `src/lib` and `src/db` still log with bare `console` calls that
   carry no request ID: `game-engine.ts` writes three `[DEBUG]` lines on every
   simulated match, and `match-formations.ts`, `memory-manager.ts`,
   `ai-service.ts` and `db/index.ts` log at various levels. These run inside
   request handlers but cannot reach the request logger, so their lines cannot
   be correlated with the request that caused them. Either thread a logger
   through or give these modules a module-scoped one, and drop the `[DEBUG]`
   lines from the match hot path.

2. **Validate request bodies by schema on the routes that still hand-roll it.**
   The shared reader now guarantees a body is a plain object within the size
   cap, but what happens after that varies: five routes use Zod
   (`/api/conversation`, `/api/match`, `/api/onboarding/create-team`,
   `/api/insights`, and `seedSchema` on the stream), `/api/match/decide` has a
   100-line hand-written validator, and the rest read fields straight off the
   body with a cast. That is why a missing `userId` surfaces as 403 Forbidden on
   the transfer and upgrade routes and 404 User not found on `/api/youth`
   instead of a 400 naming the field. Give each route a schema and a consistent
   validation reply.

3. **Track Drizzle migrations in the repository.** The schema is applied with
   `drizzle-kit push` and no `app/drizzle/` directory is committed. Generate a
   baseline migration and switch the documented setup to `db:generate` +
   `db:migrate`, so schema changes can be reviewed.

4. **Shared rate limiting.** `src/lib/rate-limit.ts` keeps counters in an
   in-memory `Map`, so limits reset on every cold start and are not shared
   between serverless instances. Move the counters to Postgres or another
   shared store.

5. **Server-backed asynchronous PvP challenges.**
   `docs/PHASE2_MATCH_ENGINE.md` describes a PvP async mode built on
   `runMatchSegment()`, but friend challenges in
   `src/contexts/FriendsContext.tsx` are simulated locally and stored in
   `localStorage`. Persist challenges and turns in the database and resolve
   them with the segment engine.

6. **Bring back the 3D match view.** The Three.js match view
   (`src/components/vr/*`, `/test-vr` page) was removed in commit `b788a9c`,
   but `app/tests/vr.spec.ts` still targets `/test-vr`. Restore a trimmed
   version of the view from history behind a feature flag (see
   VR_IMMERSIVE_PLAN), or delete the stale spec if the view is dropped.

7. **End-to-end tests for the core flow.** There is no `playwright.config.ts`
   and the browser checks in `scripts/` are ad-hoc scripts. Add a Playwright
   config and specs for login (with `AUTH_DISABLED=true`), onboarding, one
   chat turn and one match, running against the LLM mock mode.

8. **Playable without a hosted database.** Without `DATABASE_URL`,
   `src/db/index.ts` returns a no-op mock whose reads always return nothing,
   so a new player never gets past onboarding. Replace it with a working
   local store (for example an embedded Postgres such as PGlite behind the
   same Drizzle schema) so the game can be tried with zero setup.
