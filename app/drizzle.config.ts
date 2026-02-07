import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load from .env.local first, fallback to .env
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
