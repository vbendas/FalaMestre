// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

/**
 * A fresh player on a checkout with no DATABASE_URL: the game must run on the
 * embedded local database, not the old no-op mock whose reads were always
 * empty. This walks the real routes against a real PGlite directory: create a
 * team, load it back, then close the store and reopen the same directory the
 * way a server restart would, and load it again.
 */

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => null),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

let dataDir: string;
let createTeamPOST: typeof import('@/app/api/onboarding/create-team/route').POST;
let conversationGET: typeof import('@/app/api/conversation/route').GET;
let local: typeof import('@/db/local');

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'falamestre-pglite-'));
  delete process.env.DATABASE_URL;
  process.env.PGLITE_DATA_DIR = dataDir;
  process.env.AUTH_DISABLED = 'true';
  vi.resetModules();
  local = await import('@/db/local');
  ({ POST: createTeamPOST } = await import('@/app/api/onboarding/create-team/route'));
  ({ GET: conversationGET } = await import('@/app/api/conversation/route'));
}, 60_000);

afterAll(async () => {
  await local.closeLocalDatabase();
  rmSync(dataDir, { recursive: true, force: true });
});

async function loadGame(userId: string) {
  const response = await conversationGET(
    new NextRequest(`http://localhost/api/conversation?userId=${userId}`),
  );
  return response.json();
}

describe('embedded local database', () => {
  it('lets a fresh player create a team and load it back, including after a restart', async () => {
    const create = await createTeamPOST(
      new NextRequest('http://localhost/api/onboarding/create-team', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          teamName: 'Dragões Locais',
          primaryColor: '#112233',
          secondaryColor: '#AABBCC',
          badgeStyle: 'shield',
        }),
      }),
    );
    expect(create.status).toBe(201);
    const { userId } = await create.json();
    expect(userId).toMatch(/^user_/);

    const loaded = await loadGame(userId);
    expect(loaded.exists).toBe(true);
    expect(loaded.gameState.user.team).toBe('Dragões Locais');
    expect(loaded.gameState.teamCustomization.badgeStyle).toBe('shield');

    // Restart: drop the open store and reopen the same directory from disk.
    await local.closeLocalDatabase();
    const reloaded = await loadGame(userId);
    expect(reloaded.exists).toBe(true);
    expect(reloaded.gameState.user.team).toBe('Dragões Locais');

    const missing = await loadGame('user_nobody');
    expect(missing.exists).toBe(false);
  }, 60_000);
});
