import type { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { mkdirSync } from 'fs';
import path from 'path';
import * as schema from './schema';
import { getLogger } from '@/lib/request-context';

/**
 * Zero-setup local store: an embedded Postgres (PGlite, Postgres compiled to
 * WASM) persisted to a directory on disk, behind the same Drizzle schema the
 * hosted Neon database uses. Used only when DATABASE_URL is unset.
 *
 * The schema comes from the committed migrations in `drizzle/`, the same
 * files `drizzle-kit migrate` applies to the hosted database. They run when
 * the store opens, through Drizzle's own migrator, which records each one in
 * `drizzle.__drizzle_migrations` exactly as the CLI does; a directory that is
 * already up to date pays only for that lookup.
 *
 * Every query on the returned database waits for the migrations to finish,
 * so a route can run `db.query.gameStates.findFirst(...)` on the first
 * request after boot without racing table creation.
 */

export const DEFAULT_LOCAL_DATA_DIR = path.join('.data', 'pglite');
export const DEFAULT_MIGRATIONS_DIR = 'drizzle';

export type LocalDatabase = PgliteDatabase<typeof schema>;

type OpenStore = {
  dataDir: string;
  /** Resolves to the open client once the schema is on it. */
  ready: Promise<PGlite>;
};

// Next.js dev evaluates this module once per route bundle and again on every
// hot reload. Two PGlite instances on one data directory would corrupt it, so
// the open store lives on globalThis, which is shared by the whole process.
// The Drizzle instance handed to routes never holds the client directly: it
// goes through a gate that looks the current store up on every call, so a
// store closed and reopened later (a restart in tests, a reload in dev) is
// picked up by every `db` already imported.
const STORE_KEY = '__falaMestreLocalStore__';
const DB_KEY = '__falaMestreLocalDb__';
type GlobalWithStore = typeof globalThis & {
  [STORE_KEY]?: OpenStore;
  [DB_KEY]?: LocalDatabase;
};

export function resolveLocalDataDir(): string {
  const configured = process.env.PGLITE_DATA_DIR;
  return path.resolve(process.cwd(), configured && configured.length > 0 ? configured : DEFAULT_LOCAL_DATA_DIR);
}

/** The migrations folder: `DRIZZLE_MIGRATIONS_DIR`, or `drizzle/` under the working directory. */
export function resolveMigrationsDir(): string {
  const configured = process.env.DRIZZLE_MIGRATIONS_DIR;
  return path.resolve(process.cwd(), configured && configured.length > 0 ? configured : DEFAULT_MIGRATIONS_DIR);
}

async function applyMigrations(client: PGlite): Promise<void> {
  await migrate(drizzle({ client, schema }), { migrationsFolder: resolveMigrationsDir() });
}

async function openStore(dataDir: string): Promise<PGlite> {
  const { PGlite } = await import('@electric-sql/pglite');
  // PGlite only creates the last path segment itself.
  mkdirSync(dataDir, { recursive: true });
  const client = await PGlite.create(dataDir);
  await applyMigrations(client);
  getLogger('db').info('Using embedded local database', { dataDir });
  return client;
}

function currentStore(): OpenStore {
  const g = globalThis as GlobalWithStore;
  const dataDir = resolveLocalDataDir();
  if (!g[STORE_KEY] || g[STORE_KEY].dataDir !== dataDir) {
    const ready = openStore(dataDir);
    // A boot failure surfaces on the first query, not as an unhandled
    // rejection; and it is forgotten so the next query retries the open.
    ready.catch(() => {
      if (g[STORE_KEY]?.ready === ready) g[STORE_KEY] = undefined;
    });
    g[STORE_KEY] = { dataDir, ready };
  }
  return g[STORE_KEY];
}

// Drizzle's PGlite session only calls `query` and `transaction` on the
// client, so a gate over those two is enough.
const gatedClient = {
  async query(...args: Parameters<PGlite['query']>) {
    const client = await currentStore().ready;
    return client.query(...args);
  },
  async transaction(...args: Parameters<PGlite['transaction']>) {
    const client = await currentStore().ready;
    return client.transaction(...args);
  },
} as unknown as PGlite;

/**
 * The process-wide local database. The directory is opened, and the schema
 * pushed, on the first query. The directory is `PGLITE_DATA_DIR` or
 * `.data/pglite` under the working directory.
 */
export function getLocalDatabase(): LocalDatabase {
  const g = globalThis as GlobalWithStore;
  if (!g[DB_KEY]) {
    g[DB_KEY] = drizzle({ client: gatedClient, schema });
  }
  return g[DB_KEY];
}

/** Resolves once the local database is open and its migrations have run. */
export async function localDatabaseReady(): Promise<void> {
  await currentStore().ready;
}

/**
 * Closes the local database and forgets it, so the next query reopens the
 * directory from disk. Lets a test prove persistence across a restart.
 */
export async function closeLocalDatabase(): Promise<void> {
  const g = globalThis as GlobalWithStore;
  const store = g[STORE_KEY];
  if (!store) return;
  g[STORE_KEY] = undefined;
  const client = await store.ready.catch(() => undefined);
  await client?.close();
}
