#!/usr/bin/env node
/**
 * Runs the betting repair tool (src/scripts/repair-betting.ts) against the
 * database the app would use. See that file for the options; `--help` here.
 *
 * The tool is written in TypeScript against the app's own modules (the `@/`
 * alias), so this bundles it with esbuild first, with every package left
 * external, into app/.repair/ (ignored by git; inside the app so the
 * packages resolve from its node_modules) and runs that. Loads .env.local
 * then .env the way the app does, so DATABASE_URL points it at the same
 * database.
 */

import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import dotenv from 'dotenv';

const appDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

if (process.argv.includes('--help')) {
  console.log(`Usage: npm run repair:betting [-- --fix] [-- --json]

Finds saves with no market on their current fixture, markets with a result
whose bets are not settled, winning bets held for an operator, and rounds
banked without a stored result. Reports by default; --fix repairs the first
two. Never pays a held winner. Safe to run again at any time.

Database: DATABASE_URL (environment or .env.local) if set, else the embedded
store at PGLITE_DATA_DIR or .data/pglite.`);
  process.exit(0);
}

dotenv.config({ path: path.join(appDir, '.env.local'), quiet: true });
if (!process.env.DATABASE_URL) dotenv.config({ path: path.join(appDir, '.env'), quiet: true });

// With --json the report is the only thing on stdout; the app's own log
// lines (level info and below) would otherwise come first.
if (process.argv.includes('--json') && !process.env.LOG_LEVEL) process.env.LOG_LEVEL = 'warn';

const out = path.join(appDir, '.repair');
mkdirSync(out, { recursive: true });
try {
  await build({
    entryPoints: [path.join(appDir, 'src', 'scripts', 'repair-betting.ts')],
    // CommonJS: `next/server` resolves only through require, and the bundle
    // is loaded from here, so the format is nobody else's concern.
    outfile: path.join(out, 'repair-betting.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    alias: { '@': path.join(appDir, 'src') },
    logLevel: 'warning',
  });
  process.chdir(appDir);
  await import(pathToFileURL(path.join(out, 'repair-betting.cjs')).href);
} finally {
  rmSync(out, { recursive: true, force: true });
}
