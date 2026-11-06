// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { openJourney, ADMIN_SECRET, CRON_SECRET, type Journey } from '@/test/journey';

/**
 * The cases a real deployment meets that a clean run never does: a bet the
 * previous settlement code left half done, a player mid-match when the new
 * code goes live, a client sending a decision the server never offered, a
 * second season reusing the first one's round numbers, and the table
 * handing settlement its bets in an order of its own.
 *
 * Real routes against the real embedded Postgres.
 */

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => null) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

// Each test plays whole matches against a real database, several in some;
// on a machine busy with other work that is seconds, not milliseconds.
vi.setConfig({ testTimeout: 60_000 });

let j: Journey;
let resolveRoute: (request: Request) => Promise<Response>;
beforeAll(async () => {
  j = await openJourney('edge');
  // A missing route fails only the tests that use it.
  resolveRoute = await import('../predictions/resolve/route')
    .then(m => m.POST as never)
    .catch(() => async () => new Response(JSON.stringify({ error: 'no such route' }), { status: 404 }));
}, 60_000);
afterAll(async () => j.close());
beforeEach(() => {
  vi.restoreAllMocks();
  for (const level of ['warn', 'error', 'info', 'log'] as const) vi.spyOn(console, level).mockImplementation(() => {});
});

describe('a bet the previous settlement code left claimed', () => {
  /**
   * Settlement used to claim a bet, then pay it, then mark it. A run that
   * died after the claim left the bet claimed and unsettled, and the save
   * shows no sign of whether the payout went out. Here: three bets, all
   * claimed by such a run, with the match then banked.
   */
  async function betsLeftClaimed(oldRunPaidTheWinner: boolean) {
    const userId = await j.newSave();
    const start = await j.booksStart(userId);
    const market = await j.theOpenMarket(userId);
    await j.betOnEveryOutcome(userId, market);
    await j.db
      .update(j.schema.userBets)
      .set({ settlingAt: new Date() })
      .where(j.drizzle.eq(j.schema.userBets.userId, userId));

    const watched = await j.playTurns(userId);
    const banked = await j.finalize(userId, { claimedScore: watched.score });
    expect(banked.status).toBe(200);

    const winner = j.winnerOf(market, watched.score);
    const winning = (await j.betsOf(userId)).find(b => b.optionId === winner)!;
    if (oldRunPaidTheWinner) {
      // The payout the old run made before it died.
      expect((await j.saveStore.adjustMoney(userId, winning.potentialWin)).ok).toBe(true);
    }
    return { userId, start, market, winning };
  }

  function resolve(body: unknown, secret = ADMIN_SECRET) {
    return resolveRoute(j.post('/api/predictions/resolve', body, { authorization: `Bearer ${secret}` }));
  }

  it('the losing bets are finished by the job: no money was ever going to move', async () => {
    const { userId, winning } = await betsLeftClaimed(false);
    const before = await j.moneyOf(userId);
    await j.runJob();

    const losers = (await j.betsOf(userId)).filter(b => b.id !== winning.id);
    for (const bet of losers) expect(bet).toMatchObject({ settled: true, won: false, payout: 0, settlingAt: null });
    expect(await j.moneyOf(userId)).toBe(before);
  });

  it.each([false, true])(
    'the winning bet (old run paid it: %s) is neither paid nor written off, but held for an operator',
    async oldRunPaid => {
      const { userId, winning } = await betsLeftClaimed(oldRunPaid);
      const before = await j.moneyOf(userId);

      const job = await j.runJob();
      await j.runJob();
      expect(await j.moneyOf(userId)).toBe(before);
      const held = (await j.betsOf(userId)).find(b => b.id === winning.id)!;
      expect(held).toMatchObject({ settled: false, payout: null });
      expect(held.settlingAt).not.toBeNull();

      // Named, not just counted, so someone can act on it.
      const review = job.body.needsReview as Array<{ betId: string }>;
      expect(review.map(r => r.betId)).toContain(winning.id);
      // And the player is told it is being looked at, not that it is in play.
      const board = await j.readBoard(userId);
      expect(board.bets.find(b => b.id === winning.id)).toMatchObject({ status: 'under_review', payout: null });
    }
  );

  it.each([false, true])(
    'an operator resolves it once (old run paid it: %s), and the books then add up',
    async oldRunPaid => {
      const { userId, start, winning } = await betsLeftClaimed(oldRunPaid);
      await j.runJob();

      // Only with the admin secret: the job's secret cannot decide this.
      expect((await resolve({ betId: winning.id, paidByOldRun: oldRunPaid }, CRON_SECRET)).status).toBe(403);

      const before = await j.moneyOf(userId);
      const resolved = await resolve({ betId: winning.id, paidByOldRun: oldRunPaid });
      expect(resolved.status).toBe(200);
      // Credited now only if the old run had not.
      expect(await j.moneyOf(userId)).toBe(before + (oldRunPaid ? 0 : winning.potentialWin));
      const bet = (await j.betsOf(userId)).find(b => b.id === winning.id)!;
      expect(bet).toMatchObject({ settled: true, won: true, payout: winning.potentialWin, settlingAt: null });

      // Once.
      expect((await resolve({ betId: winning.id, paidByOldRun: false })).status).toBe(409);
      expect(await j.moneyOf(userId)).toBe(before + (oldRunPaid ? 0 : winning.potentialWin));

      const { bets } = await j.expectBooksBalance(userId, start);
      expect(await j.historyCounts(userId)).toEqual(j.expectedHistory(bets));
      const stillHeld = ((await j.runJob()).body.needsReview as Array<{ userId: string }>).filter(r => r.userId === userId);
      expect(stillHeld).toEqual([]);
    }
  );

  it('a bet that is not held cannot be resolved by hand', async () => {
    const userId = await j.newSave();
    const market = await j.theOpenMarket(userId);
    await j.betOnEveryOutcome(userId, market);
    const [bet] = await j.betsOf(userId);
    expect((await resolve({ betId: bet.id, paidByOldRun: false })).status).toBe(409);
    expect((await j.betsOf(userId))[0].settled).toBe(false);
  });
});

describe('a player mid-match when this deploys', () => {
  it('cannot bank the match they watched under their own seed, is never stuck, and replaying banks it once', async () => {
    const userId = await j.newSave();
    const start = await j.booksStart(userId);
    const market = await j.theOpenMarket(userId);
    await j.betOnEveryOutcome(userId, market);
    const state = await j.stateOf(userId);

    // Before the deploy: the old decide closed the market at kickoff and
    // played three turns under the seed the client drew, writing nothing
    // else. (The old route was stateless; the shared runner it called is
    // the same one, under the client's seed and the save's morale.)
    await j.db
      .update(j.schema.predictions)
      .set({ status: 'closed', kickedOffAt: new Date() })
      .where(j.drizzle.eq(j.schema.predictions.id, market.id));
    const { playDecisionTurn } = await import('@/lib/match-replay');
    let prior = j.kickoffPrior(state) as never as Parameters<typeof playDecisionTurn>[3];
    let offered: Array<{ id: string }> = [];
    for (let n = 0; n < 3; n++) {
      const turn = playDecisionTurn(
        { userTeam: state.user.team, opponentTeam: state.season.nextMatch.opponent, isHome: state.season.nextMatch.isHome, userMorale: state.squad.morale, week: 1 },
        n, null, prior, j.matchSeed.deriveTurnSeed('pre-deploy-client-seed', n)
      );
      prior = turn.endState;
      offered = (turn.nextTurn?.options ?? []) as never;
    }
    expect(await j.kickoffsOf(userId)).toHaveLength(0);

    // After the deploy: the same screen carries on from turn 3.
    const rest = await j.playTurns(userId, { from: 3, prior: prior as never, offered: offered as never, clientSeed: 'pre-deploy-client-seed' });
    expect(rest.turns.every(t => t.status === 200)).toBe(true);
    const [kickoff] = await j.kickoffsOf(userId);
    const first = await j.finalize(userId, { claimedScore: rest.score, seed: 'pre-deploy-client-seed' });

    if (first.status === 200) {
      // Only if the replay happened to land on the score watched: then it is
      // still the server's match that was banked.
      expect(first.body.seed).toBe(kickoff.seed);
    } else {
      expect(first.status).toBe(409);
      expect(first.body.error).toBe('Score mismatch');
      expect((await j.stateOf(userId)).season.week).toBe(1);
      // The screen sends the player back; starting the match again replays
      // it from kickoff under the fixture's seed, and that banks.
      const again = await j.playTurns(userId);
      expect(again.turns.every(t => t.status === 200)).toBe(true);
      const banked = await j.finalize(userId, { claimedScore: again.score });
      expect(banked.status).toBe(200);
      expect(banked.body.seed).toBe(kickoff.seed);
    }

    expect((await j.stateOf(userId)).season.week).toBe(2);
    const { bets } = await j.expectBooksBalance(userId, start);
    expect(bets.every(b => b.settled)).toBe(true);
    expect(bets.filter(b => b.won)).toHaveLength(1);
  });
});

describe('a client that sends a decision the server never offered', () => {
  it('an invented option is refused before anything is recorded, shown or kicked off', async () => {
    const userId = await j.newSave();
    const market = await j.theOpenMarket(userId);
    const invented = {
      id: 'turn_0_all_out_attack', label: 'Tudo ao ataque', description: '', icon: '',
      action: 'change_formation', category: 'formation', formation: '1-1-8', mentality: 'attacking',
    };
    const refused = await j.playTurns(userId, { to: 0, pick: () => invented });
    expect(refused.turns[0].status).toBe(400);
    expect(refused.turns[0].body.events).toBeUndefined();
    expect(await j.kickoffsOf(userId)).toHaveLength(0);
    expect((await j.marketById(market.id)).status).toBe('open');

    // The turn is still there to be played properly.
    const proper = await j.playTurns(userId, { to: 0, pick: (_, offered) => offered[0] as never });
    expect(proper.turns[0].status).toBe(200);
  });

  it('an offered id with doctored contents plays the option the server offered', async () => {
    const userId = await j.newSave();
    const doctored = await j.playTurns(userId, {
      pick: (n, offered) => (n === 0 ? ({ ...offered[0], formation: '1-1-8', mentality: 'attacking', label: 'forged' } as never) : null),
    });
    expect(doctored.turns.every(t => t.status === 200)).toBe(true);
    const state = await j.stateOf(userId);
    const real = j.decisionEngine.buildDecisionTurn(0, 0, 0, state.squad.players, state.squad.formation || '4-3-3', 'balanced', false).options[0];
    const played = (doctored.turns[0].body.turnResult as { decision: Record<string, unknown> }).decision;
    expect(played).toMatchObject({ id: real.id, label: real.label });
    expect(played.formation).toBe(real.formation);

    // What was shown is what banks.
    const banked = await j.finalize(userId, { decisions: doctored.decisions, claimedScore: doctored.score });
    expect(banked.status).toBe(200);
  });

  it('finalize refuses an unoffered decision for a turn never played, and records nothing for it', async () => {
    const userId = await j.newSave();
    const refused = await j.finalize(userId, { decisions: ['turn_0_all_out_attack', null, null, null, null, null] });
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('unknown_decision');
    const [kickoff] = await j.kickoffsOf(userId);
    expect(kickoff?.decisions ?? {}).toEqual({});
    expect((await j.finalize(userId)).status).toBe(200);
  });
});

describe('a second season reusing the first season’s round numbers', () => {
  /** What a season rollover does to the save; nothing in the game does it yet. */
  async function startNextSeason(userId: string) {
    const save = await j.loadSave(userId);
    const state = save.state;
    state.season.number = (state.season.number ?? 1) + 1;
    state.season.week = 1;
    state.season.points = 0;
    state.season.wins = 0;
    state.season.draws = 0;
    state.season.losses = 0;
    expect((await j.saveStore.commitSave(userId, state, save.version)).ok).toBe(true);
  }

  it('gets its own market, kickoff, seed and settlement, and leaves last season’s alone', async () => {
    const userId = await j.newSave();
    const start = await j.booksStart(userId);

    // Season one, round one, banked and paid.
    const firstMarket = await j.theOpenMarket(userId);
    await j.betOnEveryOutcome(userId, firstMarket);
    const firstMatch = await j.playTurns(userId, { pick: (_, offered) => offered[0] as never });
    expect((await j.finalize(userId, { decisions: firstMatch.decisions, claimedScore: firstMatch.score })).status).toBe(200);
    const [firstKickoff] = await j.kickoffsOf(userId);
    const lastSeason = { market: await j.marketById(firstMarket.id), bets: await j.betsOf(userId) };

    await startNextSeason(userId);
    await j.readBoard(userId);

    // A market of its own on the new round one.
    const open = await j.openMarketsOf(userId);
    expect(open, 'the new season’s round 1 has an open market').toHaveLength(1);
    const market = open[0];
    expect(market.id).not.toBe(firstMarket.id);
    expect(market.matchId).toBe('s2-round-1');
    await j.betOnEveryOutcome(userId, market);

    // A kickoff of its own: a new seed, nothing recorded from last season.
    const turn = await j.playTurns(userId, { to: 0 });
    expect(turn.turns[0].status).toBe(200);
    const kickoffs = await j.kickoffsOf(userId);
    expect(kickoffs).toHaveLength(2);
    const current = kickoffs.find(k => k.seed !== firstKickoff.seed)!;
    expect(current, 'a fresh seed').toBeDefined();
    expect(Object.keys(current.decisions)).toEqual(['0']);

    // The job, with last season's round-1 score in the save, leaves the new
    // round-1 market alone until that match is banked.
    await j.runJob();
    expect((await j.marketById(market.id)).status).toBe('closed');

    const rest = await j.playTurns(userId, { from: 1, prior: turn.prior, offered: turn.offered });
    const banked = await j.finalize(userId, { claimedScore: rest.score });
    expect(banked.status).toBe(200);
    const settled = await j.marketById(market.id);
    expect(settled.status).toBe('settled');
    expect({ homeScore: settled.homeScore, awayScore: settled.awayScore }).toEqual(rest.score);

    // Last season's market and bets are exactly as they were.
    expect(await j.marketById(firstMarket.id)).toEqual(lastSeason.market);
    const lastSeasonIds = new Set(lastSeason.bets.map(b => b.id));
    expect((await j.betsOf(userId)).filter(b => lastSeasonIds.has(b.id))).toEqual(lastSeason.bets);

    const { bets } = await j.expectBooksBalance(userId, start);
    expect(bets.every(b => b.settled)).toBe(true);
    expect(await j.historyCounts(userId)).toEqual(j.expectedHistory(bets));
    expect((await j.openMarketsOf(userId)).map(m => m.matchId)).toEqual(['s2-round-2']);
  });
});

describe('the order settlement counts a fixture’s bets in', () => {
  it('is the order they were placed, whatever order the table returns them in', async () => {
    const userId = await j.newSave();
    const market = await j.theOpenMarket(userId);
    await j.betOnEveryOutcome(userId, market);
    const [first] = await j.betsOf(userId);

    // An update writes a new row version, so a plain scan now returns the
    // first bet placed last.
    await j.db.execute(j.drizzle.sql`update user_bets set amount = amount where id = ${first.id}::uuid`);

    // Home wins: placed win, loss, loss, which ends the streak; counted in
    // the table's order (loss, loss, win) it would leave a streak of one.
    await j.settlement.recordMarketResult(market.id, { homeScore: 2, awayScore: 0 });
    await j.settlement.settleMarket(market.id);
    const bets = await j.betsOf(userId); // in the order placed
    expect(bets[0].won).toBe(true);
    // Settled in the order placed...
    const settledOrder = [...bets].sort((a, b) => +new Date(a.settledAt!) - +new Date(b.settledAt!));
    expect(settledOrder.map(b => b.id)).toEqual(bets.map(b => b.id));
    // ...so the streak is the one the order placed gives: win, loss, loss.
    expect(await j.historyCounts(userId)).toEqual(j.expectedHistory(bets));
    expect((await j.historyCounts(userId)).currentStreak).toBe(0);
  });
});
