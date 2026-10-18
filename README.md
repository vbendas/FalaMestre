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
[ROADMAP.md](ROADMAP.md) for what comes next. Known issues as of this
writing: `npx tsc --noEmit` reports 2 errors in `SquadShareCard.tsx`
(missing `html2canvas` dependency), 6 of 104 unit tests fail, and ESLint
reports 3 errors in `SquadView.tsx`. Fixing these is the first roadmap item.

## Stack

From `app/package.json`:

- Next.js 16 (App Router), React 19, TypeScript 5
- Tailwind CSS 4, Radix UI primitives, Framer Motion, lucide-react, lottie-react
- Drizzle ORM + drizzle-kit on Neon serverless Postgres
- next-auth 4 (Google provider, JWT sessions)
- Zod for request validation
- LLM calls over HTTP to [OpenRouter](https://openrouter.ai) (default model
  `google/gemini-2.0-flash-001`), with a built-in mock mode
- Vitest + Testing Library (jsdom) for unit tests, Playwright for browser checks
- Bun as the package manager and dev runner (npm also works; CI uses `npm ci`)

## Repository layout

```
app/                Next.js application (all runtime code lives here)
  src/app/          pages and API routes (/api/conversation, /api/match, ...)
  src/components/   UI components (game views, CRT-style layout, modals)
  src/lib/          game engine, decision engine, commentary, AI service
  src/db/           Drizzle schema and database client
  tests/            Playwright specs
Documentation/      design docs (game design, UX, architecture, phase plans)
docs/               engineering notes, game mechanics, LLM strategy, diagrams
  plans/            implementation plans (decision UI, VR view, UX)
  status/           point-in-time status reports
Screens/            static HTML mockups of the main screens
scripts/            ad-hoc Playwright scripts for screenshots and smoke checks
PRD.md              product requirements document
ROADMAP.md          next items
```

## Running locally

Requirements: [Bun](https://bun.sh) 1.x (or Node.js 20+ with npm).

```bash
cd app
bun install                 # or: npm ci
cp .env.example .env.local  # then fill in the values you need
bun run dev                 # http://localhost:3001
```

`app/.env.example` lists every environment variable the code reads. Notes:

- **LLM mock mode.** If `OPENROUTER_API_KEY` is not set, or `USE_MOCK_AI=true`,
  the assistant answers with built-in canned responses, so you can play
  without an API key.
- **Database.** A Postgres database is needed to actually play. Without
  `DATABASE_URL` the server falls back to a no-op mock database: the app
  starts, but game state is never saved, so you cannot get past onboarding.
  Create a Postgres database (the code uses the Neon serverless driver, so a
  free Neon project is the simplest option) and push the schema with Drizzle:

  ```bash
  cd app
  bun run db:push      # applies src/db/schema.ts to DATABASE_URL
  bun run db:studio    # optional: browse the data
  ```

  `db:generate` / `db:migrate` are also available; migrations are not yet
  committed to the repository.
- **Auth.** Sign-in uses Google OAuth through next-auth. For local play
  without OAuth credentials, set `AUTH_DISABLED=true`.

## Tests

```bash
cd app
npx vitest run       # unit tests (or: bun run test:run)
npx tsc --noEmit     # typecheck
bun run lint         # ESLint
```

The scripts in `scripts/` drive a running dev server with Playwright, for
example `node scripts/capture-screenshots.mjs` from the repository root
(install the root dev dependency first with `npm install`).

## License

[MIT](LICENSE)
