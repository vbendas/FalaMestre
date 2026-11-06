// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { openJourney, dieAfterWrites, ADMIN_SECRET, type Journey } from '@/test/journey';

/**
 * One player's fixture, from a new team to the bets paid, through the real
 * routes against the real embedded Postgres; then the same fixture under
 * the things that go wrong in real life: a match abandoned and played
 * again, the bank and the settlement job landing together, and the
 * process dying at any write along the way.
 */

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => null) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

// Each test plays whole matches against a real database, several in some;
// on a machine busy with other work that is seconds, not milliseconds.
vi.setConfig({ testTimeout: 60_000 });

let j: Journey;
beforeAll(async () => {
  j = await openJourney('lifecycle');
}, 60_000);
afterAll(async () => j.close());
beforeEach(() => {
  vi.restoreAllMocks();
  for (const level of ['warn', 'error', 'info', 'log'] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

const STAKES = [10_000, 20_000, 30_000];

/** Everything the rest of a fixture's checks need, after the bets are in. */
async function newTeamWithBets() {
  const userId = await j.newSave();
  const start = await j.booksStart(userId);

  // A new team gets its market: one, on round 1, its own fixture.
  const market = await j.theOpenMarket(userId);
  const state = await j.stateOf(userId);
  expect(market.matchId).toBe('round-1');
  expect([market.homeTeam, market.awayTeam]).toContain(state.user.team);
  expect(market.options.map(o => o.id)).toEqual(['round-1-home', 'round-1-draw', 'round-1-away']);

  // More than one outcome backed: all three, so exactly one wins.
  await j.betOnEveryOutcome(userId, market, STAKES);
  expect(await j.moneyOf(userId)).toBe(start.money - 60_000);
  expect((await j.historyOf(userId))?.totalBets).toBe(3);
  return { userId, start, market };
}

/** After kickoff: the market is closed, and a bet on it takes nothing. */
async function expectClosedAtKickoff(userId: string, marketId: string) {
  const market = await j.marketById(marketId);
  expect(market.status).toBe('closed');
  expect(market.kickedOffAt).not.toBeNull();
  const before = await j.moneyOf(userId);
  const late = await j.placeBet(userId, marketId, market.options[0].id, 10_000);
  expect(late.status).toBe(409);
  expect(await j.moneyOf(userId)).toBe(before);
  expect(await j.betsOf(userId)).toHaveLength(3);
}

/**
 * After the bank: the winning bet paid its promised return once, the others
 * nothing, history counted as it always has, and nothing more happens
 * however often settlement runs again.
 */
async function expectSettledOnce(
  userId: string,
  start: Awaited<ReturnType<Journey['booksStart']>>,
  marketId: string,
  score: { homeScore: number; awayScore: number },
  committedMoney: number
) {
  const market = await j.marketById(marketId);
  expect(market.status).toBe('settled');
  expect({ homeScore: market.homeScore, awayScore: market.awayScore }).toEqual(score);

  const winner = j.winnerOf(market, score);
  const bets = await j.betsOf(userId);
  const won = bets.filter(b => b.won);
  expect(won.map(b => b.optionId)).toEqual([winner]);
  expect(won[0]).toMatchObject({ settled: true, payout: won[0].potentialWin });
  for (const lost of bets.filter(b => !b.won)) expect(lost).toMatchObject({ settled: true, won: false, payout: 0 });

  // The bank's own balance plus that one return, nothing else.
  expect(await j.moneyOf(userId)).toBe(committedMoney + won[0].potentialWin);
  await j.expectBooksBalance(userId, start);

  expect(await j.historyCounts(userId)).toEqual(j.expectedHistory(bets));

  // Settling again, every way it can be run, pays nobody twice.
  const snapshot = { money: await j.moneyOf(userId), bets: await j.betsOf(userId), history: await j.historyOf(userId) };
  for (let i = 0; i < 2; i++) expect((await j.runJob()).status).toBe(200);
  const operator = await j.routes.settleOne(
    j.post('/api/predictions/settle', { predictionId: marketId, ...score }, { authorization: `Bearer ${ADMIN_SECRET}` })
  );
  expect(operator.status).toBe(200);
  await j.settlement.settlePlayedFixtureAfterCommit(userId, await j.stateOf(userId));
  expect(await j.moneyOf(userId)).toBe(snapshot.money);
  expect(await j.betsOf(userId)).toEqual(snapshot.bets);
  expect(await j.historyOf(userId)).toEqual(snapshot.history);

  // And the season moves on to a market on the next fixture, exactly one.
  const next = await j.theOpenMarket(userId);
  expect(next.matchId).toBe('round-2');
}

describe('one fixture, start to finish', () => {
  it('played turn by turn: market, bets, kickoff, the server’s seed, the bank, one payout', async () => {
    const { userId, start, market } = await newTeamWithBets();

    // Kickoff is the first turn.
    const firstTurn = await j.playTurns(userId, { to: 0 });
    expect(firstTurn.turns[0].status).toBe(200);
    await expectClosedAtKickoff(userId, market.id);

    // The fixture's seed is the server's, kept on the kickoff, never the
    // client's, and never sent to it.
    const [kickoff] = await j.kickoffsOf(userId);
    expect(kickoff).toMatchObject({ round: 1, mode: 'turns' });
    expect(kickoff.seed).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(kickoff.seed).not.toContain('the-clients-own-seed');
    expect(JSON.stringify(firstTurn.turns[0].body)).not.toContain(kickoff.seed);

    const rest = await j.playTurns(userId, { from: 1, prior: firstTurn.prior, offered: firstTurn.offered });
    expect(rest.turns.every(t => t.status === 200)).toBe(true);
    const watched = rest.score;

    const banked = await j.finalize(userId, { claimedScore: watched });
    expect(banked.status).toBe(200);
    // Replayed under that seed, turn by turn, onto the score that was watched.
    expect(banked.body.seed).toBe(kickoff.seed);
    expect(banked.body.turnSeeds).toEqual(j.DECISION_TURNS.map((_, n) => j.matchSeed.deriveTurnSeed(kickoff.seed, n)));
    const result = banked.body.result as { homeScore: number; awayScore: number };
    expect({ homeScore: result.homeScore, awayScore: result.awayScore }).toEqual(watched);
    expect((await j.stateOf(userId)).season.week).toBe(2);

    const committed = (banked.body.updatedGameState as { user: { money: number } }).user.money;
    await expectSettledOnce(userId, start, market.id, watched, committed);
  });

  it('watched in full: market, bets, kickoff, the stream is the match, the bank, one payout', async () => {
    const { userId, start, market } = await newTeamWithBets();

    // Watching the fixture is its kickoff.
    const streamed = await j.streamFixture(userId);
    expect(streamed.status).toBe(200);
    await expectClosedAtKickoff(userId, market.id);
    const [kickoff] = await j.kickoffsOf(userId);
    expect(kickoff).toMatchObject({ round: 1, mode: 'quick' });

    // Watching it again shows the same match: the fixture has one seed.
    expect((await j.streamFixture(userId)).fulltime).toEqual(streamed.fulltime);

    const banked = await j.quickMatch(userId);
    expect(banked.status).toBe(200);
    expect(banked.body.seed).toBe(kickoff.seed);
    const result = banked.body.result as { homeScore: number; awayScore: number };
    const score = { homeScore: result.homeScore, awayScore: result.awayScore };
    expect(score).toEqual({ homeScore: streamed.fulltime!.homeScore, awayScore: streamed.fulltime!.awayScore });

    const committed = (banked.body.updatedGameState as { user: { money: number } }).user.money;
    await expectSettledOnce(userId, start, market.id, score, committed);
  }, 30_000);
});

describe('a match abandoned halfway and played again with other choices', () => {
  it('plays the turns already played as they went, and the rest as now chosen', async () => {
    const userId = await j.newSave();
    const firstPick = (_: number, offered: Array<{ id: string }>) => offered[0] as never;
    const otherPick = (_: number, offered: Array<{ id: string }>) => offered[offered.length - 1] as never;

    // Three turns, then the tab is closed.
    const first = await j.playTurns(userId, { to: 2, pick: firstPick, clientSeed: 'first-tab' });
    expect(first.turns.map(t => t.status)).toEqual([200, 200, 200]);

    // Played again from kickoff, every choice different.
    const again = await j.playTurns(userId, { pick: otherPick, clientSeed: 'second-tab' });
    expect(again.turns.every(t => t.status === 200)).toBe(true);
    for (let n = 0; n < 3; n++) {
      expect(again.turns[n].sent, `turn ${n} was sent a different choice`).not.toBe(first.turns[n].sent);
      expect(again.turns[n].played, `turn ${n} plays the choice made first`).toBe(first.turns[n].played);
      expect(j.football(again.turns[n].body.events)).toEqual(j.football(first.turns[n].body.events));
      expect(j.football(again.turns[n].body.endState)).toEqual(j.football(first.turns[n].body.endState));
    }
    for (let n = 3; n < 6; n++) {
      expect(again.turns[n].played, `turn ${n}, never played before, takes the new choice`).toBe(again.turns[n].sent);
    }

    // Finalize, sent the second run's choices throughout, banks the turns as played.
    const banked = await j.finalize(userId, {
      decisions: again.turns.map(t => t.sent),
      claimedScore: again.score,
    });
    expect(banked.status).toBe(200);
    const history = banked.body.turnHistory as Array<{ decision: { id: string } | null; wasDefault: boolean }>;
    expect(history.map(t => (t.wasDefault ? null : t.decision?.id ?? null))).toEqual(again.turns.map(t => t.played));
    const result = banked.body.result as { homeScore: number; awayScore: number };
    expect({ homeScore: result.homeScore, awayScore: result.awayScore }).toEqual(again.score);
  });
});

describe('the bank and the settlement job at the same moment, on the same fixture', () => {
  it.each([0, 0, 1, 3, 8, 15])('job starting %ims after the bank: one payout, counted once', async delay => {
    const { userId, start, market } = await newTeamWithBets();
    const watched = await j.playTurns(userId);
    const later = (fn: () => Promise<unknown>) => new Promise(r => setTimeout(r, delay)).then(fn);

    const [banked] = await Promise.all([
      j.finalize(userId, { claimedScore: watched.score }),
      later(() => j.runJob()),
      later(() => j.runJob()),
      later(() => j.settlement.settleDueMarkets()),
    ]);
    expect(banked.status).toBe(200);
    await j.runJob();

    expect((await j.stateOf(userId)).season.week).toBe(2);
    const committed = (banked.body.updatedGameState as { user: { money: number } }).user.money;
    await expectSettledOnce(userId, start, market.id, watched.score, committed);
  });
});

describe('the process dies at each write, from the first bet to the last payout', () => {
  it('always leaves books that add up, and recovery finishes the fixture exactly once', async () => {
    let survive = 0;
    let points = 0;
    for (;;) {
      const userId = await j.newSave();
      const start = await j.booksStart(userId);
      const market = await j.theOpenMarket(userId);
      const at = `died after ${survive} write(s)`;

      // The whole fixture, in one go, in a process that dies part way.
      const crash = dieAfterWrites(j.db, survive);
      try {
        await j.betOnEveryOutcome(userId, market, STAKES).catch(() => {});
        const watched = await j.playTurns(userId);
        await j.finalize(userId, { claimedScore: watched.score });
      } catch {
        // Requests the dead process could not even answer.
      }
      const attempted = crash.attempted();
      crash.restart();

      // Whatever it left, it left nothing half done.
      await j.expectBooksBalance(userId, start, `${at}, before recovery:`);

      // Recovery as it happens for real: the job runs; a player whose match
      // did not count plays it again; the job runs again; the bets screen
      // reads the board.
      await j.runJob();
      if ((await j.stateOf(userId)).season.week === 1) {
        const again = await j.playTurns(userId);
        expect(again.turns.every(t => t.status === 200), `${at}: the replay plays`).toBe(true);
        const banked = await j.finalize(userId, { claimedScore: again.score });
        expect(banked.status, `${at}: the replay banks`).toBe(200);
      }
      await j.runJob();
      await j.readBoard(userId);

      expect((await j.stateOf(userId)).season.week, `${at}: banked once`).toBe(2);
      const { bets } = await j.expectBooksBalance(userId, start, `${at}, after recovery:`);
      expect(bets.every(b => b.settled), `${at}: every bet settled`).toBe(true);
      expect(await j.historyCounts(userId), `${at}: history`).toEqual(j.expectedHistory(bets));
      expect((await j.marketById(market.id)).status, at).toBe('settled');
      expect((await j.openMarketsOf(userId)).map(m => m.matchId), `${at}: one market on the next fixture`).toEqual(['round-2']);

      points += 1;
      if (attempted <= survive) break; // the run reached the end without dying
      survive += 1;
    }
    // A crash point for every write the fixture makes, and then some.
    expect(points).toBeGreaterThan(20);
  }, 300_000);
});
