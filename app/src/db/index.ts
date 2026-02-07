import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;

let db: any;

// Mock database for development/build without DATABASE_URL
if (!databaseUrl) {
  console.warn('⚠️  DATABASE_URL not set. Using in-memory mock database.');
  
  // Create a mock db object with the same interface
  db = {
    query: {
      users: { findFirst: async () => null },
      gameStates: { findFirst: async () => null },
      conversations: { findFirst: async () => null },
      analyticsEvents: { findFirst: async () => null },
      userClusters: { findFirst: async () => null },
      userProfiles: { findFirst: async () => null },
      audienceSyncLog: { findFirst: async () => null },
      userProfileSnapshots: { findFirst: async () => null },
      messageEmbeddings: { findFirst: async () => null },
      intentClusters: { findFirst: async () => null },
    },
    insert: () => ({
      values: async () => ({ rows: [] }),
    }),
    update: () => ({
      set: () => ({
        where: async () => ({ rows: [] }),
      }),
    }),
  };
} else {
  const sql = neon(databaseUrl);
  db = drizzle(sql, { schema });
}

export { db };
