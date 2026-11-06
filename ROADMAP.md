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

- **Every request body checked against a schema.** `src/lib/request-schema.ts`
  provides `validateBody(schema, body)`, and `ctx.readBody(schema)` on the
  route wrapper is the single way a route takes a body: size cap, JSON parse,
  object check and schema in one call, returning a value typed from the
  schema. All 22 body-taking routes use it; no route calls `request.json()`,
  `readJsonBody` or the unchecked `readJson` any more. Before this, five
  routes used Zod with their own reply, `/api/match/decide` had an 82-line
  hand-written validator, `/api/insights` had a schema but answered a flat
  `{ error: 'Invalid request' }` that threw away which field failed, and the
  rest cast the body and read fields off it — which is why a missing `userId`
  came back as 403 Forbidden or 404 User not found instead of saying what was
  wrong with the request.

  One refusal shape, everywhere: 400 with
  `{ error: 'Validation failed', message, field }`, the same three keys the
  chat and match routes already sent. `field` is the dotted path, including
  array indices, so a bad rating inside a decision turn's squad is named
  `priorState.squad.3.pac` rather than `priorState`. The message is
  guaranteed to name the field: schemas in `src/lib/validations.ts` spell
  their own ("facilityType must be one of: ..."), and `validateBody` prefixes
  the path onto any message that does not mention it, so a schema added later
  without hand-written wording still produces a reply the caller can act on.
  Only the first issue is reported — the rest of Zod's issue list quotes the
  input, which here is save contents and whatever the player typed. The
  refusal is recorded as `body_failed_schema` with the field, so it reaches
  the request's one summary line.

  Four routes keep a slow-body timeout, set as `parseTimeoutMs: 5000` on
  `withApiRoute`: `/api/conversation`, `/api/match`, `/api/match/decide` and
  `/api/match/finalize`. They are the ones that go on to run a simulation or
  call the model, so a client that opens a request and then stalls would tie
  up real work. Each used to carry its own copy of the timeout and every copy
  leaked its timer on success; the wrapper owns it now and clears it either
  way. A body that stalls and one that will not parse are indistinguishable
  to the caller, so both get `{ error: 'Invalid JSON body or timeout' }` and
  the summary line's `cause` says which it was. `/api/match/stream` sets no
  timeout and keeps the plain `Invalid JSON body`.

  Covered by `src/app/api/__tests__/route-body-contract.test.ts` (61: every
  route against a bad body and against the body its screen really sends,
  checked for the effect on storage, plus the nested-path cases),
  `body-schema.test.ts` (47: the refusal shape across all 22 routes at once,
  and a source check that no route reads a body another way),
  `body-parse-timeout.test.ts` (13) and `request-schema.test.ts` (9). Two of
  those are also a named CI step; see the README section on adding a route.
- **Get the unit tests green.** `npm run test:run` passes (657 tests across 17
  files). The decision-engine and game-engine failures are fixed. The body
  limit, logger and body-shape work above is covered by
  `src/app/api/__tests__/body-limit.test.ts` (270 tests, every body route
  against an oversized body, a body that only claims a huge length, a malformed
  body and `null`/array/number, plus request IDs on the logger-only handlers),
  `src/lib/__tests__/api-route.test.ts` (21), `request-body.test.ts` (28) and
  `logger.test.ts` (36); the route auth work below by
  `src/app/api/__tests__/route-auth.test.ts` (54).
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
- **Sign-in and ownership on the routes that trusted a `userId`.** `/api/staff`
  (POST), `/api/youth` (GET and POST), `/api/investment` (GET and POST) and
  `/api/predictions/bet` took a `userId` from the body or query string and acted
  on that player's save without checking who was signed in, so any caller could
  read or change someone else's game by naming their id. Each now calls
  `requireAuth()` before the body is read, as `/api/squad/train` and the rest
  do, and answers a request that names a different user than the session with
  403 `Forbidden` — the same reply the transfer, upgrade, daily-reward, tickets
  and predictions routes already used. On `/api/youth` the id is in the query
  string, so both checks land before the body read; on the three body-carrying
  routes the ownership check necessarily follows the parse. Every database read
  and write is keyed on the resolved `targetUserId` rather than the supplied
  `userId`. With `AUTH_DISABLED=true` there is no session, `requireAuth()`
  passes, the ownership check is skipped and the supplied id is used, which is
  the dev fallback the other routes have.
- **`GET /api/squad/migrate` behind the cron or admin secret.** The batch
  migration rewrites every saved game state and had only a comment saying admin
  authentication was still to be added. It now takes the same inline `Bearer`
  check against `CRON_SECRET` or `ADMIN_SECRET` that `/api/predictions/settle`
  uses, and answers anything else with 403 `Admin or cron auth required to run
  the batch migration` before reading a single game state. The POST is
  unchanged: `src/hooks/useGameState.ts` fires it on load and is the only
  caller in the app, so nothing in the client depended on the open GET.
- **Session fallback when the id is left out.** The four routes above used to
  answer an absent `userId` with an unconditional 400. That reply is kept but
  now scoped to a request that identifies nobody at all — no session and no id —
  with each route's original wording (`userId required` on staff and youth,
  `User ID required` on investment and the bet). A signed-in request that omits
  the id resolves to the session user instead of being refused, because the id
  is redundant with the session and because `/api/squad/train`,
  `/api/squad/formation` and the `/api/squad/migrate` POST already proceeded on
  `sessionUserId || userId`; refusing here would have made these four routes
  stricter than the rest of the API for no gain. Those three squad routes also
  used to silently prefer the session over a *mismatched* id rather than
  refusing it; that half is fixed in a later entry, and the fallback for an
  absent id is what every one of these routes now shares.
- **Tests for the session and ownership checks.**
  `src/app/api/__tests__/route-auth.test.ts` (54 tests) is deliberately separate
  from `body-limit.test.ts`, which mocks `@/lib/auth-helpers` wholesale and
  would make these assertions vacuous. It mocks `next-auth`'s
  `getServerSession` instead, so the real `requireAuth`, `getAuthenticatedUser`
  and `AUTH_DISABLED` branch run, and uses a recording database mock so the
  "nothing was touched" assertions count actual read and write calls. Five cases
  run against each of the nine handlers: nobody signed in gives 401 with the
  request body never read and no database access; a signed-in user naming
  another id gives 403 with the other save untouched; their own id gives 200 and
  a write on the mutating routes; `AUTH_DISABLED=true` works off the supplied
  id; and a request identifying nobody still gets each route's own pre-existing
  reply — 400 on staff, youth, investment and the bet, 401 on the three squad
  routes, which always answered `User not identified` that way. Insights sits
  in its own block in the same file rather than in that matrix, because the
  route keeps an in-module per-user cache that a shared id would serve from on
  the second 200. Four more tests cover the migration GET under no secret, a
  wrong secret, the cron secret and the admin secret. `body-limit.test.ts` needed one setup change for this work:
  its `squad-migrate` GET entry now sends the cron header, since the handler
  otherwise stops at 403 before the line that test reads.

- **A signed-in player's save belongs to their account.** The session id
  (Google's subject, a long run of digits) and the local game id
  (`user_xxxxxxxxx` from localStorage) were two namespaces nothing ever linked,
  so every ownership check compared ids that could never match and a signed-in
  player was refused on their own save. Now `/api/onboarding/create-team` keys
  the save on the session user when signed in (and answers a second trip
  through onboarding with the save that already exists), the client resolves
  its id through `src/hooks/usePlayerId.ts` — session user first, localStorage
  only on a build with auth disabled, nothing requested until the session
  settles — and `userIdSchema` in `src/lib/validations.ts` accepts both
  id shapes. Covered by `src/app/api/__tests__/session-save-ownership.test.ts`,
  which drives the routes with a Google-shaped id.
- **Session required for onboarding, and the last ownership gaps closed.**
  With auth on, a team created by an unsigned visitor could never be played, so
  `/api/onboarding/create-team` now runs `requireAuth()` (a no-op with
  `AUTH_DISABLED=true`). `/api/insights` compared nothing to the session and
  served whatever id was in the body; it now answers a mismatch with the same
  403 `Forbidden` as the other routes and works off the session id when no body
  id is sent. `/api/squad/train`, `/api/squad/formation` and the
  `/api/squad/migrate` POST used to silently swap in the session user when the
  body named someone else; they refuse with the same 403 instead, keeping the
  body-id fallback for the auth-disabled path. All four joined
  `route-auth.test.ts`, and `session-save-ownership.test.ts` checks the
  load-time migrate call works with the id the client now resolves.
- **Signed-out players are sent to sign in before they start.** With auth on,
  the client used to send a signed-out visitor through onboarding and only show
  the raw 401 once they had finished designing a team. The client could not
  tell the two signed-out situations apart — auth on and not signed in looks
  the same as auth disabled in dev — so `GET /api/auth/mode` now reports
  `{ authDisabled }` from the same `AUTH_DISABLED` the server gates on, read
  per request. `usePlayerId` only consults it when there is no session, and
  reports `requiresSignIn`; `src/app/page.tsx` and the onboarding page redirect
  to `/login` on that, and onboarding holds its form back until the question is
  settled. The lookup lives in `src/hooks/useAuthMode.ts`, shared with the
  login page, which with auth disabled sends the player back to the game rather
  than showing a Google button that has no OAuth behind it to sign in against.
  An unreadable answer is treated as auth being on. The
  `/api/conversation` GET also ran without `requireAuth()`, so a caller with no
  session at all got whatever save the id pointed at; it now answers 401.
- **One end-to-end test for a single signed-in player.**
  `src/app/api/__tests__/signed-in-player-journey.test.ts` walks one
  Google-style id through create-team, the conversation load, a formation
  change and the load-time migrate call in order, against a stateful in-memory
  store so each step reads what the previous step wrote. The per-route tests
  all passed while the ids did not line up; this one fails if they stop
  matching (verified by reverting the onboarding fix). It also walks the same
  path under a stale local id (403 at every step, save untouched) and with
  `AUTH_DISABLED=true`. `src/hooks/__tests__/usePlayerId.test.tsx` covers the
  three situations the hook decides between, and `useAuthMode.test.tsx` the
  lookup behind them, including the failed request.

- **Playable with zero setup, on an embedded Postgres.** Without
  `DATABASE_URL`, `src/db/index.ts` used to return a no-op mock whose reads
  came back empty, so a new player never got past onboarding and every failed
  write was silently swallowed. It now hands out the store in
  `src/db/local.ts`: PGlite (Postgres compiled to WASM) persisted under
  `app/.data/pglite` (`PGLITE_DATA_DIR` overrides), behind the same Drizzle
  schema as the hosted database. The open store lives on `globalThis` so dev
  reloads and per-route bundles never open one directory twice, and every
  query goes through a gate that waits for the migrations to finish, so the
  first request after boot cannot race table creation. PGlite was chosen over
  SQLite (would need a second schema; `jsonb`, `uuid` and
  `gen_random_uuid()` are used throughout) and over `embedded-postgres`
  (downloads native binaries). With `DATABASE_URL` set the Neon path is
  byte-for-byte what it was. Proven by
  `src/app/api/__tests__/local-player-journey.test.ts`, which runs the real
  route handlers against a temporary PGlite directory with auth disabled and
  the mock assistant: create a team, load it, one chat turn (checking the
  `conversations` and `analytics_events` rows landed), the load-time migrate
  call, every decision turn, the persisted match, then a close-and-reopen of
  the store standing in for a restart. `src/db/__tests__/local-store.test.ts`
  covers the store on its own. The same flow was also driven over HTTP
  against the built server with a real restart, and through headless
  Chromium up to the first match decision, with no failed request or server
  warning.
- **Schema from committed migrations on both databases.** `app/drizzle/`
  holds `0000_baseline.sql`, generated from `src/db/schema.ts`, and its
  snapshot. The local store applies the folder on startup through Drizzle's
  own migrator (`DRIZZLE_MIGRATIONS_DIR` overrides, for tests); the hosted
  database takes it through `bun run db:migrate`. Both record what ran in
  `drizzle.__drizzle_migrations`. The baseline is `CREATE TABLE IF NOT
  EXISTS` throughout so it lands as a no-op on a Neon database that was set
  up with `db:push`, recording itself and leaving data in place; verified by
  pushing a database, inserting a save, migrating over it and diffing the
  resulting schema against a migrate-only one (identical, and drizzle-kit's
  own diff reports nothing pending). The migrator approach replaced a first
  cut that ran `drizzle-kit push` at boot, which made drizzle-kit a runtime
  dependency and cost a schema diff per start; it is back in devDependencies
  and the cold boot dropped from about four seconds to under one. Not yet
  run against a real Neon database; the README describes the first-time
  steps for one. `db` in `src/db/index.ts` stays untyped on purpose: typing
  it surfaces 28 latent type errors in 10 route files (see next items).
- **A match the player watched can be banked: `POST /api/match/finalize`.**
  The route takes the match seed, the fixture
  being settled (`week`, `opponent`, `isHome`) and the six decisions as option
  ids, replays all six turns itself and runs the post-match bookkeeping on the
  score *it* computed; the client's score is never written. Three pieces make
  that trustworthy. `src/lib/match-replay.ts` holds the one implementation of
  a turn, `playDecisionTurn`, which `/api/match/decide` now calls too, so the
  live turns and the replay cannot drift; `deriveTurnSeed(matchSeed, n)` pins
  each turn's seed to the match seed, so a whole match follows from one token
  (the derived string passes `seedSchema`, which is what lets the screen send
  it to decide as that turn's seed). `src/lib/match-bookkeeping.ts` holds
  `applyMatchOutcome`, extracted verbatim from the `withSeed` block in
  `/api/match/route.ts` and now shared by both routes — record, points, week,
  match earnings, staff wages, morale, standings position, next fixture, the
  legacy backfills and the narrative line. A decision is accepted only if its
  id is one the server itself would have offered for the replayed state, so a
  tactic that was never on the menu cannot be submitted; the fixture fields
  must match the save, which is what stops a match being banked twice; and an
  optional `claimedScore` is compared with the replay and answered 409 on a
  mismatch rather than believed. No AI narration: a finalize is a save, and
  the player has already watched the football. Covered by
  `src/app/api/__tests__/match-finalize.test.ts`, which plays a match through
  `/api/match/decide` under the derived seeds and checks finalize lands on the
  same score, and `src/lib/__tests__/match-bookkeeping.test.ts`.
- **The match screen banks the match it plays.** A match played on the screen
  now survives a reload: the week and the fixture have moved on, and the
  result modal shows what the server returned instead of a hard-coded 50
  points. `src/hooks/useTurnBasedMatch.ts` holds what the screen does rather
  than shows — it draws one seed per match, sends
  `deriveTurnSeed(matchSeed, n)` with every decision turn, chains each turn
  onto the last one's end state, records the decisions as option ids (null for
  a timeout), pins the fixture as it stood at kickoff and calls finalize at
  full time — leaving `TurnBasedMatchFlow.tsx` with playback and layout. The
  turn loop starts at turn 0, so minutes 0-15 are played like any other
  segment; it used to call decide with `currentTurnNumber + 1` and skip them.
  A rejected finalize is shown as "A partida não contou", with the server's
  reason and no result modal, because a modal there looks like saved
  progress; a decide call that fails says the same rather than leaving the
  player on a spinner. The modal also takes the fixture that was played: it
  read `season.nextMatch`, which by then is *next* week's game, and it
  ignored `isHome`, so an away result put the player on the wrong side of the
  score. Covered by `src/hooks/__tests__/useTurnBasedMatch.test.tsx`,
  `src/components/game/__tests__/TurnBasedMatchFlow.test.tsx` and
  `MatchResultModal.test.tsx` (and `DecisionPrompt`/`TurnSummary` tests);
  `local-player-journey.test.ts` now plays its
  match the way the screen does, through decide and finalize, and checks the
  week has moved after a reload and a restart. The component tests needed the
  `framer-motion` and `lucide-react` mocks in `src/test/setup.ts` to answer
  for any element and any icon rather than a fixed handful.
- **The ways a match could still be lost between the screen and the save.**
  Each of these was reproduced before it was touched. (a) *Two tabs finishing
  at once.* Both read the pre-match save, both passed the fixture check and
  both wrote, so both players were told their match counted and the save kept
  whichever wrote last — four tabs gave four 200s and one banked match.
  Finalize's write is now conditional on the week it was played in
  (`(current_state->'season'->>'week')::int = $week`) and reports the rows it
  changed; whoever writes second matches no row and is answered 409 like any
  late submission. `match-finalize-concurrency.test.ts` covers it against the
  embedded Postgres, because the guard is SQL and a mock cannot vouch for it.
  (b) *A finalize whose response was lost.* The save had moved on, the screen
  had not heard, and it kept offering the fixture that was already played —
  every further attempt refused for the same reason, with no way out but a
  page reload. A refusal now re-reads the save (`refreshGameState`), so the
  screen lands on the real next fixture. (c) *No way to retry.* A dropped
  connection cost the player the 90 minutes they had just watched. The
  failure screen now offers "Tentar novamente" for the failures that could
  succeed on a second try (5xx, 429, a dead connection) and not for the ones
  the server has already decided (409, 400); a retry re-sends the same match,
  same seed and decisions, so the server still decides it once. (d) The
  refusal messages are the screen's own Portuguese; the server's English goes
  to the console. (e) `DecisionPrompt` could report both a decision and a
  timeout for one prompt when a click landed in the same batch as the clock
  reaching zero — it never reached the server, because the flow unmounts the
  prompt on the first of the two, but the component now reports one or the
  other. `DecisionPrompt` and `TurnSummary` also no longer call handlers from
  inside a `setState` updater, which is what warned at half time.
- **Tests that would catch a match not counting again.** Two journeys and a
  season, all against the embedded Postgres.
  `signed-in-match-journey.test.ts` plays a signed-in player (a Google-style
  session id, auth on) through a match the way the screen does — six decide
  calls under derived seeds, then finalize — and checks the save moved on
  under the session id and survived a restart; it also covers the two
  refusals nothing tested through the match path, one player finalizing
  another's fixture (403) and a finalize with nobody signed in (401).
  `match-season.test.ts` banks all thirty-eight rounds, one week at a time,
  with a head coach on the payroll so the weekly wage is really deducted, and
  checks after every round that the points match the record, the money
  matches the receipts minus the wages, `matchesPlayed` matches the rounds
  and the position stays inside the table — then that the last round closes
  the season instead of drawing another fixture. The league, incidentally, is
  the six built-in rivals plus the player: an onboarded team is not in
  `BRAZILIAN_TEAMS`, so the standings have seven rows, not the twenty the
  bookkeeping's comment claims.
- **The match screen's timing tests run the clock the way a browser does.**
  They used to jump the fake clock by seconds inside one `act`, firing whole
  runs of timers with no render between them — a state no browser passes
  through, and one that reports races that cannot happen. `src/test/
  match-timers.ts` advances to the *next* timer only and lets React render
  and promises settle before the one after it. That changed a finding from
  the previous round: `DecisionPrompt` reporting both a decision and a
  timeout needs the click to be dispatched before React has committed the
  clock's render, which the browser's task ordering does not normally allow
  (the clock's commit lands in a microtask at the end of its own task, and
  the button is then disabled). It is reachable only if that render is
  deferred, so the guard is worth having, but it is defence in depth rather
  than a bug that was happening. The tests were then checked by mutation:
  reverting `DecisionPrompt` to its pre-fix shape fails
  `DecisionPrompt.test.tsx`, while removing any *single* one of its guards
  does not, because the guards are individually sufficient.
- **A finished season stays finished.** Once the last of the
  `SEASON_LENGTH` (38) rounds was banked, the bookkeeping left
  `{ opponent: 'Temporada Completa', competition: 'Fim da Temporada' }` in
  `nextMatch` — and that looked like an ordinary fixture to everything
  downstream. `MatchView` only withheld a match when `nextMatch.opponent` was
  empty, so the screen offered JOGAR AGORA against the placeholder; the
  client sent back exactly what the save said, so finalize's fixture check
  passed; and the match was banked. Measured before the fix: week 39 → 40, a
  thirty-ninth match, +1 point and +R$10,000, repeatable for ever.
  `SEASON_LENGTH` and `isSeasonOver` now live in `constants.ts` and both ends
  read them. `/api/match/finalize`, `/api/match` (which banks through the
  same bookkeeping) and `/api/match/decide` (so nobody plays ninety minutes
  that cannot be banked) answer 409 `Season complete`; the match screen shows
  the final campaign — position, points, record, matches — instead of a
  fixture. `/api/match/stream` is left alone: it writes nothing. Starting a
  new season is still not implemented, so a finished save is finished.
  Covered in `match-season.test.ts` (the 39th match refused on all three
  routes, the save untouched) and `MatchView.test.tsx` (no play button, no
  placeholder opponent, and the last round still playable).
- **The client no longer carries the old one-request match path.**
  `useGameState` kept `playMatch`/`playMatchAndGetResult`, which posted to
  `/api/match` behind five `[DEBUG]` console lines and a result cache, and
  `MatchView` was still handed them as `onPlayMatch`/`onPlayMatchWithResult`
  props it never called — the screen has played its own turns since the
  finalize work. All of it is gone, along with the `MatchAPIResult` type, the
  `cachedMatchResult` state and the duplicated `pointsChange` (the modal's
  headline and caption now read the one `pointsEarned` the server reported,
  which is what used to show `+0` for every result). `/api/match` itself is
  kept and documented at the top of its route file: nothing in the game calls
  it, but it is what `match-seed.test.ts` and `match-seed-concurrency.test.ts`
  replay to prove the engine is deterministic, the only path that produces
  the AI narration and the enhanced match script the 3D view wants, and a
  headless "simulate this fixture" endpoint a cron league or PvP would need.
  If the 3D view never returns and it stays uncalled, it should go, and
  whatever is still wanted from it should move into `match-replay.ts` with
  its tests.

- **The assistant has a chat UI.** `src/components/game/ChatView.tsx` is the
  **MESTRE** screen, in the sidebar next to the other views. It opens on the
  conversation the save already holds (the `GET`'s `conversationHistory`,
  with the `jsonb` ISO timestamps revived into `Date`s at the edge), sends on
  Enter with the route's own 2000-character cap mirrored in the composer, and
  renders the reply with its suggested actions as chips. `useConversation.ts`
  owns the requests; the reply's game state is handed back to `useGameState`
  so the other screens do not fall behind the conversation. Every failure is
  on screen in the game's language — 429 with the route's own `retryAfter`,
  503, a 25s timeout, a lost connection — and a refused send puts the text
  back in the box instead of losing it. Covered by `ChatView.test.tsx` (12),
  `useConversation.test.tsx` (4), `conversation-chat.test.ts` (10, the route
  against a real embedded Postgres) and the browser specs below.

  Four things had to change behind the screen before it was safe to wire up:

  - The route re-saved the `currentState` it had read before the AI call, so
    any save committed in between — a match banked in another tab, a transfer
    — was reverted by the next message. Talking changes nothing about the
    game, so the write is gone; the two new messages are appended in SQL
    (`history || [user, reply]::jsonb`) rather than by writing back the array
    the request read, so two messages in flight both survive and a reply can
    never be separated from the message it answers.
  - A message from a user with no save made one up, named "Dragões do
    Cerrado", silently taking the place of the club the player was about to
    create in onboarding. The route answers 404 `no_save`; saves are created
    in `/api/onboarding/create-team` and nowhere else.
  - A failed history write still returned the reply as if it were history.
    The answer now carries `persisted: false` and the screen says the
    exchange will not survive a reload.
  - A live model that failed was replaced by the mock silently. The reply
    carries `source: "model" | "mock" | "fallback"`, the mark is stored on
    the message, and a `fallback` reply is labelled on screen and after a
    reload.

- **What the assistant says and suggests follows the save.** Suggestions used
  to be `context.availableActions` verbatim: one fixed list whatever had just
  been said, shown as raw keys, and at the end of a season
  `['view_final_standings', 'new_season']` — `new_season` being a feature
  that does not exist. `src/lib/assistant-actions.ts` is now the one
  catalogue of suggestions, each a screen the chat can actually open: the
  mock picks from it, the live model is told to pick from it and has its
  answer filtered back against it, and the chips render from it, so an
  unimplemented action cannot reach the player by any route. Suggestions
  follow the intent of the reply, and are gated on the save — `play_match`
  and `view_standings` disappear once the season is over, `view_final_standings`
  appears. A finished save has no fixture, only the 'Temporada Completa'
  placeholder, so both assistants now say the campaign is over, with the
  final position and record, instead of talking up a match against the
  placeholder; the live model's prompt says `SEASON FINISHED`, gives the
  record and budget, and lists the keys it may use. Covered by
  `assistant-replies.test.ts` (15). The stored
  `context.availableActions` is left as it is — the match screen reads it —
  but nothing in the chat does.

- **The chat's telemetry reports the real counters.** The conversation
  analytics event logged the player's money as `points` and the round as
  `matchesPlayed`, so every save looked like it had played as many matches as
  weeks had passed. It now logs `season.points`, `teamStats.matchesPlayed`,
  and `money` and `week` as their own fields, plus `persisted` and `source`.

- **Browser tests, and the chat's one browser-only bug.** `app/playwright.config.ts`
  and `app/tests/e2e/` cover onboarding, a conversation surviving a reload,
  and a fast double Enter. Playwright starts the app itself on a per-run port,
  on a throwaway embedded store removed in the teardown, with the mock
  assistant and `DATABASE_URL`/`OPENROUTER_API_KEY` forced empty; the
  conversation spec asserts `source: "mock"`, which only holds if no live
  model was called. The whole run takes about ten seconds and is a second CI
  job (`app-e2e`) that references no secrets. The double-Enter spec exists
  because that bug was invisible to the jsdom suite: two Enter keydowns
  delivered in one task both read a stale `isSending` from their render and
  both sent, storing the message twice, and Testing Library's flush between
  events hid it. The guard is a ref now, pinned at the hook level by
  `useConversation.test.tsx` and in a real browser by the spec. The stale VR
  spec that pointed at the removed `/test-vr` page was deleted with this work
  (see item on the 3D view).

- **The journeys cover the whole loop, including the chat.**
  `local-player-journey.test.ts` now closes the circle — talk, play a match
  through decide/finalize, talk again — and checks the reply knows the week
  moved on: the new round, the points earned and the new fixture, and not the
  opponent just played. `signed-in-player-journey.test.ts` sends a message as
  the signed-in player (the reply lands, `persisted: true`, both messages on
  the next load under that one save) and checks the conversation POST is
  refused 403 under the stale local id, alongside the other routes.

- **Library and database code on the structured logger, and one summary line
  per request.** Every line the server writes is one JSON object carrying the
  route and the ID of the request that caused it, including lines from
  `src/lib` and `src/db`: `src/lib/request-context.ts` holds the request's
  logger in an `AsyncLocalStorage` scope, so `getLogger(scope)` reaches it
  from any depth with no signature changes. The match engine's three
  `[DEBUG]` lines are gone. `withApiRoute()` writes exactly one `Request
  completed` line when a request ends, with method, status and duration,
  at info/warn/error by status; a refusal carries a `reason`, recorded by
  the gates themselves (`requireAuth`, `checkRateLimit`, `requireCronAuth`,
  `readJson`) or recovered from the reply's own `error` field. A streaming
  response reports when the stream settles, with `stream:
  completed|failed|cancelled` and the real duration. NextAuth's own output
  goes through the logger too (`authOptions.logger`). The AI client no
  longer copies the upstream error body or the model's reply into the log:
  both were shown to carry the system prompt (and so the player's save), the
  player's message, and — when the far end reflects the `Authorization`
  header — the API key. A `no-console` lint error covers `src/app/api`,
  `src/lib` and `src/db`. Covered by `route-sweep.test.ts` (every route,
  normal and refused, with fake secrets and a reflecting upstream, failing
  on any unstructured line, any line without the call's ID, anything but
  one summary, or any secret or player message in the output),
  `request-outcome.test.ts`, `request-context.test.ts`,
  `log-hygiene.test.ts`, `request-id-correlation.test.ts` and
  `library-logging.test.ts`. README has a "Logs" section for whoever is on
  call; `LOG_LEVEL` is in `.env.example`.
  *Left over:* a request Next.js turns away before any route runs (a wrong
  method, an unknown path) leaves no line at all, not even from Next in
  production; the only seam is a `middleware.ts`, judged not worth it. A
  500 leaves two lines, the route's own stack line and the summary, both
  under the same ID; the summary's `reason` on a 500 is the generic reply
  text and says nothing. The deferred stream line depends on the body being
  consumed. The four `src/app/api/match*` and `conversation` routes keep
  their own 5-second body-parse timeout and a hand-rolled body path rather
  than `ctx.readJson`. The sweep stubs the session lookup, so NextAuth's
  own lines are covered only by `log-hygiene.test.ts`.
- **The two read routes that served another player's data are gated.**
  `GET /api/predictions` and `GET /api/tournaments/tickets` call
  `requireAuth()` before anything else, and both now derive the id they read
  from the session rather than the query string, so a named `userId` can only
  ever select the signed-in player's own rows. A signed-out request gets 401
  and a signed-in one naming somebody else gets 403. The `known` markers are
  off both routes in `route-sweep.test.ts`. An audit of every other route
  found no second instance: each one that takes a `userId` runs `requireAuth`
  (or `requireCronAuth`) before trusting it, and the other ids in the API
  (`playerId`, `yieldId`) are matched inside rows already selected by user, so
  naming someone else's gets a 404 rather than their data.
- **A bet no longer takes the stake before it checks the prediction.**
  `POST /api/predictions/bet` validates the stake (a positive whole number —
  a negative one used to pass the funds check and *credit* the player) and
  the id's shape, then looks the prediction up, refusing one that does not
  exist (404), is closed or settled or past its deadline (409), or does not
  offer the option named (400) — all before any write. A missing save is a
  404 rather than a fabricated R$1,000,000 balance. The bet row is then
  written *before* the money moves, and because neither driver gives us a
  transaction across those statements (the hosted path is neon-http), a
  failure after the insert undoes the bet and puts the balance back by hand
  and answers 500 `no money was taken`. The old code logged and swallowed a
  failed debit and recorded the bet anyway. Covered by
  `src/app/api/__tests__/predictions-bet.test.ts` (12 cases against the
  embedded store: nine refusals plus the cross-user and signed-out ones, each
  asserting the stored balance is unchanged and no bet row was written, and
  one good bet asserting the debit is exactly the stake). Ten of the twelve
  fail against the pre-fix route.
- **Settle refuses a malformed prediction id.** `POST /api/predictions/settle`
  validates the id's shape before the `predictions.id` lookup, so a value that
  is not a UUID answers 400 instead of letting Postgres raise a 500. The
  `known` markers are off both prediction routes in `route-sweep.test.ts`.
- **The transfer routes work off the session id.** `/api/transfer/buy` and
  `/api/transfer/sell` read and write the signed-in player's save rather than
  the `userId` the body named. The ownership check above them already made the
  two equal, so this was not exploitable; the point is that the safety no
  longer depends on a check several lines up staying correct, which is how the
  other save routes are written.
- **An error from someone else's code is no longer logged whole.** Three leaks
  on the list were the same mistake — a foreign error handed to the logger,
  which expanded it in full — and the fix is in the logger rather than at the
  56 `log.*('…', { error })` call sites that share the pattern.
  `serializeError` now passes an error's own properties through
  `ERROR_FIELD_ALLOWLIST` (`code`, `status`, `statusCode`, `severity`,
  `constraint`, `table`, `schema`, `routine`), and only when the value is a
  number, a boolean or a string within 200 characters, so payload smuggled
  under an allowlisted name is refused too. Everything else is dropped and
  *named* in `errorFieldsDropped` — names only, never values — so a field
  someone attaches to their own error cannot vanish unnoticed. Separately, the
  values of the seven secret-bearing environment variables (and the
  `DATABASE_URL` password on its own, so a line quoting part of the URL is
  still clean) are scrubbed from every string the logger writes, with an
  8-character floor so a short setting cannot mangle unrelated text; only
  those values, never every setting.
  *The leaks this closed:* a malformed `DATABASE_URL` put the password in the
  driver's message *and* its stack (`db/index.ts` now also logs the error's
  name plus `describeDatabaseUrl()` — scheme, host, database, a
  `hasCredentials` boolean, never the userinfo); `/api/insights` quoted the
  first ten bytes of a model reply it could not parse, which a `JSON.parse`
  `SyntaxError` carries in its message, now reported by shape through the
  shared `parseFailureFields()` in `src/lib/log-safe.ts` that `ai-service.ts`
  also uses — the duplication was what let the two drift apart.
  *The leak nobody had hit:* a Postgres error carries the failing statement as
  `query` and its bind values as `params`, and the routes write the whole save
  as one jsonb parameter, so any constraint violation on a save route wrote
  the player's entire game state out — reproduced at 25KB on one line through
  the real stack. Dropping the fields was not enough on its own: drizzle's
  wrapper embeds the SQL and the bind values as *text* in its message, and so
  in its stack, so the string content of a dropped property is scrubbed from
  the message and the stack as well.
  Covered by `log-hygiene.test.ts` (a real duplicate-key insert logged with
  the verbatim call-site pattern, asserting the save is nowhere in the line
  while `code`/`constraint`/`table` survive) and `logger.test.ts` (the drop
  list, the oversized-allowlisted-value refusal, and the scrub including a
  stack-shaped fragment).
  *Left over:* only payload strings of 16 characters or more are scrubbed from
  a message, so short bind values stay visible — a real line shows
  `params: u1,T,[redacted:params]`, keeping a user id and a team name that the
  line carries elsewhere anyway. Lowering the floor would start mangling
  ordinary prose; the large values, which are the ones that matter, are always
  removed. The 56 `{ error }` call sites were left as they are, which is the
  point of fixing it in the logger: they are safe by default now, and a new
  one does not have to know any of this. The route sweep also grew a `domainRefusals` field
  and a sixth case: eight refusals that come from a route's own checks rather
  than the shared gates — a bad formation, an unknown staff action, an invalid
  role, a bad investment option, a transfer the budget cannot cover, an
  unknown ticket method, an unknown youth action, a negative stake — each held
  to the same contract, a warn summary carrying a reason. README's Logs
  section documents what an error line now leaves out and how to get a custom
  field through.
  *What to do about the store-backed tests:* adding the database-error case
  pushed two already-slow tests past the 10s global timeout under full-suite
  parallelism, and each was given a hand-written 30s — the 35th such override
  in these files. The measurement behind Next items 2 says this is a floor, not
  a one-off. The recommendation is a shared `src/test/` store fixture that
  owns the temp directory, the env, the module reset, the teardown *and* the
  file's `testTimeout`, so the budget is set once where the cost is incurred
  and the duplicated setup leaves 11 files; failing that, a second Vitest
  project listing the store-backed files with a 60s timeout. Raising the
  global was rejected: it would make a genuine hang in the ~860 fast tests
  take 60s to report instead of 10s.

- **Stop overlapping saves from erasing each other: `game_states.version`.**
  Every save-changing route loaded the save, changed it and wrote it all back,
  so two overlapping actions lost one of them silently (train a player while a
  match is banked and whichever wrote second reverted the other). Migration
  `drizzle/0001_game_state_version.sql` adds `version integer not null default
  1` (`ADD COLUMN IF NOT EXISTS`, so it is safe on a database that already
  has it, as the baseline is with its tables) and a `BEFORE UPDATE` trigger
  that sets `version = old.version + 1` whenever `current_state` changes, as a
  backstop for any write that bypasses the helpers. `src/lib/save-store.ts`
  is the shared piece, with three shapes for three kinds of writer:
  - `loadSave` / `commitSave` for a player pressing a button: the write is
    `WHERE user_id = $1 AND version = $2`, bumps the version, returns the rows
    it changed, and a miss is answered with `saveConflictResponse()`, a 409
    ("Save conflict", reload and retry) in the shape finalize uses when it
    loses. On it: `squad/train`, `transfer/buy`, `transfer/sell`,
    `match/route.ts` (which held the save across the AI call, the widest
    window, and used to answer 200 after a failed write; it now answers 503
    or 409), `squad/formation`, `staff`, `youth` (all four actions),
    `daily-reward`, `stadium/upgrade`, `facilities/upgrade`, and
    `match/finalize`, which had guarded on the week alone and so could still
    erase a training that landed mid-replay; on a lost race it re-reads once
    and answers "Fixture mismatch" with the new fixture if the week moved,
    else the generic conflict.
  - `adjustMoney` for the writers that only change `user.money`: a
    `jsonb_set` increment inside the UPDATE, computed from the row at the
    instant of the write, with an optional floor so a debit cannot overdraw
    even against another debit. Nothing is read, so nothing can conflict and
    no one has to be told to retry. On it: `predictions/bet` (the stake, with
    floor 0, and the refund on its undo path), `predictions/settle` (pays
    every winning bettor in one pass; a 409 there would have no caller to
    bounce to) and `investment/claim` (the yields are already marked claimed
    by the time the money moves, so a refusal would lose it).
  - `reviseSave` for `squad/migrate`: load, migrate, commit, and on a lost
    race reload and try again, three times, because the migration only fills
    in missing fields and is safe to repeat. The per-player POST answers 409
    only after all three; the batch GET lists ids, migrates each save fresh,
    skips one that keeps moving and reports it under `conflicts` rather than
    failing the run.
  Left alone on purpose: the chat-history append in `/api/conversation`, a
  SQL concatenation on `conversation_history` that never touches
  `current_state`, and the insert in `onboarding/create-team`, which makes a
  new row at version 1. `save-version-concurrency.test.ts` provokes the
  races against the embedded Postgres (two trainings, buy vs sell, two sales
  of one player, a whole-match simulation vs a training, two hires, formation
  vs sale, two bets for the whole balance, a loser retrying) and checks the
  trigger, the increment, the floor, the retrying migration, the batch
  summary and that the migration file can be re-run on a store that already
  has the column. Neon needs `npm run db:migrate` for this one.
- **Every save writer made to lose its race, and the tests shown to catch
  the old bug.** `save-race-per-route.test.ts` wraps the save table's own
  reads (`findFirst`/`findMany` on `game_states`) and arms a one-shot hook
  that runs a training session for the player the moment the route under
  test has read their save, so the route carries on with a stale copy. One
  test per writer, 23 in all: train, buy, sell, formation, staff hire and
  fire, all four youth actions, daily reward, stadium and facility upgrades,
  the whole-match simulation, finalize (refused as a save conflict with the
  training kept, then banked on a retry; and losing to another finalize
  still answered as a fixture mismatch with the new fixture), migrate for one
  save and in batch, bet, settle paying a bettor mid-action and a bettor
  acting mid-payout, and the yield claim. Each checks the training is still
  in the save afterwards and the route either refused with the shared 409 or
  (the money increments) landed on top. The same file was then run against
  the routes as they stood before the version column (`git show HEAD:` for
  the fourteen tracked routes, finalize rebuilt with its week-only guard,
  and only the timestamp-string bug below patched so they ran on the
  embedded store at all): 22 of 23 fail on the lost-update assertion itself
  (`expected 200 to be 409`, or the training budget back at 15); the 23rd,
  finalize losing to another finalize, fails only on the `expected` fixture
  the reply now carries, since the week guard already refused that case.
  The hook lives at the database rather than on `save-store` precisely so
  the old and new routes meet the same test. The batch migration lists ids
  with a plain `select` so the per-save load is the first read of each save.
- **Settlement paid after it marked, and could not be run again.**
  `predictions/settle` marked each bet settled, then paid it, and refused
  any second run with "already settled", so a payout that failed left the
  bettor unpaid for good. It now pays first and marks second, catches a
  failed payout per bet (the bet stays open, the run answers 502 with
  `failedPayouts` so the scheduler retries), and a settled prediction can be
  settled again for its open bets only, using the result stored the first
  time. The remaining window is the other way round: paid, then the mark
  fails, pays twice on a rerun. The test provokes the failure with a
  `NOT VALID` check constraint on the bettor's row, which fails any UPDATE
  to it at the database, and so runs the same against the old route.
- **Timestamp columns were handed ISO strings.** `predictions/settle`,
  `investment/claim`, `tournaments/tickets` and both cron routes wrote
  `new Date().toISOString()` into `timestamp` columns, and the prediction
  history helper dates its fields the same way. The Neon HTTP driver let it
  through; the embedded driver throws `value.toISOString is not a function`,
  so those routes answered 500 on a local checkout. They pass Date objects
  now. Found because the race tests above are the first to drive settle and
  claim through the embedded store.

- **What the player sees when a guarded write is refused.** The screens were
  written before any route could refuse a write. Training never read the
  reply, so a refused session looked like it worked (and a successful one
  never updated the open player card). Staff, facilities and stadium reloaded
  the whole page on success and did nothing on a refusal. Youth sign, reject,
  intake and focus, and the formation picker, went quiet on a refusal. Bets
  announced success whatever the route answered and never reloaded the
  balance. Now every one of them goes through `useGuardedAction`
  (`src/hooks/useGuardedAction.ts`): the reply is read with
  `readActionReply` (`src/lib/save-conflict.ts`, client-safe, shares the
  "Save conflict" constant with save-store), the save is reloaded after every
  reply via `onRefreshSave` from `useGameState`, a refusal is shown in an
  `ActionNotice` with its reason and a "Tentar novamente" that sends the same
  action again, and a success says what happened. The page reloads are gone.
  The squad screen keeps the selected player's id rather than a copy, so the
  open card shows the reloaded player. The match screen is untouched: a
  finalize that loses keeps its own handling. `guarded-screens.test.tsx` (16)
  drives each screen through a refusal and a success. Not wired to any
  screen, so nothing to fix there: transfer buy/sell (the transfer market
  view makes no calls), daily reward, yield claim. Open question for the bets
  screen: it sends `predictionId: match-<week>`, which is not a uuid, so every
  bet is refused with "Invalid predictionId format" before the balance is
  touched; it needs the open prediction's id from the server, which no reply
  gives it yet.

- **CI proves the migrations.** Nothing in CI ever applied the committed
  migrations, so a broken one only showed up on someone's machine.
  `npm run db:check` (`app/scripts/check-migrations.mjs`) opens a fresh
  PGlite in a temp directory, applies every migration through the migrator,
  runs every statement of every file a second time raw and fails on the
  first that cannot be repeated, then runs `drizzle-kit generate` against a
  scratch copy of `drizzle/` (kept under `app/` with a relative `out`, since
  drizzle-kit resolves `out` as `./<out>` and an absolute path silently finds
  nothing) and fails if it would write a file, printing that SQL. Both
  failure paths were provoked and fire. The step runs in the `app-quality`
  job after the typecheck. Found while wiring it up: `npm ci` was already
  failing in CI because `package-lock.json` did not list `@electric-sql/pglite`
  (the lockfile had not been regenerated when it was added); regenerated.

- **Betting works end to end, and stays checkable.** A new save and every
  banked match leave exactly one open market on the player's next fixture,
  priced by `prediction-engine.ts` (`src/lib/fixture-markets.ts`, one row per
  player and fixture under a unique index). A bet is placed in one SQL
  statement that checks the market open, takes the stake and records the bet
  together. Kickoff (the first turn, the one-shot match, or its stream) writes
  a `fixture_kickoffs` row that fixes the fixture's seed (drawn by the server;
  the client's is ignored), the setup it is played from, and each decision
  the first time its turn is played, so an abandoned match replays as it
  went (`src/lib/fixture-kickoff.ts`). The score is written into the save in
  the same commit as the match, the market is settled against that right
  after the bank and by an hourly job as backstop (`src/lib/market-
  settlement.ts`): paying, marking and counting a bet is one statement, so a
  crash leaves it paid or untouched, never in between, and two runs cannot
  both pay it. A second season reuses rounds 1–38 under its own ids
  (`s2-round-1`). `npm run repair:betting` is the operator's tool after a bad
  deploy; `npm run test:guarantees` breaks each guarantee on purpose and
  requires the suite to go red (CI runs it nightly, see `.github/workflows/
  betting-guarantees.yml`). The README section "How a bet moves from market
  to settlement" is the map. Covered by `fixture-lifecycle`, `fixture-edge-
  cases`, `fixture-seed-integrity`, `bet-money-integrity`, `market-
  settlement`, `fixture-markets`, `predictions-bet` and `betting-repair`
  (1,200+ tests in all). Payouts, odds and how history counts are unchanged
  from before this work; what is still open is in Next items 22–28.

## Next items

1. **Nobody has checked what a hosted Neon error carries.** The logger's
   allowlist was designed against the error a real Postgres raises, but that
   was measured on PGlite only: a duplicate-key error there arrives as a
   `DrizzleQueryError` whose `cause` is the driver error carrying `code`,
   `constraint`, `table`, `detail`, `query` and `params`, and whose own
   message embeds the SQL and the bind values as text. The hosted path is
   `@neondatabase/serverless` over HTTP, which builds its errors from a JSON
   response rather than the wire protocol, so the field names, the nesting and
   whether the statement and its parameters appear at all may differ. If Neon
   names a payload field something not on the drop list, it is dropped anyway
   (the allowlist is deny-by-default, so this is not a leak), but two things
   could be wrong: an identifier we rely on for triage may be missing under a
   different name, and payload embedded in a *message* we do not know to scrub
   would survive. Provoke a constraint violation against the hosted database,
   record the error's shape here, and extend `ERROR_FIELD_ALLOWLIST` and the
   log-hygiene case to cover it. Pairs with item 5 below, which needs a real
   Neon database anyway.

2. **The store-backed tests have no budget of their own.** Opening a fresh
   embedded store costs 5.8–12.3s (measured; the second query is 1–3ms), and
   the global `testTimeout` in `src/test/setup.ts` is 10s — below that floor.
   The 8 files whose `beforeAll` opens the store already give that hook 60s
   uniformly, so setup is safe; a test that opens or *reopens* the store
   inside its own body inherits the 10s global and sits right on the floor.
   That is why `conversation-chat`'s reload case (12.3s) and log-hygiene's
   database-error case (11.2s) have each needed a hand-written 30s, and why 35
   explicit overrides have accumulated across these files. See "What to do"
   under the logging entry in Done: the recommendation is a shared
   `src/test/` helper that owns both the store fixture and the file's timeout,
   replacing the duplicated ~20-line setup in 11 files. Not done because it
   touches test infrastructure beyond the tests themselves.

3. **Fix the latent type errors behind the untyped `db`.** `db` in
   `src/db/index.ts` is `any` because typing it as the exported `Database`
   union surfaces 28 errors in 10 files. Several are runtime bugs on any real
   Postgres: `src/lib/elite-content.ts` inserts into the string
   `'tournament_tickets'` instead of the table object, it and
   `/api/tournaments/tickets` pass ISO strings to `timestamp` columns, and
   `/api/cron/expire-yields` reads `createdAt` as a string. Fix those, type
   `db`, and let the compiler keep the rest honest. None of these are in the
   onboarding-chat-match flow.

4. **Run the migrator against the real Neon database.** Nothing in the
   versioned-save work has run on Neon: the push-to-migrate hand-over, the
   `version` column, the `BEFORE UPDATE` trigger (plpgsql, which Neon has),
   `jsonb_set` in `adjustMoney`, and the `RETURNING` the guarded write relies
   on have only been exercised on PGlite, and only through the neon-http
   driver's PGlite stand-in in tests. Follow the README's first-time steps on
   the hosted database, then run the per-route race test file with
   `DATABASE_URL` pointed at a scratch Neon branch, and record the outcome
   here.

5. **Create-team should not answer 201 when the save was not written.**
   `/api/onboarding/create-team` catches both inserts, logs a warning and
   returns success anyway; the client then loads an empty save and relies on
   a one-shot retry. With a real store the branch never ran in testing, but
   it hides exactly the class of failure the mock used to hide. Return a 503
   on a failed `game_states` insert and let the client show it.

6. **Close the double-payment window in settlement.** Settlement pays a bet
   before it marks it settled, so a failed payout leaves the bet open for the
   next run (Done). The reverse remains: paid, then the mark fails, and a
   rerun pays again. A `paid_at` on `user_bets`, written by the same UPDATE
   that credits the money (an UPDATE on `game_states` cannot do that; the
   payout would move into a short plpgsql function, or settlement would set
   `paid_at` first and credit only rows where it is null), would close it.
   Related: `predictions/bet` still spans three statements with a hand-rolled
   undo because neither driver gives a transaction across them.

7b. **The bets screen has no prediction id to bet with.** `ApostasView`
   sends `predictionId: match-<week>`, which is not a uuid, so every bet is
   refused with "Invalid predictionId format" before any money moves. The
   screen now shows that refusal instead of announcing success, but it cannot
   place a real bet until it knows the open prediction's id, which no reply
   gives it. Options: (a) a lookup on `GET /api/predictions` filtered by the
   upcoming fixture (`matchId`, or home and away team plus week) returning the
   open predictions with their ids and options, which the screen fetches on
   open and uses instead of its hard-coded markets; (b) include the open
   prediction for `season.nextMatch` in the save load (`GET /api/conversation`),
   so the screen has it with no extra request; (c) let the bet route accept
   the fixture (`week`, `opponent`) and resolve the prediction itself. (a)
   keeps the save load unchanged and matches how the route is already
   shaped; (b) is one request fewer; (c) is the smallest client change but
   hides a lookup inside a write. Decide before touching the reply.

7. **Keep a match in progress across a reload.** A player who reloads or
   switches views mid-match loses it: the seed, the decisions and the chained
   state live only in `useTurnBasedMatch`'s ref, and nothing is written until
   finalize. That is safe — the save is untouched and the week can be played
   again — but it is silent, and a player who is five turns in loses twenty
   minutes with no warning. Either keep the run (seed, fixture, decisions,
   end state) in `sessionStorage` and offer to resume it, or warn before
   leaving. The server needs nothing: finalize already accepts a match whose
   turns were played in an earlier page load, as long as the fixture has not
   moved.

8. **Shared rate limiting.** `src/lib/rate-limit.ts` keeps counters in an
   in-memory `Map`, so limits reset on every cold start and are not shared
   between serverless instances. Move the counters to Postgres or another
   shared store.

9. **Server-backed asynchronous PvP challenges.**
   `docs/PHASE2_MATCH_ENGINE.md` describes a PvP async mode built on
   `runMatchSegment()`, but friend challenges in
   `src/contexts/FriendsContext.tsx` are simulated locally and stored in
   `localStorage`. Persist challenges and turns in the database and resolve
   them with the segment engine.

10. **Bring back the 3D match view.** The Three.js match view
   (`src/components/vr/*`, `/test-vr` page) was removed in commit `b788a9c`.
   `app/tests/vr.spec.ts`, which still targeted `/test-vr`, has been deleted:
   with neither the page nor the components in the tree it could only fail or
   be skipped, and rewriting it to test something else would have left a spec
   named after a view that does not exist. It is in git history if the view
   comes back. Restore a trimmed version from there behind a feature flag
   (see VR_IMMERSIVE_PLAN) and write its spec in `tests/e2e/` alongside the
   others; `/api/match` is kept partly for this (see Done).

11. **Finish the browser specs: a match, and the sign-in gate.** The
   Playwright setup and the onboarding and chat specs are done (see Done);
   two gaps are left. A full match through to the reload has been driven in a
   real browser by hand against the embedded store (six turns, finalize,
   reload) and nothing automates it — that is the spec that would catch the
   match screen breaking. And the sign-in gate needs its own spec with auth
   on, since the e2e run uses `AUTH_DISABLED=true`, under which the login
   page sends the player straight back to the game: cover a signed-out
   visitor landing on `/login` rather than in onboarding. That one needs the
   config to start a second server with auth enabled, or a project with its
   own `webServer`.

12. **Carry a pre-sign-in save over to the account, as an explicit claim.**
   A player who onboarded before signing in has a save keyed on a local id;
   signing in now starts them fresh under the session id. Add a one-time,
   user-initiated claim: when a signed-in player has no save under their
   session id and the client still holds a local id, offer "import the team
   you started before signing in?", and on yes POST the local id to a `claim`
   endpoint that re-keys `game_states.user_id` plus the matching
   `conversations` and `analytics_events` rows in one transaction. Guards: the
   claim only runs when the target account has no save and the source id was
   never claimed before — a local id is just a string in localStorage, so an
   unguarded endpoint would let anyone claim any save — and it stays
   user-initiated so the action is attributable. Decisions already made: the
   local row is kept (not deleted) after a claim, a local save never overwrites
   an existing account save (no offer is shown at all in that case), and the
   claim is allowed at any point in the season.

13. **Bound the stored conversation.** `conversation_history` on a save grows
   for ever: every exchange is appended and nothing is ever dropped. Only the
   tail goes to the model (`CONVERSATION_CONTEXT_MESSAGES`, 20), so the
   prompt is bounded, but the column is not — the `GET` the client calls on
   every load returns the whole array, the chat screen renders all of it, and
   a long-lived save makes both the load and the first paint slower and the
   row bigger, on a `jsonb` column with no pagination behind it. Decide what
   the screen should show (a window with "load earlier", most likely) and
   give the column a cap to match: trim to the last N on write, or move
   history to its own table keyed by save and paginate it. The
   `conversations` table already holds every message row for analytics, so
   the history on the save is not the only copy. Nothing here is urgent at
   today's sizes; it is a slow leak with a known shape.

14. **Try the chat against a real model key.** Everything in the chat has
   been exercised against the mock, and the live path only against a stubbed
   `fetch`: the prompt, the JSON parsing, the action filtering and the
   fallback are all covered, but no real OpenRouter key has ever been used
   from the screen. Run a session with `OPENROUTER_API_KEY` set against
   `google/gemini-2.0-flash-001` and check the things only a real model can
   show: whether it returns the JSON shape `AIResponseSchema` expects or
   trips the raw-text fallback, whether it keeps to the allowed action keys
   or has most of its suggestions filtered away, whether it respects the
   finished-season instruction, what it costs per message, and whether the
   8s client timeout in `ai-service.ts` is enough. Record the outcome here.

15. **Make a conversation message idempotent.** A send that times out on the
   client — the 25s `SEND_TIMEOUT_MS` in `useConversation.ts`, or a dropped
   connection — can still land on the server: the route goes on to call the
   model and append the exchange, while the screen has already dropped its
   optimistic message, shown "o mestre demorou demais" and handed the text
   back. A player who then retries sends the same message again, and the save
   ends up with it twice, each with its own reply. The in-flight guard
   cannot help; this one crosses the request boundary. Give the POST a
   client-generated message id, store it on the message, and have the route
   return the existing exchange instead of appending a second one when it
   sees an id it already has. The same id would also let a retry after a
   failed write (`persisted: false`) replace the lost exchange rather than
   duplicate it.

16. **The investment cards charge a different price than they show.**
   `InvestirView` renders seven products with their own prices — R$50k Clube
   de Torcedores, R$100k Marketing Digital, R$150k Campanha Redes Sociais,
   R$300k Academia de Base, R$500k Infraestrutura and two more — but
   `/api/investment` sells three tiers, A/B/C, at R$50k, R$100k and R$500k.
   The screen maps `clube_torcedores` to A, `marketing_digital` to B and
   *everything else* to C, so five of the seven cards charge R$500,000
   whatever price is printed on them: a player who buys the R$150k social
   media campaign is debited R$500k and given tier C's yield and lock. This
   only started taking real money when the route was fixed to actually charge
   (see the entry in Done), which makes it urgent rather than cosmetic. Needs
   a product decision first — either `INVESTMENT_TIERS` grows to cover the
   seven products, or the screen shrinks to the three that exist — and the
   card's `cost` and the tier's `amount` should then come from one place so
   they cannot drift again.

17. **The active investments list is always empty.** `InvestirView` has
   `const activeInvestments: any[] = []` hardcoded, and renders its count in
   the header, so the screen reports "Investimentos Ativos: 0" however many
   the player holds. `GET /api/investment` already returns exactly what it
   needs (`{ investments, activeCount }`, filtered to `active: true`), and
   `FanClubInvestmentCard` already takes an `activeInvestments` prop and
   renders them. Nothing fetches it. Until now the list was empty in the
   database too, so the bug was invisible; investments persist as of the
   entry in Done, so the screen is now wrong about stored state. Fetch the
   list on mount, reload it after a successful investment, and delete the
   `any[]`.

18. **(Done — see "Betting works end to end" under Done.)** Markets are
   opened for the player's next fixture on every new save and every banked
   match, and settled against the banked result. The placeholder
   `POST /api/predictions` still answers its old message and should go.

19. **An investment never stops paying out.** `fan_club_investments.active`
   is set true when the investment is made and nothing anywhere sets it
   false; `unlockDate` is written and never read again. `/api/cron/daily-yield`
   pays every row with `active: true`, so a R$50,000 tier-A investment with a
   three-day lock generates R$10,000 a day forever. The schedule is real —
   `app/vercel.json` has both cron entries, daily-yield at 01:00 and
   expire-yields at 02:00, and Vercel sends the `CRON_SECRET` bearer the gate
   wants — so this runs in production the moment anything is deployed. It was
   invisible while no investment ever persisted; the entry in Done changed
   that, which makes this the most expensive of the five findings. The lock
   period needs to end the investment: either sweep `active: false` where
   `unlockDate < now()` (expire-yields is the obvious home, and it already
   runs an hour later), or have daily-yield skip and close out matured rows
   as it walks them. Note the related bug in the typing item above:
   `/api/cron/expire-yields` reads `createdAt` as a string, which no real
   Postgres returns.

20. **Nothing uses the match stream hook.** `src/hooks/useMatchStream.ts`
   has no importer — it fed the 3D match view that was removed — so its
   error handling, its abort controller and the `error` it exposes reach
   nobody. `/api/match/stream` is in the same position: the route is live,
   tested and seeded, and no screen calls it. Both should go the same way as
   the 3D view item above: if that view comes back they are the start of it,
   and if it does not, they are two files and a route's worth of surface
   that is maintained and never run. Decide with item 10.

21. **The save migration is skipped on the load right after onboarding.**
   Every browser-test run logs exactly one
   `{"route":"squad-migrate","status":400,"reason":"body_invalid_json"}`, and
   always on the load that follows onboarding's `router.push('/')` — not on
   an ordinary load and not on the reload the chat spec does. `useGameState`
   fires that POST with `body: JSON.stringify({ userId })` and a guaranteed
   non-empty `userId`, so the body it builds is valid; the server sees no
   body at all, which `readJsonBody` reports as invalid JSON. The likeliest
   mechanism is the request being cancelled as the page that fired it goes
   away — it is sent from an effect, not awaited, and nothing holds the
   navigation for it — but that has not been confirmed. The consequence is
   certain either way: the `.catch(() => {})` around it swallows the 400, and
   its comment ("migration will happen on next action") is wrong, because
   nothing else calls that route. A save needing migration just does not get
   migrated on that one load; the next load picks it up. Worth either
   awaiting it before the redirect, moving it server-side into create-team,
   or at minimum logging the failure instead of discarding it. Found while
   running the CI steps for the request-body work, not by a failing test —
   nothing asserts on this line.

22. **Held bets have no operator screen.** A winning bet the previous
   settlement code left claimed is never paid or written off automatically:
   nobody can tell from the database whether that run paid it. The job lists
   them as `needsReview`, `npm run repair:betting` names them, the bets screen
   shows "Em análise", and `POST /api/predictions/resolve { betId,
   paidByOldRun }` with the admin secret settles one. That answer has to come
   from the logs of the run that died or from the player, and there is no
   screen for it, only the route. Such bets can only exist if that code ran
   in production between two deploys (it was never committed); if it never
   did, the whole path can be deleted. Likewise a round banked without a
   stored score (saves from before scores were kept): the repair tool reports
   it, but there is no route to void the bets and refund the stakes.

23. **The training-speed bonus does nothing for most of a squad.** The gain a
   session gives is `floor((base + rand·base) · speed)` capped at
   `ceil(3·speed)`, and for a player rated 75 or more the +20% from
   `staff_esportivo` rounds to the same integer as no bonus (75–79: 3 and 3,
   80–84: 2 and 2, 85 and up: the minimum of 1 both times). Found while
   chasing a flaky test (`investment-journey` measured `players[0]`, whose
   rating is rolled at onboarding; it now pins that player to 70). A gameplay
   decision: either the bonus should move a whole-number gain at every
   rating, or its description should say who it helps.

24. **The hourly settlement job may not run on the hosting plan.**
   `vercel.json` schedules `/api/predictions/settle` at 30 past every hour.
   Vercel's Hobby plan allows cron jobs once a day at most; on that plan the
   schedule is refused at deploy or silently coarsened. Settlement at bank
   time does not depend on it, the job is the backstop for a payout that
   failed after a commit, so a daily schedule is acceptable; decide and set
   it. The two existing yield crons are already daily.

25. **The stake slider on the bets screen.** A selection keeps the stake from
   the moment it was clicked, so moving the slider afterwards changes the
   number shown but not what is sent nor the "Retorno" line; and with less
   than R$10.000 the slider's maximum falls below its minimum. Also betting
   on all three outcomes of one market is allowed (the tests use it to get a
   guaranteed winner); whether the odds' margin makes that a loss for the
   player has not been checked.

26. **`seed` is still a required field on `/api/match/finalize`.** Every
   match route ignores the seed the client sends (the fixture is played under
   the one its kickoff drew) but the finalize schema still requires one, so
   the match hook keeps drawing and sending a seed nobody reads. Make it
   optional, then drop it from the hook, then from the schemas, in that
   order so old clients keep working.

27. **The concurrency guarantees are assumed on the hosted database.** The
   embedded store is one connection, so the tests that run the bank and the
   settlement job "at the same moment" interleave at awaits rather than in
   parallel transactions. The one-statement bet placement (a `FOR SHARE` lock
   on the market while the stake is taken) and the one-statement settlement
   rely on Postgres row locking and statement atomicity, which PGlite shares
   but has not been exercised under real concurrency. Pairs with item 1:
   run the lifecycle suites once against a Neon branch, with two connections.

28. **Mid-match players at a deploy of the kickoff change.** A player who was
   mid-match when `fixture_kickoffs` went live watched their first turns
   under their own seed; finalize refuses that match (score mismatch) and
   the screen now tells them to play it again, which banks the server's
   replay. Their bets are unaffected. If that deploy has already happened
   this item is moot; otherwise deploy at a quiet hour.
