import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { getLocalDatabase, type LocalDatabase } from './local';
import { getLogger } from '@/lib/request-context';
import { describeDatabaseUrl } from '@/lib/log-safe';

const databaseUrl = process.env.DATABASE_URL;

export type Database = NeonHttpDatabase<typeof schema> | LocalDatabase;

// Track active connections for cleanup
let activeConnection: NeonHttpDatabase<typeof schema> | null = null;

/**
 * Creates a real database connection with proper connection management
 */
function createRealConnection() {
  if (activeConnection) {
    return activeConnection;
  }

  if (!databaseUrl) {
    throw new Error('DATABASE_URL not set but connection requested');
  }

  try {
    const sql = neon(databaseUrl);
    activeConnection = drizzle(sql, { schema });
    return activeConnection;
  } catch (error) {
    // Not `{ error }`: for a string that will not parse as a URL the driver
    // quotes it back in full, so its message and its stack both carry the
    // password. The error's name plus a redacted view of the string is what
    // can be said. See `describeDatabaseUrl`.
    getLogger('db').error('Failed to create database connection', {
      errorName: error instanceof Error ? error.name : typeof error,
      database: describeDatabaseUrl(databaseUrl),
    });
    throw error;
  }
}

/**
 * Gets the database instance (creates one if doesn't exist).
 *
 * With DATABASE_URL set this is the hosted Neon database. Without it the game
 * runs on an embedded Postgres persisted under `.data/pglite` (see local.ts),
 * so a fresh checkout is playable with no configuration and saves survive
 * restarts.
 */
function getDb(): Database {
  if (!databaseUrl) {
    return getLocalDatabase();
  }
  return createRealConnection();
}

/**
 * Cleanup function for database resources
 * Should be called during application shutdown or periodic cleanup
 */
export function cleanupDatabase() {
  // Reset active connection (Neon serverless connections are stateless)
  activeConnection = null;

  getLogger('db').info('Database resources cleaned up');
}

// Export singleton instance.
//
// Kept loosely typed on purpose: the routes were written against an untyped
// `db`, and typing it as `Database` surfaces a few dozen latent type errors in
// them (strings handed to timestamp columns, timeouts typed against the Neon
// result shape). Those are worth fixing, but separately from the storage
// wiring; `Database` is exported for code that wants the precise type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = getDb();

export { db };

// Export getter for controlled access
export function getDatabaseInstance() {
  return getDb();
}
