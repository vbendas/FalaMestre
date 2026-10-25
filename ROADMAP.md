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

- **Get the unit tests green.** `npm run test:run` passes (289 tests across 10
  files). The decision-engine and game-engine failures are fixed.
- **Fix the typecheck error in the share card.** `html2canvas` is listed in
  `app/package.json` and `npx tsc --noEmit` is clean.
- **Fix the conditional React hooks in `SquadView`.** ESLint reports no
  `react-hooks/rules-of-hooks` errors; the lint step passes with warnings only.
- **Request size limits on public API routes.** `src/lib/request-body.ts`
  provides `readJsonBody()`, which caps a body at 64 KiB by default (overridable
  per route) and answers an oversized one with 413 before parsing. It checks
  `Content-Length` when present and counts bytes while reading, so a chunked
  body with no declared length is still bounded. Wired into `/api/conversation`,
  `/api/match`, `/api/match/decide` and `/api/match/stream`.
- **Structured logging with request IDs.** `src/lib/logger.ts` provides
  `createRequestLogger()`, which writes one JSON object per line with time,
  level, route, request ID, message and extra fields, expands `Error` values
  into name/message/stack, and reuses a sanitised `x-request-id` header when one
  is present. The conversation, match, decision and stream routes use it and
  have no `console` calls left.
- **Malformed JSON on the match stream route.** `/api/match/stream` now
  answers a body that is not valid JSON with a 400 and the message
  `Invalid JSON body` (it used to fall through to the 500 handler) and logs the
  rejection at warn level. Covered by tests in
  `src/app/api/__tests__/body-limit.test.ts`.
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

1. **Apply the body-size limit to the remaining public routes.** `readJsonBody`
   is wired into the four busiest routes. The other handlers that call
   `request.json()` directly — among them `/api/transfer/buy`,
   `/api/transfer/sell`, `/api/squad/train`, `/api/squad/migrate`,
   `/api/youth`, `/api/staff`, `/api/stadium/upgrade`, `/api/insights` — are
   still unbounded. Wire them up and consider a shared wrapper so a new route
   gets the limit by default.

2. **Move the remaining routes onto the structured logger.** The bracketed-tag
   `console` calls are gone from the four wired routes but remain in the other
   API handlers (`[Insights]`, `[Migrate]`, `[TransferBuy]`, `[Train]` and
   others). Convert them so every route line carries a request ID.

3. **Reject non-object JSON bodies on the match stream route.**
   `/api/match/stream` casts the parsed body to an object and reads `userId`
   from it, so a body that is valid JSON but not an object (for example `null`)
   still ends in the 500 handler instead of a 400. Add a shape check after
   `readJsonBody` and a test for it.

4. **Track Drizzle migrations in the repository.** The schema is applied with
   `drizzle-kit push` and no `app/drizzle/` directory is committed. Generate a
   baseline migration and switch the documented setup to `db:generate` +
   `db:migrate`, so schema changes can be reviewed.

5. **Shared rate limiting.** `src/lib/rate-limit.ts` keeps counters in an
   in-memory `Map`, so limits reset on every cold start and are not shared
   between serverless instances. Move the counters to Postgres or another
   shared store.

6. **Server-backed asynchronous PvP challenges.**
   `docs/PHASE2_MATCH_ENGINE.md` describes a PvP async mode built on
   `runMatchSegment()`, but friend challenges in
   `src/contexts/FriendsContext.tsx` are simulated locally and stored in
   `localStorage`. Persist challenges and turns in the database and resolve
   them with the segment engine.

7. **Bring back the 3D match view.** The Three.js match view
   (`src/components/vr/*`, `/test-vr` page) was removed in commit `b788a9c`,
   but `app/tests/vr.spec.ts` still targets `/test-vr`. Restore a trimmed
   version of the view from history behind a feature flag (see
   VR_IMMERSIVE_PLAN), or delete the stale spec if the view is dropped.

8. **End-to-end tests for the core flow.** There is no `playwright.config.ts`
   and the browser checks in `scripts/` are ad-hoc scripts. Add a Playwright
   config and specs for login (with `AUTH_DISABLED=true`), onboarding, one
   chat turn and one match, running against the LLM mock mode.

9. **Playable without a hosted database.** Without `DATABASE_URL`,
   `src/db/index.ts` returns a no-op mock whose reads always return nothing,
   so a new player never gets past onboarding. Replace it with a working
   local store (for example an embedded Postgres such as PGlite behind the
   same Drizzle schema) so the game can be tried with zero setup.
