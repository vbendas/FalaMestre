# Fala Mestre! app

This directory contains the Next.js application. Setup, environment
variables, database, test and project-status instructions are in the
[root README](../README.md); the next work items are in
[ROADMAP.md](../ROADMAP.md).

Quick start:

```bash
bun install                 # or: npm ci
cp .env.example .env.local  # set DATABASE_URL (and AUTH_DISABLED=true)
bun run dev                 # http://localhost:3001
```

Useful scripts (see `package.json`): `test:run` (Vitest), `lint` (ESLint),
`db:push` / `db:generate` / `db:migrate` / `db:studio` (drizzle-kit).

The other Markdown files in this directory (`SETUP.md`, `PROJECT_SUMMARY.md`,
`COMPLETION_SUMMARY.md`, `NEXT_STEPS.md`, `GAME_CHARACTERISTICS.md`) are
earlier development notes and may be out of date.
