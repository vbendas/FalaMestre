import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;

// Track active connections for cleanup
let activeConnection: any = null;
let mockDbInstance: any = null;

/**
 * Creates a mock database instance with proper cleanup tracking
 */
function createMockDatabase() {
  if (mockDbInstance) {
    return mockDbInstance;
  }

  mockDbInstance = {
    query: {
      users: { findFirst: async () => null },
      gameStates: { findFirst: async () => null },
      conversations: { findFirst: async () => null },
      analyticsEvents: { findFirst: async () => null },
    },
    insert: () => ({
      values: async () => ({ rows: [] }),
    }),
    update: () => ({
      set: () => ({
        where: async () => ({ rows: [] }),
      }),
    }),
    execute: async () => [],
  };

  return mockDbInstance;
}

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
    console.error('Failed to create database connection:', error);
    throw error;
  }
}

/**
 * Gets the database instance (creates one if doesn't exist)
 */
function getDb() {
  if (!databaseUrl) {
    return createMockDatabase();
  }
  return createRealConnection();
}

/**
 * Cleanup function for database resources
 * Should be called during application shutdown or periodic cleanup
 */
export function cleanupDatabase() {
  // Reset mock instance
  mockDbInstance = null;
  
  // Reset active connection (Neon serverless connections are stateless)
  activeConnection = null;
  
  console.log('[DB] Database resources cleaned up');
}

// Export singleton instance
const db = getDb();

export { db };

// Export getter for controlled access
export function getDatabaseInstance() {
  return getDb();
}
