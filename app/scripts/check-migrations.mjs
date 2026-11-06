#!/usr/bin/env node
/**
 * Proves the committed migrations in drizzle/ are sound, with no database
 * configured. Run as `npm run db:check`; CI runs it on every push.
 *
 *  1. Builds the schema from scratch: opens a fresh embedded Postgres
 *     (PGlite) in a temporary directory and applies every migration through
 *     Drizzle's migrator, exactly as the local store does on first boot and
 *     `db:migrate` does on the hosted database.
 *  2. Runs every statement of every migration a second time, raw, against
 *     that same database. The migrator would skip them by the journal; this
 *     step is what proves each file is safe to repeat (`IF NOT EXISTS`,
 *     `CREATE OR REPLACE`, `DROP ... IF EXISTS` and so on), which is what a
 *     database that was pushed by hand, or a run that was not recorded,
 *     relies on.
 *  3. Checks that src/db/schema.ts has no change the migrations do not
 *     cover: runs `drizzle-kit generate` against a copy of drizzle/ and
 *     fails if it would write a new file, printing the SQL it would have
 *     written so the missing migration is plain to see.
 *
 * Exit code 0 only if all three pass.
 */

import { mkdtempSync, rmSync, readFileSync, readdirSync, cpSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

const appDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const migrationsDir = path.join(appDir, 'drizzle');
const schemaFile = path.join(appDir, 'src', 'db', 'schema.ts');

const temp = mkdtempSync(path.join(tmpdir(), 'falamestre-migration-check-'));
let failed = false;

function step(title) {
  process.stdout.write(`\n== ${title}\n`);
}
function fail(message) {
  failed = true;
  process.stdout.write(`FAIL: ${message}\n`);
}
function ok(message) {
  process.stdout.write(`ok: ${message}\n`);
}

const journal = JSON.parse(readFileSync(path.join(migrationsDir, 'meta', '_journal.json'), 'utf8'));
const files = journal.entries.map((entry) => `${entry.tag}.sql`);

try {
  // 1. Fresh database, every migration through the migrator.
  step('1. Build the schema on a fresh database from the committed migrations');
  const client = await PGlite.create(path.join(temp, 'db'));
  try {
    await migrate(drizzle({ client }), { migrationsFolder: migrationsDir });
    const applied = await client.query('select count(*)::int as n from drizzle.__drizzle_migrations');
    const tables = await client.query(
      "select count(*)::int as n from information_schema.tables where table_schema = 'public'"
    );
    ok(`${applied.rows[0].n} migration(s) applied, ${tables.rows[0].n} table(s) created`);
    if (applied.rows[0].n !== files.length) {
      fail(`journal lists ${files.length} migration(s) but ${applied.rows[0].n} were recorded`);
    }
  } catch (error) {
    fail(`migrator failed on a fresh database: ${error.message}`);
  }

  // 2. Every statement again, raw, on the database that already has them.
  step('2. Run every migration statement a second time on the same database');
  for (const file of files) {
    const sql = readFileSync(path.join(migrationsDir, file), 'utf8');
    const statements = sql
      .split('--> statement-breakpoint')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    let rerun = 0;
    for (const statement of statements) {
      try {
        await client.query(statement);
        rerun += 1;
      } catch (error) {
        fail(`${file} is not safe to repeat. Statement:\n${statement}\n-> ${error.message}`);
        break;
      }
    }
    if (rerun === statements.length) ok(`${file}: ${rerun} statement(s) repeated without error`);
  }
  await client.close();

  // 3. The schema in code against the migrations on disk.
  //
  // drizzle-kit resolves `out` as `./<out>` from the working directory, so
  // the scratch copy of drizzle/ has to live under the app directory and be
  // named relatively; an absolute path is looked up as `.//abs/path` and
  // silently finds nothing to compare against.
  step('3. Check src/db/schema.ts has no change the migrations do not cover');
  const scratchName = `.migration-check-${process.pid}`;
  const scratch = path.join(appDir, scratchName);
  const outCopy = path.join(scratch, 'drizzle');
  cpSync(migrationsDir, outCopy, { recursive: true });
  try {
    const config = path.join(scratch, 'drizzle.config.mjs');
    writeFileSync(
      config,
      `export default { schema: './src/db/schema.ts', out: './${scratchName}/drizzle', dialect: 'postgresql' };\n`
    );
    const before = new Set(readdirSync(outCopy));
    const generate = spawnSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['drizzle-kit', 'generate', '--config', config, '--name', 'uncommitted_schema_change'],
      { cwd: appDir, encoding: 'utf8', env: { ...process.env, DATABASE_URL: '' } }
    );
    const output = `${generate.stdout ?? ''}${generate.stderr ?? ''}`;
    const added = readdirSync(outCopy).filter((name) => !before.has(name) && name.endsWith('.sql'));
    if (generate.status !== 0 || /ENOENT|Error/.test(output)) {
      fail(`drizzle-kit generate did not complete (exit ${generate.status}):\n${output}`);
    } else if (added.length > 0) {
      const wouldWrite = readFileSync(path.join(outCopy, added[0]), 'utf8');
      fail(
        `schema.ts has changes no committed migration covers. Run \`npm run db:generate\` and commit the result. drizzle-kit would write:\n${wouldWrite}`
      );
    } else if (!/No schema changes/.test(output)) {
      fail(`drizzle-kit generate wrote nothing but did not report "No schema changes":\n${output}`);
    } else {
      ok('schema.ts matches the committed migrations');
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}

process.stdout.write(failed ? '\nMigration check FAILED\n' : '\nMigration check passed\n');
process.exit(failed ? 1 : 0);
