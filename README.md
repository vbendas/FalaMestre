# Fala Mestre!

Fala Mestre! is a football-manager game you play by chatting with an AI
assistant. You create a fictional club, then manage the squad, transfers,
stadium, youth academy and staff, and play turn-based matches with live
narration, mostly by typing what you want in plain language. The game UI and
the assistant speak Brazilian Portuguese.

It is aimed at football fans who like management games but don't want
spreadsheet-heavy menus, and at developers interested in combining a
deterministic game engine with an LLM front end.

Fala Mestre! is a standalone game. All clubs and players are fictional, and it
has no crypto or ad-platform integrations.

## Status

Solo project. Development paused in mid-2026 and is now resuming. See
[ROADMAP.md](ROADMAP.md) for what is done and what comes next. The unit
tests, typecheck and lint are green as of October 2026.

## Stack

From `app/package.json`:

- Next.js 16 (App Router), React 19, TypeScript 5
- Tailwind CSS 4, Radix UI primitives, Framer Motion, lucide-react, lottie-react
- Drizzle ORM + drizzle-kit, on Neon serverless Postgres when hosted and on
  [PGlite](https://pglite.dev) (embedded Postgres) with no configuration
- next-auth 4 (Google provider, JWT sessions)
- Zod for request validation
- LLM calls over HTTP to [OpenRouter](https://openrouter.ai) (default model
  `google/gemini-2.0-flash-001`), with a built-in mock mode
- Vitest + Testing Library (jsdom) for unit tests, Playwright for browser checks
- Bun as the package manager and dev runner (npm also works; CI uses `npm ci`)

## Repository layout

```
app/                Next.js application (all runtime code lives here)
  src/app/          pages and API routes (/api/conversation, /api/match/*, ...)
  src/components/   UI components (game views, CRT-style layout, modals)
  src/lib/          game engine, decision engine, commentary, AI service
  src/db/           Drizzle schema, database client, embedded local store
  drizzle/          committed SQL migrations (the schema's source of truth on disk)
  tests/e2e/        Playwright browser specs
Documentation/      design docs (game design, UX, architecture, phase plans)
docs/               engineering notes, game mechanics, LLM strategy, diagrams
  plans/            implementation plans (decision UI, VR view, UX)
  status/           point-in-time status reports
Screens/            static HTML mockups of the main screens
  scripts/          checks CI runs on their own (migrations, body schemas), the
                    betting repair tool and the guarantee break check
scripts/            ad-hoc Playwright scripts for screenshots and smoke checks
PRD.md              product requirements document
ROADMAP.md          next items
```

## Running locally

Requirements: [Bun](https://bun.sh) 1.x (or Node.js 20+ with npm).

```bash
cd app
bun install                 # or: npm ci
cp .env.example .env.local
bun run dev                 # http://localhost:3001
```

That is enough to play. With nothing else configured the server runs on an
embedded Postgres ([PGlite](https://pglite.dev)) stored under
`app/.data/pglite`, the assistant answers from its built-in mock, and the
only thing to set in `.env.local` is `AUTH_DISABLED=true` so the game skips
Google sign-in. Saves persist across restarts; delete the `.data` directory
to start over. `app/.env.example` lists every variable the code reads, with a
line on each.

- **Database.** When `DATABASE_URL` is unset the server uses the embedded
  Postgres above, behind the same Drizzle schema as the hosted database. When
  it is set, the server uses that Postgres through the Neon serverless driver
  (a free Neon project is the simplest option). Both get their schema from the
  committed migrations in `app/drizzle/`: the local store applies them itself
  on startup, the hosted database through `bun run db:migrate`. The embedded
  store is single-process, so two servers on one checkout need different
  `PGLITE_DATA_DIR` values.
- **LLM mock mode.** If `OPENROUTER_API_KEY` is not set, or `USE_MOCK_AI=true`,
  the assistant answers with built-in canned responses, so you can play
  without an API key.
- **Auth.** Sign-in uses Google OAuth through next-auth. For local play
  without OAuth credentials, set `AUTH_DISABLED=true`.

## Talking to the assistant

The **MESTRE** screen is the conversation. It opens on everything said so
far — the save keeps the whole history, so a reload shows it again — and each
message goes to `POST /api/conversation`, which answers from the live model or
the built-in mock and appends both the message and the reply.

**With no API key the chat works in full.** When `OPENROUTER_API_KEY` is unset
(or `USE_MOCK_AI=true`), every reply comes from the built-in mock: canned
wording chosen by intent, filled in from the save — the squad, the budget, the
table, the next fixture — and carrying the same suggested actions a live reply
would. Nothing is sent anywhere, and nothing about the screen changes, so the
whole feature can be tried, developed and tested without an account. Each
reply says where it came from in `source`: `mock` (the mode the game is in),
`model` (the live model), or `fallback` — see below. The reply's
suggested actions appear as chips under it, each one a shortcut to the screen
it names. Those suggestions follow the reply and the save: they come from the
catalogue in `src/lib/assistant-actions.ts`, which is what the mock picks
from, what the live model is told it may use, and what a model's answer is
filtered back against — so a chip is always a screen that exists and an
action the save can take right now. Once a season is finished there is no
fixture (`season.nextMatch` holds a placeholder), so the assistant says the
campaign is over and offers the final table instead of a match.

A reply the built-in mock gave in place of a live model that failed is marked
`source: "fallback"` and labelled on screen; the mark is stored with the
message, so it is still there after a reload. If the exchange cannot be
written to the save, the reply still comes back but with `persisted: false`,
and the screen says so rather than showing an answer that disappears on the
next load. A message from a user with no save is refused with 404 `no_save`:
saves are created in onboarding and nowhere else. Messages are capped at 2000 characters and the route rate-limits to
60 a minute; when the assistant cannot answer, the screen says so and hands
the player's text back rather than leaving them waiting.

Talking never changes the game: the route writes only the conversation, so a
chat in one tab cannot undo a match banked in another. Only the tail of a long
conversation is replayed to the model (`CONVERSATION_CONTEXT_MESSAGES`), which
is what bounds the prompt.

## How a match is played and saved

A match is six decision turns. The match screen shows a prompt (kick-off,
15', 30', half time, 60', 75'), the player picks an option or lets the 30s
clock pick the context-aware default, and the fifteen minutes that follow are
simulated and played back. Each turn goes to `POST /api/match/decide`, which
simulates that segment and **saves nothing**.

The match is banked at full time by `POST /api/match/finalize`. The screen
sends the match seed, the fixture it started from (`week`, `opponent`,
`isHome`), the six decisions as option ids, and the score it watched. The
server does not take that score: it replays all six turns itself from the
seed and the decisions and uses the score it computes, then runs the
post-match bookkeeping — points, record, week, gate receipts, staff wages,
morale, league position and next week's fixture. The result modal shows what
finalize returned, and a reload lands on the next week.

Two things make the replay land on the same football the player watched. One
match seed is drawn at kick-off, and each turn is played under
`deriveTurnSeed(matchSeed, turnNumber)` (`"<seed>:turn:<n>"`), which finalize
re-derives from the match seed alone. And a turn is played in exactly one
place — `playDecisionTurn` in `app/src/lib/match-replay.ts` — which both the
live route and the replay call, so the two cannot drift. A decision is
accepted only if its id is one the server itself would have offered for the
state the replay has reached, so a tactic that was never on the menu cannot
be submitted.

What the server refuses: a fixture that is not the one the save is waiting on
(which is what stops a match counting twice), a score that disagrees with the
replay, a decision list that is not all six turns in order, and any match at
all once the season's 38 rounds are over. A refusal tells the player the
match did not count rather than showing a saved-looking result; the screen
re-reads the save, and offers to send the same match again when the failure
was the kind that might not recur (a dropped connection, a failed write).
Finalize's write is guarded on the save's version (next section), so two tabs
finishing at once cannot both bank a match, and a training session that landed
during the replay is not erased by it. A finalize that loses is told whether
the fixture itself moved on (another tab banked it: "Fixture mismatch", with
the new fixture) or only the save did (anything else was written: the generic
conflict, and the same match can be finalized again).

When the last round is banked the season closes: the save gets a
`Temporada Completa` placeholder instead of a fixture and the match screen
shows the final campaign rather than a play button. Starting a new season is
not implemented yet.

Two other match routes exist and the game does not call either.
`POST /api/match` plays a whole match in one request with its own simulation,
and is kept as the engine's reference implementation — it is what the
determinism and concurrency tests replay, and the only path that produces the
AI narration and the visual match script. `POST /api/match/stream` streams a
simulation over SSE and writes nothing. Both are documented at the top of
their route files.

## How a save write is guarded

Every route that changes the game does it the same way: load the whole save
(`game_states.current_state`, one JSON document per player), change it in
memory, write it back. Two of those overlapping on one save used to lose one
of them silently: train a player while a match was being banked and whichever
wrote second reverted the other, with both callers told their action counted.

`game_states.version` closes that. It is an integer that goes up by one on
every write that changes `current_state`, and the shared module
`app/src/lib/save-store.ts` offers three ways to write, chosen by what kind
of writer a route is:

- **Load and guarded commit, refused on a lost race.** `loadSave` returns the
  save with its version; `commitSave` writes it back with
  `WHERE user_id = $1 AND version = $2`, bumps the version, and reports the
  rows it changed. No row means something else wrote the save in between, and
  the route answers **409 `Save conflict`**: nothing was written, reload and
  try again. This is every route a player drives by pressing a button:
  `squad/train`, `squad/formation`, `transfer/buy`, `transfer/sell`, `staff`
  (hire and fire), `youth` (intake, sign, reject, focus), `daily-reward`,
  `stadium/upgrade`, `facilities/upgrade`, `match` (the whole-match
  simulation) and `match/finalize`.
- **An increment inside the UPDATE, never refused.** `adjustMoney` changes
  `user.money` by a delta with a `jsonb_set` computed from the row at the
  instant of the write, with an optional floor so a debit cannot overdraw
  even against another debit. It reads nothing, so it has nothing to conflict
  with, and whatever the player was doing at that moment is left intact under
  it. This is the writers that only move money and have no player waiting to
  retry: `predictions/bet` (the stake, floor 0, and the refund on its undo
  path), `predictions/settle` (pays every winning bettor in one pass) and
  `investment/claim` (the yields are already marked claimed when the money
  moves, so a refusal would lose it).
- **Load, revise, commit, retrying.** `reviseSave`
  (`app/src/lib/save-revise.ts`) reloads and tries again, three times, when
  the commit loses. Only `squad/migrate` uses it: the migration of a save's
  shape fills in missing fields and is safe to repeat, so a retry is right
  where a 409 would just make the client retry. The per-player call answers
  409 only after all three attempts; the batch run over every save skips the
  one that keeps moving and reports it under `conflicts`.

A trigger (`drizzle/0001_game_state_version.sql`) also bumps the version on
any UPDATE that changes `current_state` without going through those helpers,
so a hand-run fix or a route added later without them still cannot be
overwritten by a stale guarded write. The two UPDATEs on the table that do not
touch `current_state` are the chat-history append in `/api/conversation`
(a SQL concatenation on `conversation_history`) and the insert in
`onboarding/create-team`, which makes a new row at version 1.

**What the player sees when a write loses.** Every screen that calls one of
these routes goes through `useGuardedAction` (`app/src/hooks/useGuardedAction.ts`):
the reply is read, the save is reloaded from the server after every reply so
the screen shows what is really stored, and a refusal is shown in place with
its reason and a "Tentar novamente" that sends the same action against the
fresh save. A success says what happened. Training shows this inside the open
player card; staff, facilities, stadium, youth and the formation picker show
it above their content; the bets screen stops at the first refused bet and
keeps the selection for the retry. The match screen keeps its own handling
of a finalize that loses: "A partida não contou", re-read the save, and a
retry where the failure might not recur.

Proof: `app/src/app/api/__tests__/save-race-per-route.test.ts` makes every
writer lose a race against the embedded Postgres (a training session lands
the moment the route has read the save) and checks the training is still
there afterwards; run against the routes as they were before the version
column, 22 of its 23 cases fail on the lost update itself.
`save-version-concurrency.test.ts` covers the primitives, the trigger and the
migration; `src/components/game/__tests__/guarded-screens.test.tsx` covers
what each screen shows.

**Still open.** None of this has run on Neon yet; the version migration
and the trigger have only been applied to PGlite (see ROADMAP item 5).
Settlement now pays before it marks a bet settled, so a failed payout leaves
the bet open for the next run, but the reverse window remains: paid, then the
mark fails, pays twice on a rerun. `predictions/bet` still spans three
statements with a hand-rolled undo, since neither driver offers a transaction
across them. The bets screen cannot place a real bet: it has no way to learn
the open prediction's id (ROADMAP).

## How a bet moves from market to settlement

For contributors touching betting. Everything below runs on the server; the
client only ever asks for the board, places a bet and plays the match.

1. **Market.** `src/lib/fixture-markets.ts` opens one market on the fixture a
   save is waiting on: when the save is created, every time a match is
   banked, and as a backstop whenever the bets screen reads the board
   (`GET /api/predictions`). A market is one row in `predictions` keyed on
   the player and the fixture (`round-3`, `s2-round-3` from the second season
   on), under a unique index, so opening is idempotent from anywhere. The
   odds come from `src/lib/prediction-engine.ts` at that moment and do not
   move afterwards.
2. **Bet.** `POST /api/predictions/bet` places a bet in one SQL statement:
   the market is checked open (and still the save's current fixture) under a
   `FOR SHARE` lock, the stake comes off the balance as an increment refused
   below zero, the bet row is written and the player's history counts it.
   All of it or none of it.
3. **Kickoff.** The first time the server plays any of the fixture, a
   decision turn (`/api/match/decide`), the one-shot match (`/api/match`),
   its stream, or a finalize with no turns, `src/lib/fixture-kickoff.ts`
   writes a `fixture_kickoffs` row and closes the market in the same
   statement. The row holds the fixture's seed (drawn by the server from
   `crypto`; whatever seed the client sends is ignored and never echoed), the
   mode, the squad, formation and morale the match is played from, and each
   decision the first time its turn is played. Every later turn, replay and
   bank reads from that row, so an abandoned match plays again as it went
   and finalize banks what was watched.
4. **Bank.** `/api/match/finalize` (or `/api/match`) replays the match from
   the kickoff row, runs the bookkeeping, writes the score into the save
   (`season.results`) in the same commit as the match, and only then settles.
5. **Settlement.** `src/lib/market-settlement.ts` copies the score onto the
   market and settles it: for each unsettled bet, one statement marks it
   settled, credits its promised return if its option won (nothing
   otherwise) and updates the player's history, in the order the bets were
   placed. Only an unsettled bet matches that statement, so a second run,
   or two at once, pay nobody twice; a crash leaves a bet paid or untouched,
   never in between. It runs right after the bank, and `GET
   /api/predictions/settle` (the cron job, cron secret, no session) is the
   backstop for anything the bank-time run left. `POST` on the same route
   settles one market for an operator and refuses a score that disagrees
   with the banked one.

**Where the money rules live.** The stake and payout statements are the two
`db.execute` blocks in `src/app/api/predictions/bet/route.ts` and
`settleBet` in `src/lib/market-settlement.ts`; the balance itself is only
ever changed as an increment on `game_states.current_state` (see
`adjustMoney` in `src/lib/save-store.ts` and "How a save write is guarded").
Odds and potential returns: `src/lib/prediction-engine.ts` and
`PREDICTION_MARKET` in `src/lib/constants.ts`. History (streaks, expert
level): the `counted` part of `settleBet`. The invariant every lifecycle test
checks, from the tables alone, is

    money = starting money − Σ stakes + Σ payouts + match earnings − wages

with every settled bet paid its `potential_win` if its option won and 0 if
not. `src/test/journey.ts` is the helper that drives one player through all
of this against the embedded database; start from
`src/app/api/__tests__/fixture-lifecycle.test.ts` to see the whole story.

**The repair tool.** After a bad deploy or an outage:

```bash
cd app
npm run repair:betting            # report only; exit 1 if something needs a person
npm run repair:betting -- --fix   # also repair what can be repaired safely
npm run repair:betting -- --json  # the report as JSON
```

It uses `DATABASE_URL` from the environment or `.env.local` (the hosted
database), else the embedded store. It finds saves whose current fixture has
no market, markets with a result whose bets are not settled, winning bets
held for an operator, and rounds banked without a stored score, and says what
it would do about each. `--fix` opens the missing markets and settles the
settleable markets, through the same functions the routes use. It never pays
a held winner (that is `POST /api/predictions/resolve` with the admin secret,
after a person has found out whether the old run paid it) and never invents
a score. Running it again straight after changes nothing. Source:
`src/lib/betting-repair.ts`.

**The break check.** `src/app/api/__tests__/` has the tests; `npm run
test:guarantees` is what proves they still bite. It breaks each guarantee
(payout and mark in one step, one payout per bet, the kickoff close, the
server's seed, a replayed turn, the second season, ...) in a copy of the
code and requires the covering suites to go red, printing which tests
caught it. `-- --list` names the breaks; `-- <name>` runs one. It takes
about twenty minutes for all seventeen, so CI runs it nightly and on pull
requests that touch the betting files (`.github/workflows/
betting-guarantees.yml`), in four parallel shards, with an annotation naming
any guarantee no longer caught. When you add a guarantee, add its break to
`scripts/break-guarantees.mjs`; when you move code, the script fails saying
the break no longer applies rather than quietly testing nothing.

## Database migrations

The schema lives in `app/src/db/schema.ts`; the SQL that puts it on a
database lives in `app/drizzle/` and is generated from it. Changing the
schema:

```bash
cd app
# 1. edit src/db/schema.ts
bun run db:generate        # writes drizzle/000N_<name>.sql from the diff; no database needed
# 2. read the generated SQL (a rename comes out as drop + add unless you
#    answer drizzle-kit's rename prompt), then commit schema.ts and drizzle/ together
bun run db:migrate         # hosted: applies the new files to DATABASE_URL
```

The local store needs no step: the next `bun run dev` applies any migration
the directory has not seen. Never edit a migration file after it has been
applied anywhere: the migrator only runs files newer than the last one it
recorded, so an edit would silently reach only databases that had not applied
that file yet and the two would drift.

Write every migration so it is safe to run twice (`IF NOT EXISTS`,
`CREATE OR REPLACE`, `DROP ... IF EXISTS` before `CREATE`), the way the
baseline and `0001_game_state_version.sql` are. `bun run db:check`
(`app/scripts/check-migrations.mjs`) proves the folder on a fresh embedded
Postgres with no database configured: it applies every migration from
nothing through the migrator, runs every statement of every file a second
time on that database and fails on the first one that cannot be repeated,
and runs `drizzle-kit generate` against a scratch copy to fail if
`schema.ts` has a change no committed migration covers, printing the SQL it
would have written. CI runs it on every push, before the tests.

**Moving an existing Neon database from `db:push` to migrations.** Before
migrations were committed, hosted databases were set up with
`bun run db:push`, which creates tables directly with no record of what ran.
The baseline migration `drizzle/0000_baseline.sql` is written for that case:
every statement is `CREATE TABLE IF NOT EXISTS`, so on a database that already
has the tables it changes nothing and only records itself in
`drizzle.__drizzle_migrations`. The first time on such a database:

1. Run `bun run db:push` once more with `DATABASE_URL` set and confirm it
   reports nothing to do. If it lists changes, the database was pushed from a
   different schema than the one in git; apply or reconcile them first, since
   `IF NOT EXISTS` skips a table that exists with different columns rather
   than fixing it.
2. Run `bun run db:migrate`. It applies the baseline as a no-op and any later
   migrations for real.
3. From then on use only `db:migrate` on that database. `db:push` still
   works but applies changes the journal does not know about, so treat it as
   a diagnostic (step 1), not a deploy step.

`bun run db:studio` browses whichever database `DATABASE_URL` points at.

## Adding a route that takes a body

Every API route that reads a request body reads it the same way, and the
check is enforced: `npm run check:bodies` is a CI step of its own, and two
tests in the suite assert the same thing. Four steps.

**1. Put the schema in `app/src/lib/validations.ts`.** Zod, alongside the
others. Give every field a message that names it, because that message is
what the player's screen shows:

```ts
export const widgetRequestSchema = z.object({
  userId: userIdSchema,
  widgetType: z.enum(['round', 'square'], {
    error: 'widgetType must be one of: round, square',
  }),
  quantity: z.number({ error: 'quantity must be a number' })
    .int('quantity must be a whole number')
    .positive('quantity must be greater than 0'),
});
```

Use `userIdSchema` for a required id and `userIdSchema.optional()` where the
route falls back to the session. Where the body's shape depends on one field
— a hire that needs a tier and a firing that does not — use
`z.discriminatedUnion`, as `staffRequestSchema` and `youthRequestSchema` do;
the refusal then names the field that is missing from *that* variant.

**2. Read the body with `ctx.readBody(schema)`.** It is the only way in. One
call does the size cap, the JSON parse, the plain-object check and the
schema, and hands back a value typed from the schema — no cast, and nothing
left to check by hand:

```ts
export const POST = withApiRoute('widget', async (request, { log, readBody }) => {
  const authError = await requireAuth();
  if (authError) return authError;

  const bodyResult = await readBody(widgetRequestSchema);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }
  const { userId, widgetType, quantity } = bodyResult.body;
  // ...
});
```

Read it where the route's other checks want it: `readBody` is a method rather
than something the wrapper does up front precisely so each route keeps its own
order of auth, secret and body checks.

A body that fails the schema is refused for you — **400** with
`{ error: 'Validation failed', message, field }`, `field` being the dotted
path (`player.pac`, `priorState.squad.3.pac`) — and the refusal is recorded as
`body_failed_schema` on the request's summary log line. You do not write any
of that. Do not add your own "is this field missing" checks afterwards; if the
schema does not express it, extend the schema.

If your route goes on to run a simulation or call the model, give it
`parseTimeoutMs` so a client that opens a request and stalls cannot hold it
open — see `BODY_OPTIONS` in `app/src/app/api/match/decide/route.ts`.

**3. Add a block to `app/src/app/api/__tests__/route-body-contract.test.ts`.**
Two tests, copying the nearest existing block: one body the schema refuses,
through `expectRefused(await refusalFrom(...), 'quantity')`, and the body the
screen really sends, asserting what it *did* — the row that landed, the money
that moved — not just a 200. A 200 does not notice a route that parsed the
body and then acted on nothing.

**4. Show the player the message, not the label.** On the client, go through
`useGuardedAction` (`app/src/hooks/useGuardedAction.ts`) like every other
screen that writes. It reads `message` ahead of `error`, so a refusal arrives
as "quantity must be greater than 0" rather than the bare "Validation failed",
and it reloads the save and offers a retry. If you are not using the hook,
read `message` first yourself.

### What fails if you skip a step

| Skipped | What goes red |
| --- | --- |
| Reading the body any other way (`request.json()`, `readJsonBody`, `readJson`) | `npm run check:bodies` — the **Check request body schemas** CI step, naming your route and the call to replace. Also `body-schema.test.ts > is the only way a route reads a body`. |
| No block in the contract tests | The same CI step, telling you which `describe` to add. Also `route-body-contract.test.ts > coverage`. |
| A field with no message naming it | `body-schema.test.ts > always says something, and always names the field in it`. (`validateBody` prefixes the path onto a message that does not mention the field, so the reply is still usable — but write the sentence.) |
| An answer that is not the shared shape | `body-schema.test.ts > answers in the same three keys whichever route it was`. |
| A route reading a body but not in the 22 | the counts in `body-limit.test.ts > covers every route that reads a body through the wrapper`. |

Run `npm run check:bodies` before pushing; it takes about a second and needs
no database.

## Tests

```bash
cd app
npx vitest run       # unit, API-route and component tests (or: bun run test:run)
npx tsc --noEmit     # typecheck
bun run lint         # ESLint
npm run check:bodies # every body route goes through a schema (CI step of its own)
bun run test:e2e     # browser tests (or: npx playwright test)
npm run test:guarantees  # break each betting guarantee, require red (nightly in CI, ~20 min)
npm run repair:betting   # the operator's betting repair tool (report only without --fix)
```

`bun run test:run` is the bulk of it: unit tests, the API routes against a real
embedded Postgres, and jsdom component tests.

`bun run test:e2e` runs the Playwright specs in `app/tests/e2e/` against the
real app in Chromium, and takes about ten seconds. It needs no setup and no
running server: Playwright starts `next dev` itself (on a per-run port,
`E2E_PORT` to pin it), on a throwaway embedded store in a temporary directory
that is deleted afterwards, with the assistant in mock mode and auth disabled,
and with `DATABASE_URL` and `OPENROUTER_API_KEY` forced empty so a developer's
own `.env.local` cannot send the run at a real database or a real model. The
conversation spec asserts the reply came back `source: "mock"`, which only
holds if no live model was called. First run on a machine needs the browser:
`npx playwright install chromium`.

These cover what only a real browser can catch — onboarding, a conversation
surviving a reload, and a fast double Enter sending one message rather than
two (jsdom flushes React between events and never sees it). Both suites run on
every push; see `.github/workflows/ci.yml`.

The scripts in `scripts/` drive a running dev server with Playwright, for
example `node scripts/capture-screenshots.mjs` from the repository root
(install the root dev dependency first with `npm install`).

## Logs

For whoever is on call. The server writes one JSON object per line, nothing
else, and every line carries the ID of the request that caused it.

```json
{"time":"2026-10-30T22:11:12.056Z","level":"info","route":"match","requestId":"5b1c…","message":"Request completed","method":"POST","status":200,"durationMs":611}
```

The envelope is always `time`, `level`, `route`, `requestId`, `message`; the
rest are fields the line adds. Lines from library code (`src/lib`, `src/db`)
also carry `scope`, naming the module.

**Following one request.** Every request ends with exactly one line whose
`message` is `Request completed`, carrying `method`, `status` and
`durationMs`. Grep the `requestId` to get everything that request wrote, in
order, including the lines from the storage layer and the AI client it
called. A refused request's summary is at `warn` and has a `reason`:
`unauthorized`, `rate_limited` (with `retryAfterSeconds`), `body_too_large`,
`body_invalid_json`, `body_not_object`, or the route's own error text. A
server error leaves two lines under the same ID: the route's own line with
the stack, then the summary at `error`. A streaming response (`match-stream`)
reports when the stream settles, with `stream: completed|failed|cancelled`
and the whole duration. A client may send `x-request-id` (letters, digits,
`_`, `-`, up to 64 chars) to join a trace started upstream; otherwise a UUID
is generated. Lines written outside any request — a startup or a background
monitor — carry `route: "process"` and `requestId: "no-request"`.

**Levels.** `error` for something the server could not do and someone should
look at: a 500, a failed upstream call, a stream that died. `warn` for a
request turned away on purpose or a fallback taken: a 4xx, a rate limit, a
model reply that could not be used. `info` for one summary per request and
the few lines that mark real work: the embedded store opening, a match
settled. `debug` for per-match detail nobody reads unless chasing something:
formation mapping, memory monitor samples.

**Changing the level.** `LOG_LEVEL=debug|info|warn|error` (default `info`),
read at startup; see `app/.env.example`. There is no per-request override.

**Reading an error line: why the SQL is missing.** An error is logged as
`name`, `message`, `stack` and `cause`. Any *other* property the error carries
is dropped unless it is on the allowlist in `src/lib/logger.ts`
(`ERROR_FIELD_ALLOWLIST`: `code`, `status`, `statusCode`, `severity`,
`constraint`, `table`, `schema`, `routine`), and even then only when its value
is a number, a boolean, or a string of at most 200 characters.

This is why a database error gives you `code`, `constraint` and `table` but
not the statement. A Postgres error carries the failing SQL as `query` and its
bind values as `params`, and the routes write a whole save as one jsonb
parameter — logging it whole put a player's entire game state on one 25KB
line. Those fields are gone on purpose, and because drizzle also embeds the
SQL and the bind values as text in its own `message`, the content of a dropped
property is removed from the `message` and `stack` too, leaving
`[redacted:params]` where it appeared.

Nothing is dropped silently. The names of the dropped fields are listed in
`errorFieldsDropped` on the same line, so a line tells you what it is not
showing:

```json
{"level":"error","route":"squad-train","requestId":"r1","message":"API error","error":{
  "name":"Error",
  "message":"Failed query: [redacted:query]\nparams: u1,T,[redacted:params]",
  "errorFieldsDropped":["query","params"],
  "cause":{"name":"error","message":"duplicate key value violates unique constraint \"game_states_pkey\"",
    "code":"23505","severity":"ERROR","constraint":"game_states_pkey","table":"game_states",
    "schema":"public","routine":"_bt_check_unique",
    "errorFieldsDropped":["length","detail","file","line","query","params","queryOptions"]}}}
```

To triage from that: `code` and `constraint` on the `cause` identify the
failure, `table` says where, and the `requestId` gets you the rest of the
request. If you need the statement, run the route locally — it is not
recoverable from the log by design.

One limit worth knowing: only payload strings of 16 characters or more are
removed from a `message`. Short bind values survive, which is why `u1,T` is
still visible above — a user id and a team name, both of which the line
carries elsewhere anyway. A large value, which is the one that matters, is
always redacted.

**Adding a field to your own error.** Attaching a property to an error is not
enough; it will be dropped and its name will appear in `errorFieldsDropped`.
To have it show up, either add its name to `ERROR_FIELD_ALLOWLIST` in
`src/lib/logger.ts` — appropriate only for a short identifier, never for
anything derived from a request body, a model reply or a database row — or,
better, pass it as a field of its own on the log call, where it is not subject
to the allowlist:

```ts
log.error('Could not settle the match', { error, fixtureWeek, attempt });
```

A field passed this way is still run through the secret scrub below, so prefer
it for anything you actually want to read on call.

**The secret scrub.** The values of `OPENROUTER_API_KEY`, `NEXTAUTH_SECRET`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CRON_SECRET`, `ADMIN_SECRET` and
`DATABASE_URL` — plus the `DATABASE_URL` password on its own, so a line
quoting only part of the connection string is still clean — are replaced with
`[redacted:NAME]` wherever they appear in any string the logger writes,
including an error's `message` and `stack`. Only those values are matched, not
every setting: `LOG_LEVEL=info` does not redact the word "info". A value under
8 characters is left alone rather than mangling unrelated text, so a secret
that short would not be protected — don't use one.

**What a line never carries.** The player's message or anything else from a
request body beyond what explains a refusal, the system prompt, an upstream
error body or a model reply verbatim, and no secret. The route sweep
(`src/app/api/__tests__/route-sweep.test.ts`) runs every route with fake
secrets and a reflecting upstream and fails if any of them, or the message it
sent as the player, appears anywhere in the output. Server code may not call
`console` directly; `no-console` is a lint error under `src/app/api`,
`src/lib` and `src/db`. Go through `getLogger(scope)` from
`src/lib/request-context.ts` instead.

## License

[MIT](LICENSE)
