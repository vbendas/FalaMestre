import { defineConfig } from '@playwright/test';
import path from 'path';
import os from 'os';

/**
 * Browser tests for the real app: Playwright starts `next dev` itself on its
 * own port, on the embedded store in a throwaway directory (removed again in
 * tests/e2e/global-teardown.ts) and with the assistant in mock mode, so the
 * run needs no database, no API key and no setup, and can never touch a real
 * save. The explicit empty DATABASE_URL / OPENROUTER_API_KEY matter: Next
 * loads `.env.local`, but never over a variable that is already set, so a
 * developer's own configuration cannot leak into the run.
 *
 * The run proves its own isolation rather than trusting the environment: the
 * conversation spec asserts the reply came back `source: "mock"`, which only
 * holds if no live model was called.
 */

/**
 * A per-run port rather than a fixed one: parallel checkouts and worktrees
 * run their own servers, and a fixed port makes two runs fight over it.
 * E2E_PORT pins it when something external needs to know it.
 */
const port = Number(process.env.E2E_PORT ?? 3100 + (process.pid % 900));
// Workers re-evaluate this file with their own pid; the env pin keeps every
// process in the run on the port the server was actually started on.
process.env.E2E_PORT = String(port);

const dataDir =
  process.env.E2E_PGLITE_DIR ??
  path.join(os.tmpdir(), `falamestre-e2e-${process.pid}-${Date.now()}`);
// The teardown reads it back from the environment.
process.env.E2E_PGLITE_DIR = dataDir;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  globalTeardown: './tests/e2e/global-teardown.ts',
  // On CI the annotations go inline on the pull request, and the HTML report
  // is what the workflow uploads when the run fails.
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx next dev --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      AUTH_DISABLED: 'true',
      USE_MOCK_AI: 'true',
      PGLITE_DATA_DIR: dataDir,
      DATABASE_URL: '',
      OPENROUTER_API_KEY: '',
    },
  },
});
