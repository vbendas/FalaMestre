// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openJourney, dieAfterWrites, type Journey } from '@/test/journey';

/**
 * The betting repair tool against a database with every kind of damage it
 * knows about, seeded through the real routes and then broken by hand the
 * way a bad deploy or an outage breaks things.
 */

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => null) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.setConfig({ testTimeout: 60_000 });

let j: Journey;
let repair: typeof import('@/lib/betting-repair');
beforeAll(async () => {
  j = await openJourney('repair');
  repair = await import('@/lib/betting-repair');
}, 60_000);
afterAll(async () => j.close());
beforeEach(() => {
  vi.restoreAllMocks();
  for (const level of ['warn', 'error', 'info', 'log'] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

/** Everything the tool could change, for "running it again changed nothing". */
async function snapshot() {
  const [markets, bets, saves, history] = await Promise.all([
    j.db.select().from(j.schema.predictions),
    j.db.select().from(j.schema.userBets),
    j.db.select({ userId: j.schema.gameStates.userId, state: j.schema.gameStates.currentState, version: j.schema.gameStates.version }).from(j.schema.gameStates),
    j.db.select().from(j.schema.predictionHistory),
  ]);
  const byId = (rows: Array<{ id: string }>) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
  return { markets: byId(markets), bets: byId(bets), saves: [...saves].sort((a, b) => a.userId.localeCompare(b.userId)), history: [...history].sort((a, b) => a.userId.localeCompare(b.userId)) };
}

async function bankedWithBets(score = { homeScore: 2, awayScore: 0 }) {
  const userId = await j.newSave();
  const start = await j.booksStart(userId);
  const market = await j.theOpenMarket(userId);
  await j.betOnEveryOutcome(userId, market);
  // Banked and settled the normal way, then put back to the broken state the
  // case needs. The score is overwritten so each case knows its winner.
  const watched = await j.playTurns(userId);
  expect((await j.finalize(userId, { claimedScore: watched.score })).status).toBe(200);
  const save = await j.loadSave(userId);
  save.state.season.results = { '1': score };
  expect((await j.saveStore.commitSave(userId, save.state, save.version)).ok).toBe(true);
  return { userId, start, market: await j.marketById(market.id) };
}

/** Undoes settlement: the market back to closed with no result, the bets unsettled, the payout taken back. */
async function unsettle(userId: string, marketId: string, { keepResultOnMarket = false } = {}) {
  const bets = await j.betsOf(userId);
  const paid = bets.filter(b => b.predictionId === marketId).reduce((s, b) => s + (b.payout ?? 0), 0);
  if (paid > 0) expect((await j.saveStore.adjustMoney(userId, -paid)).ok).toBe(true);
  await j.db
    .update(j.schema.userBets)
    .set({ settled: false, won: null, payout: null, settledAt: null, settlingAt: null })
    .where(j.drizzle.eq(j.schema.userBets.predictionId, marketId));
  await j.db.delete(j.schema.predictionHistory).where(j.drizzle.eq(j.schema.predictionHistory.userId, userId));
  await j.db.insert(j.schema.predictionHistory).values({ userId, totalBets: bets.length });
  const save = await j.loadSave(userId);
  await j.db
    .update(j.schema.predictions)
    .set(keepResultOnMarket
      ? { status: 'closed', settledAt: null, ...save.state.season.results!['1'] }
      : { status: 'closed', settledAt: null, homeScore: null, awayScore: null })
    .where(j.drizzle.eq(j.schema.predictions.id, marketId));
}

type Seeded = {
  missingMarket: string;
  resultOnMarket: { userId: string; marketId: string; start: Awaited<ReturnType<Journey['booksStart']>> };
  resultInSave: { userId: string; marketId: string; start: Awaited<ReturnType<Journey['booksStart']>> };
  heldWinner: { userId: string; marketId: string; betId: string };
  noResult: { userId: string; marketId: string };
};

async function seedEveryCase(): Promise<Seeded> {
  // 1. A save whose current fixture has no market.
  const missingMarket = await j.newSave();
  await j.db.delete(j.schema.predictions).where(j.drizzle.eq(j.schema.predictions.userId, missingMarket));

  // 2a. A market with the result on it, status closed, bets unsettled.
  const a = await bankedWithBets();
  await unsettle(a.userId, a.market.id, { keepResultOnMarket: true });
  // 2b. The result only in the save; the market never got it.
  const b = await bankedWithBets({ homeScore: 0, awayScore: 3 });
  await unsettle(b.userId, b.market.id);

  // 3. A winning bet the old code left claimed; the losers claimed too.
  const c = await bankedWithBets({ homeScore: 1, awayScore: 1 });
  await unsettle(c.userId, c.market.id, { keepResultOnMarket: true });
  await j.db.update(j.schema.userBets).set({ settlingAt: new Date() }).where(j.drizzle.eq(j.schema.userBets.userId, c.userId));
  const heldBet = (await j.betsOf(c.userId)).find(bt => bt.optionId === `${c.market.matchId}-draw`)!;

  // 4. A round banked with no score stored anywhere.
  const d = await bankedWithBets();
  await unsettle(d.userId, d.market.id);
  const save = await j.loadSave(d.userId);
  delete save.state.season.results;
  expect((await j.saveStore.commitSave(d.userId, save.state, save.version)).ok).toBe(true);

  return {
    missingMarket,
    resultOnMarket: { userId: a.userId, marketId: a.market.id, start: a.start },
    resultInSave: { userId: b.userId, marketId: b.market.id, start: b.start },
    heldWinner: { userId: c.userId, marketId: c.market.id, betId: heldBet.id },
    noResult: { userId: d.userId, marketId: d.market.id },
  };
}

function ofUsers<T extends { userId: string }>(findings: T[], seeded: Seeded): T[] {
  const users = new Set([seeded.missingMarket, seeded.resultOnMarket.userId, seeded.resultInSave.userId, seeded.heldWinner.userId, seeded.noResult.userId]);
  return findings.filter(f => users.has(f.userId));
}

describe('the repair tool', () => {
  it('reports every case and says what it would do, changing nothing', async () => {
    const seeded = await seedEveryCase();
    const before = await snapshot();

    const report = await repair.repairBetting();
    const findings = ofUsers(report.findings, seeded);

    expect(findings.map(f => [f.kind, f.userId, f.fixable])).toEqual(
      expect.arrayContaining([
        ['missing_market', seeded.missingMarket, true],
        ['unsettled_with_result', seeded.resultOnMarket.userId, true],
        ['unsettled_with_result', seeded.resultInSave.userId, true],
        // The held winner's market is itself still to be settled (its held
        // losers finished, its status set); the winner stays held.
        ['unsettled_with_result', seeded.heldWinner.userId, true],
        ['held_winner', seeded.heldWinner.userId, false],
        ['banked_without_result', seeded.noResult.userId, false],
      ])
    );
    expect(findings).toHaveLength(6);
    const held = findings.find(f => f.kind === 'held_winner')!;
    expect(held.betId).toBe(seeded.heldWinner.betId);
    expect(held.action).toMatch(/predictions\/resolve/);
    expect(findings.find(f => f.kind === 'banked_without_result')!.openBets).toBe(3);
    for (const f of findings) {
      expect(f.problem).toBeTruthy();
      expect(f.action).toBeTruthy();
    }
    expect(report.fixed).toEqual([]);

    // Report only: nothing moved.
    expect(await snapshot()).toEqual(before);

    const text = repair.formatReport(report, { fix: false });
    expect(text).toMatch(/WOULD FIX/);
    expect(text).toMatch(/NEEDS A PERSON/);
    expect(text).toMatch(/never pays a held winner/);
  });

  it('with --fix repairs the two it safely can, leaves the two it cannot, and a second run changes nothing', async () => {
    const seeded = await seedEveryCase();
    const heldMoneyBefore = await j.moneyOf(seeded.heldWinner.userId);

    const fixed = await repair.repairBetting({ fix: true });
    expect(fixed.failed).toEqual([]);
    expect(ofUsers(fixed.fixed, seeded).map(f => f.kind).sort()).toEqual(['missing_market', 'unsettled_with_result', 'unsettled_with_result', 'unsettled_with_result']);

    // The missing market is back, one, on the right fixture, priced.
    const market = await j.theOpenMarket(seeded.missingMarket);
    expect(market.matchId).toBe('round-1');
    expect(market.options).toHaveLength(3);

    // Both unsettled markets are settled: one payout each, books balanced.
    for (const { userId, marketId, start } of [seeded.resultOnMarket, seeded.resultInSave]) {
      expect((await j.marketById(marketId)).status).toBe('settled');
      const { bets } = await j.expectBooksBalance(userId, start);
      expect(bets.every(b => b.settled)).toBe(true);
      expect(bets.filter(b => b.won)).toHaveLength(1);
      expect(await j.historyCounts(userId)).toEqual(j.expectedHistory(bets));
    }

    // The held winner is untouched and unpaid; the held losers were finished.
    const heldBets = await j.betsOf(seeded.heldWinner.userId);
    const winner = heldBets.find(b => b.id === seeded.heldWinner.betId)!;
    expect(winner).toMatchObject({ settled: false, payout: null });
    expect(winner.settlingAt).not.toBeNull();
    expect(heldBets.filter(b => b.id !== winner.id).every(b => b.settled && !b.won)).toBe(true);
    expect(await j.moneyOf(seeded.heldWinner.userId)).toBe(heldMoneyBefore);

    // The round with no result is left exactly as it was.
    expect((await j.marketById(seeded.noResult.marketId)).status).toBe('closed');
    expect((await j.betsOf(seeded.noResult.userId)).every(b => !b.settled)).toBe(true);

    // Run again: the same two are reported for a person, nothing is fixed, nothing moves.
    const after = await snapshot();
    const again = await repair.repairBetting({ fix: true });
    expect(ofUsers(again.findings, seeded).map(f => f.kind).sort()).toEqual(['banked_without_result', 'held_winner']);
    expect(again.fixed).toEqual([]);
    expect(await snapshot()).toEqual(after);
  });

  it('killed halfway through a repair, leaves nothing half done, and the next run finishes', async () => {
    let survive = 0;
    let points = 0;
    for (;;) {
      const seeded = await seedEveryCase();
      const at = `died after ${survive} write(s)`;

      const crash = dieAfterWrites(j.db, survive);
      const report = await repair.repairBetting({ fix: true }).catch(() => null);
      const attempted = crash.attempted();
      crash.restart();

      // Whatever it got to: each fixable case is either fully repaired or
      // untouched, and the money adds up either way.
      for (const { userId, start } of [seeded.resultOnMarket, seeded.resultInSave]) {
        await j.expectBooksBalance(userId, start, `${at}:`);
      }
      expect(await j.openMarketsOf(seeded.missingMarket).then(m => m.length), at).toBeLessThanOrEqual(1);

      // The next run, in a healthy process, finishes the job.
      const finished = await repair.repairBetting({ fix: true });
      expect(finished.failed, at).toEqual([]);
      const left = await repair.inspectBetting();
      expect(ofUsers(left.findings, seeded).filter(f => f.fixable), `${at}: nothing fixable left`).toEqual([]);
      expect(await j.openMarketsOf(seeded.missingMarket).then(m => m.map(x => x.matchId)), at).toEqual(['round-1']);
      for (const { userId, marketId, start } of [seeded.resultOnMarket, seeded.resultInSave]) {
        expect((await j.marketById(marketId)).status, at).toBe('settled');
        const { bets } = await j.expectBooksBalance(userId, start, `${at}, after recovery:`);
        expect(bets.every(b => b.settled), at).toBe(true);
        expect(bets.filter(b => b.won), `${at}: paid once`).toHaveLength(1);
      }
      const winner = (await j.betsOf(seeded.heldWinner.userId)).find(b => b.id === seeded.heldWinner.betId)!;
      expect(winner.settled, `${at}: the held winner is never touched`).toBe(false);

      points += 1;
      if (report !== null && attempted <= survive) break;
      survive += 1;
    }
    expect(points).toBeGreaterThan(3);
  }, 120_000);

  it('the command line tool finds nothing on a fresh database and reports the seeded cases on this one', async () => {
    const appDir = path.resolve(__dirname, '..', '..', '..');
    const run = (dataDir: string, ...args: string[]) =>
      spawnSync(process.execPath, [path.join(appDir, 'scripts', 'repair-betting.mjs'), ...args], {
        cwd: appDir,
        encoding: 'utf8',
        env: { ...process.env, DATABASE_URL: '', PGLITE_DATA_DIR: dataDir },
      });

    const fresh = mkdtempSync(path.join(tmpdir(), 'falamestre-repair-fresh-'));
    try {
      const result = run(fresh);
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/Scanned 0 save\(s\) and 0 fixture market\(s\)/);
      expect(result.stdout).toMatch(/Nothing out of step/);
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }

    // On this test's store, the seeded cases are named and the exit code
    // says a person is needed. The embedded store takes one process at a
    // time, so it is closed first; this is the last test in the file.
    await seedEveryCase();
    const dataDir = process.env.PGLITE_DATA_DIR!;
    await (await import('@/db/local')).closeLocalDatabase();
    const result = run(dataDir, '--json');
    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.fix).toBe(false);
    expect(report.findings.map((f: { kind: string }) => f.kind)).toEqual(
      expect.arrayContaining(['missing_market', 'unsettled_with_result', 'held_winner', 'banked_without_result'])
    );
    expect(run(dataDir, '--bogus').status).toBe(2);
  }, 120_000);
});
