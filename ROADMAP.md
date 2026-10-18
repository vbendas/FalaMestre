# Roadmap

Concrete next items for Fala Mestre!, drawn from the existing plans
([phase3-plan](docs/plans/phase3-plan.md), [ongoing-plan](docs/plans/ongoing-plan.md),
[PHASE2_MATCH_ENGINE](docs/PHASE2_MATCH_ENGINE.md), [VR_IMMERSIVE_PLAN](docs/plans/VR_IMMERSIVE_PLAN.md))
and from the current state of the code. Each item was checked against the code
as of October 2026 and is not implemented yet.

## How items are picked

Items that make the repository build, lint and test cleanly come first, because
everything else depends on a trustworthy CI run. After that, items are chosen
by how much they improve the core loop (talk to the assistant, manage the
squad, play a match) relative to their size. Each item should fit in one or a
few focused pull requests. LLM features use API calls to hosted models only;
there is no model training on this roadmap.

## Next items

1. **Get the unit tests green.** `npx vitest run` currently reports 6 failing
   tests: five in `src/lib/__tests__/decision-engine.test.ts` (option
   generation and substitution handling) and one in `game-engine.test.ts`
   (expected league name). Decide in each case whether the test or the engine
   is wrong, then fix it.

2. **Fix the typecheck error in the share card.**
   `src/components/social/SquadShareCard.tsx` imports `html2canvas`, which is
   not listed in `app/package.json`, so `npx tsc --noEmit` fails. Either add
   the dependency or render the share image with the native Canvas API.

3. **Fix the conditional React hooks in `SquadView`.** ESLint reports 3
   `react-hooks/rules-of-hooks` errors (hooks called after an early return in
   `src/components/game/SquadView.tsx`), which fails the CI lint step.

4. **Track Drizzle migrations in the repository.** The schema is applied with
   `drizzle-kit push` and no `app/drizzle/` migrations are committed. Generate
   a baseline migration and switch the documented setup to
   `db:generate` + `db:migrate`, so schema changes can be reviewed.

5. **Request size limits on public API routes.** `/api/conversation` and
   `/api/match` validate request bodies with Zod but have no body-size
   threshold (ongoing-plan, Priority A).

6. **Shared rate limiting.** `src/lib/rate-limit.ts` keeps counters in an
   in-memory `Map`, so limits reset on every cold start and are not shared
   between serverless instances. Move the counters to Postgres or another
   shared store.

7. **Structured logging with request IDs.** Routes log with free-form
   `console.log`/`console.error`. Add a small logger that attaches a request ID
   to every line for the conversation, match and decision routes
   (ongoing-plan, Priority C).

8. **Deterministic match mode for tests and demos.** The match engine uses
   `Math.random()` directly (56 call sites in `game-engine.ts`). Add an
   injectable seeded RNG so a match can be replayed exactly, which also makes
   the decision-engine tests stable (ongoing-plan, Priority D).

9. **Server-backed asynchronous PvP challenges.**
   `docs/PHASE2_MATCH_ENGINE.md` describes a PvP async mode built on
   `runMatchSegment()`, but friend challenges in
   `src/contexts/FriendsContext.tsx` are simulated locally and stored in
   `localStorage`. Persist challenges and turns in the database and resolve
   them with the segment engine.

10. **Bring back the 3D match view.** The Three.js match view
    (`src/components/vr/*`, `/test-vr` page) was removed in commit `b788a9c`,
    but `app/tests/vr.spec.ts` still targets `/test-vr`. Restore a trimmed
    version of the view from history behind a feature flag (see
    VR_IMMERSIVE_PLAN), or delete the stale spec if the view is dropped.

11. **End-to-end tests for the core flow.** There is no `playwright.config.ts`
    and the browser checks in `scripts/` are ad-hoc scripts. Add a Playwright
    config and specs for login (with `AUTH_DISABLED=true`), onboarding, one
    chat turn and one match, running against the LLM mock mode.

12. **Playable without a hosted database.** Without `DATABASE_URL`,
    `src/db/index.ts` returns a no-op mock whose reads always return nothing,
    so a new player never gets past onboarding. Replace it with a working
    local store (for example an embedded Postgres such as PGlite behind the
    same Drizzle schema) so the game can be tried with zero setup.
