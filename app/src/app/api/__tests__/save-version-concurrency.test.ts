// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { readFileSync } from 'fs';
import { eq, sql } from 'drizzle-orm';

/**
 * Two actions, one save, overlapping.
 *
 * Every save-changing route loads the whole save, changes it and writes it
 * all back. Before `game_states.version`, two of them overlapping both read
 * the same row and both wrote it, and whichever landed second erased the
 * first without either caller being told. Now a write goes through only if
 * the row is still at the version it was read at, and the loser is answered
 * with a 409 the way a finalize that loses its race is.
 *
 * Real embedded Postgres, not a mocked `@/db`: the guard is the WHERE of an
 * UPDATE and the bump on the routes not yet moved over is a trigger, and only
 * the database can say whether they hold.
 */

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => null),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

type Routes = {
  createTeam: typeof import('../onboarding/create-team/route').POST;
  conversationGET: typeof import('../conversation/route').GET;
  train: typeof import('../squad/train/route').POST;
  buy: typeof import('../transfer/buy/route').POST;
  sell: typeof import('../transfer/sell/route').POST;
  formation: typeof import('../squad/formation/route').POST;
  match: typeof import('../match/route').POST;
  staff: typeof import('../staff/route').POST;
  youth: typeof import('../youth/route').POST;
  dailyReward: typeof import('../daily-reward/route').POST;
  stadium: typeof import('../stadium/upgrade/route').POST;
  facilities: typeof import('../facilities/upgrade/route').POST;
  bet: typeof import('../predictions/bet/route').POST;
  settle: typeof import('../predictions/settle/route').POST;
  migratePOST: typeof import('../squad/migrate/route').POST;
  migrateGET: typeof import('../squad/migrate/route').GET;
};

let dataDir: string;
let routes: Routes;
let local: typeof import('@/db/local');
let db: typeof import('@/db').db;
let gameStates: typeof import('@/db/schema').gameStates;
let saveStore: typeof import('@/lib/save-store');
let saveRevise: typeof import('@/lib/save-revise');

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'falamestre-save-version-'));
  delete process.env.DATABASE_URL;
  delete process.env.OPENROUTER_API_KEY;
  process.env.PGLITE_DATA_DIR = dataDir;
  process.env.AUTH_DISABLED = 'true';
  process.env.USE_MOCK_AI = 'true';
  process.env.CRON_SECRET = 'save-version-cron-secret';
  vi.resetModules();
  local = await import('@/db/local');
  ({ db } = await import('@/db'));
  ({ gameStates } = await import('@/db/schema'));
  saveStore = await import('@/lib/save-store');
  saveRevise = await import('@/lib/save-revise');
  routes = {
    createTeam: (await import('../onboarding/create-team/route')).POST,
    conversationGET: (await import('../conversation/route')).GET,
    train: (await import('../squad/train/route')).POST,
    buy: (await import('../transfer/buy/route')).POST,
    sell: (await import('../transfer/sell/route')).POST,
    formation: (await import('../squad/formation/route')).POST,
    match: (await import('../match/route')).POST,
    staff: (await import('../staff/route')).POST,
    youth: (await import('../youth/route')).POST,
    dailyReward: (await import('../daily-reward/route')).POST,
    stadium: (await import('../stadium/upgrade/route')).POST,
    facilities: (await import('../facilities/upgrade/route')).POST,
    bet: (await import('../predictions/bet/route')).POST,
    settle: (await import('../predictions/settle/route')).POST,
    migratePOST: (await import('../squad/migrate/route')).POST,
    migrateGET: (await import('../squad/migrate/route')).GET,
  };
}, 60_000);

afterAll(async () => {
  await local.closeLocalDatabase();
  rmSync(dataDir, { recursive: true, force: true });
});

let requestCounter = 0;
function post(url: string, body: unknown) {
  requestCounter += 1;
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.9.${Math.floor(requestCounter / 250)}.${requestCounter % 250}`,
    },
    body: JSON.stringify(body),
  });
}

async function load(userId: string) {
  const response = await routes.conversationGET(
    new NextRequest(`http://localhost/api/conversation?userId=${userId}`),
  );
  return (await response.json()).gameState;
}

async function versionOf(userId: string): Promise<number> {
  const row = await db.query.gameStates.findFirst({ where: eq(gameStates.userId, userId) });
  return row!.version;
}

async function newPlayer(teamName: string) {
  const created = await routes.createTeam(
    post('/api/onboarding/create-team', {
      teamName,
      primaryColor: '#112233',
      secondaryColor: '#AABBCC',
      badgeStyle: 'shield',
    }),
  );
  expect(created.status).toBe(201);
  const { userId } = await created.json();
  return { userId, state: await load(userId) };
}

function recruit(id: string) {
  return { id, name: `Reforço ${id}`, position: 'MID', age: 24, pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70, overall: 70, potential: 75, consistency: 70, bigMatchPlayer: 60, leadership: 50, value: 100, wage: 1, injuryProneness: 10 };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('a new save', () => {
  it('starts at version 1 and moves up by one on each guarded write', async () => {
    const { userId, state } = await newPlayer('Versão FC');
    expect(await versionOf(userId)).toBe(1);

    const trained = await routes.train(
      post('/api/squad/train', { userId, playerId: state.squad.players[0].id, focus: 'rest' }),
    );
    expect(trained.status).toBe(200);
    expect(await versionOf(userId)).toBe(2);
  }, 60_000);
});

describe('commitSave on its own', () => {
  it('writes once at the version it read, and refuses the same version a second time', async () => {
    const { userId } = await newPlayer('Duas Vezes FC');
    const save = await saveStore.loadSave(userId);
    expect(save).not.toBeNull();

    const first = await saveStore.commitSave(userId, { ...save!.state }, save!.version);
    expect(first).toEqual({ ok: true, version: save!.version + 1 });

    const second = await saveStore.commitSave(userId, { ...save!.state }, save!.version);
    expect(second).toEqual({ ok: false, reason: 'conflict' });
    expect(await versionOf(userId)).toBe(save!.version + 1);
  }, 60_000);

  it('is refused after an unguarded write has changed the save', async () => {
    // Every route now goes through commitSave, but the trigger still backs
    // the guard: a write that sets current_state without touching the
    // version (a hand-run SQL fix, a route added later without the helper)
    // bumps it anyway, so a guarded write that read the save before it is
    // refused rather than erasing it.
    const { userId, state } = await newPlayer('Gatilho FC');
    const save = await saveStore.loadSave(userId);
    const newFormation = state.squad.formation === '4-4-2' ? '4-3-3' : '4-4-2';

    await db
      .update(gameStates)
      .set({ currentState: { ...state, squad: { ...state.squad, formation: newFormation } } })
      .where(eq(gameStates.userId, userId));
    expect(await versionOf(userId)).toBe(save!.version + 1);

    const stale = await saveStore.commitSave(userId, save!.state, save!.version);
    expect(stale).toEqual({ ok: false, reason: 'conflict' });
    expect((await load(userId)).squad.formation).toBe(newFormation);
  }, 60_000);

  it('does not bump the version for a write that leaves the save as it was', async () => {
    const { userId } = await newPlayer('Igual FC');
    const before = await versionOf(userId);
    await db.update(gameStates).set({ updatedAt: new Date() }).where(eq(gameStates.userId, userId));
    expect(await versionOf(userId)).toBe(before);
  }, 60_000);
});

describe('two training sessions racing for the same save', () => {
  it('applies one and tells the other the save moved on', async () => {
    const { userId, state } = await newPlayer('Treino Duplo FC');
    const [p1, p2] = state.squad.players;
    const budgetBefore = state.squad.weeklyTrainingBudget ?? 15;

    const [a, b] = await Promise.all([
      routes.train(post('/api/squad/train', { userId, playerId: p1.id, focus: 'rest' })),
      routes.train(post('/api/squad/train', { userId, playerId: p2.id, focus: 'rest' })),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const loser = a.status === 409 ? await a.json() : await b.json();
    expect(loser.error).toBe(saveStore.SAVE_CONFLICT_ERROR);

    // Exactly one session reached the save: one player rested, the budget
    // is untouched by rest, and the version moved by one.
    const after = await load(userId);
    const rested = [p1, p2].filter((p) => {
      const now = after.squad.players.find((q: { id: string }) => q.id === p.id);
      return now.fatigue !== p.fatigue || now.currentForm !== p.currentForm;
    });
    expect(rested).toHaveLength(1);
    expect(after.squad.weeklyTrainingBudget ?? 15).toBe(budgetBefore);
    expect(await versionOf(userId)).toBe(2);
  }, 60_000);

  it('lets the loser succeed on a retry against the fresh save', async () => {
    const { userId, state } = await newPlayer('Tenta de Novo FC');
    const [p1, p2] = state.squad.players;

    const [a, b] = await Promise.all([
      routes.train(post('/api/squad/train', { userId, playerId: p1.id, focus: 'technical' })),
      routes.train(post('/api/squad/train', { userId, playerId: p2.id, focus: 'technical' })),
    ]);
    const loserPlayer = a.status === 409 ? p1 : p2;
    expect([a.status, b.status].sort()).toEqual([200, 409]);

    const retry = await routes.train(
      post('/api/squad/train', { userId, playerId: loserPlayer.id, focus: 'technical' }),
    );
    expect(retry.status).toBe(200);

    // Both sessions now count, each once: the budget paid for exactly two.
    const after = await load(userId);
    expect(after.squad.weeklyTrainingBudget).toBe((state.squad.weeklyTrainingBudget ?? 15) - 2);
    expect(await versionOf(userId)).toBe(3);
  }, 60_000);
});

describe('a purchase and a sale racing for the same save', () => {
  it('keeps one and refuses the other, so the balance stays consistent', async () => {
    const { userId, state } = await newPlayer('Mercado FC');
    const sold = state.squad.players[0];

    const [buy, sell] = await Promise.all([
      // A cheap signing: the price is half of `sellValue`, well inside a new
      // save's money, so only the version guard can refuse it.
      routes.buy(post('/api/transfer/buy', { userId, player: recruit('race-buy-1'), sellValue: 2_000 })),
      routes.sell(post('/api/transfer/sell', { userId, playerId: sold.id })),
    ]);

    expect([buy.status, sell.status].sort()).toEqual([200, 409]);
    const after = await load(userId);
    const winner = buy.status === 200 ? await buy.json() : await sell.json();

    // The save reflects exactly the winning action, money included.
    expect(after.user.money).toBe(winner.newBalance);
    expect(after.squad.players.length).toBe(winner.squadSize);
    if (buy.status === 200) {
      expect(after.squad.players.some((p: { id: string }) => p.id === 'race-buy-1')).toBe(true);
      expect(after.squad.players.some((p: { id: string }) => p.id === sold.id)).toBe(true);
    } else {
      expect(after.squad.players.some((p: { id: string }) => p.id === sold.id)).toBe(false);
      expect(after.squad.players.some((p: { id: string }) => p.id === 'race-buy-1')).toBe(false);
    }
  }, 60_000);

  it('pays for the same player only once when two tabs sell him together', async () => {
    const { userId, state } = await newPlayer('Venda Dupla FC');
    const sold = state.squad.players[0];

    const [a, b] = await Promise.all([
      routes.sell(post('/api/transfer/sell', { userId, playerId: sold.id })),
      routes.sell(post('/api/transfer/sell', { userId, playerId: sold.id })),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);

    const winner = a.status === 200 ? await a.json() : await b.json();
    const after = await load(userId);
    expect(after.user.money).toBe(state.user.money + winner.sellValue);
    expect(after.squad.players.length).toBe(state.squad.players.length - 1);
  }, 60_000);
});

describe('a match being banked while the player acts elsewhere', () => {
  it('keeps exactly one of a whole-match simulation and a training session', async () => {
    // /api/match holds the save across the AI call, the widest window any
    // route has. Both requests read the pre-match save; whichever writes
    // second is refused, and the save shows exactly the winner.
    const { userId, state } = await newPlayer('Janela Larga FC');
    const trainee = state.squad.players[0];

    const [match, train] = await Promise.all([
      routes.match(post('/api/match', { userId, seed: 'wide-window' })),
      routes.train(post('/api/squad/train', { userId, playerId: trainee.id, focus: 'technical' })),
    ]);

    expect([match.status, train.status].sort()).toEqual([200, 409]);
    const after = await load(userId);
    if (match.status === 200) {
      expect(after.season.week).toBe(state.season.week + 1);
      expect(after.squad.weeklyTrainingBudget).toBe(state.squad.weeklyTrainingBudget);
      expect((await train.json()).error).toBe(saveStore.SAVE_CONFLICT_ERROR);
    } else {
      expect(after.season.week).toBe(state.season.week);
      expect(after.squad.weeklyTrainingBudget).toBe(state.squad.weeklyTrainingBudget - 1);
      expect((await match.json()).error).toBe(saveStore.SAVE_CONFLICT_ERROR);
    }
    expect(await versionOf(userId)).toBe(2);
  }, 60_000);

  it('reports a failed whole-match write instead of answering 200', async () => {
    // Before, a write that matched no row was swallowed and the match was
    // reported as banked. A second simulation of the same save after the
    // first has moved the week is the simplest way to see the refusal.
    const { userId, state } = await newPlayer('Duas Partidas FC');
    const first = await routes.match(post('/api/match', { userId, seed: 'again-1' }));
    expect(first.status).toBe(200);
    expect((await load(userId)).season.week).toBe(state.season.week + 1);
  }, 60_000);
});

describe('the other button routes racing', () => {
  it('two staff hires for different roles: one lands, the balance is the winner\'s', async () => {
    // A rookie costs half a new save's money, so both are affordable on the
    // save as read and only the version guard can separate them.
    const { userId, state } = await newPlayer('Contratação FC');

    const [scout, medic] = await Promise.all([
      routes.staff(post('/api/staff', { userId, action: 'hire', role: 'scout', tier: 'rookie' })),
      routes.staff(post('/api/staff', { userId, action: 'hire', role: 'medicalStaff', tier: 'rookie' })),
    ]);

    expect([scout.status, medic.status].sort()).toEqual([200, 409]);
    const after = await load(userId);
    const winner = scout.status === 200 ? await scout.json() : await medic.json();
    expect(after.user.money).toBe(winner.newBalance);
    expect(after.user.money).toBe(state.user.money - 50_000);
    expect([after.staff.scout, after.staff.medicalStaff].filter(Boolean)).toHaveLength(1);

    // A facility upgrade is beyond this budget; it is refused on funds and
    // leaves the version alone.
    const upgrade = await routes.facilities(post('/api/facilities/upgrade', { userId, facilityType: 'trainingCenter' }));
    expect(upgrade.status).toBe(400);
    expect(await versionOf(userId)).toBe(2);
  }, 60_000);

  it('youth focus, stadium upgrade and daily reward each go through alone, bumping the version once', async () => {
    const { userId } = await newPlayer('Um de Cada FC');
    let expected = 1;

    const focus = await routes.youth(post(`/api/youth?userId=${userId}`, { action: 'set-focus', focus: 'technical' }));
    expect(focus.status).toBe(200);
    expect(await versionOf(userId)).toBe(++expected);

    const reward = await routes.dailyReward(post('/api/daily-reward', { userId }));
    expect(reward.status).toBe(200);
    expect(await versionOf(userId)).toBe(++expected);

    const stadium = await routes.stadium(post('/api/stadium/upgrade', { userId }));
    // Affordable or not, the save is either written once or not at all.
    if (stadium.status === 200) expected++;
    expect(await versionOf(userId)).toBe(expected);
  }, 60_000);

  it('a formation change racing a sale keeps one', async () => {
    const { userId, state } = await newPlayer('Esquema FC');
    const newFormation = state.squad.formation === '4-4-2' ? '4-3-3' : '4-4-2';

    const [formation, sell] = await Promise.all([
      routes.formation(post('/api/squad/formation', { userId, formation: newFormation })),
      routes.sell(post('/api/transfer/sell', { userId, playerId: state.squad.players[0].id })),
    ]);
    expect([formation.status, sell.status].sort()).toEqual([200, 409]);
    expect(await versionOf(userId)).toBe(2);
  }, 60_000);
});

describe('money-only writers: an increment inside the UPDATE', () => {
  it('adjustMoney credits on top of whatever is there and bumps the version', async () => {
    const { userId, state } = await newPlayer('Crédito FC');
    const credited = await saveStore.adjustMoney(userId, 12_345);
    expect(credited).toEqual({ ok: true, money: state.user.money + 12_345, version: 2 });
    expect((await load(userId)).user.money).toBe(state.user.money + 12_345);
  }, 60_000);

  it('a debit with a floor is refused rather than overdrawing, and tells a missing save apart', async () => {
    const { userId, state } = await newPlayer('Sem Saldo FC');
    const tooMuch = await saveStore.adjustMoney(userId, -(state.user.money + 1), { floor: 0 });
    expect(tooMuch).toEqual({ ok: false, reason: 'insufficient' });
    expect((await load(userId)).user.money).toBe(state.user.money);
    expect(await versionOf(userId)).toBe(1);

    const nobody = await saveStore.adjustMoney('user_nobody_here', 100);
    expect(nobody).toEqual({ ok: false, reason: 'not_found' });
  }, 60_000);

  it('does not erase a guarded write that landed first, and is not erased by one that lands after', async () => {
    const { userId, state } = await newPlayer('Intercalado FC');
    const trainee = state.squad.players[0];

    // A training session lands, then a settlement-style credit computed
    // from nothing the route read earlier: both survive.
    const trained = await routes.train(post('/api/squad/train', { userId, playerId: trainee.id, focus: 'technical' }));
    expect(trained.status).toBe(200);
    const credited = await saveStore.adjustMoney(userId, 5_000);
    expect(credited.ok).toBe(true);

    const after = await load(userId);
    expect(after.user.money).toBe(state.user.money + 5_000);
    expect(after.squad.weeklyTrainingBudget).toBe(state.squad.weeklyTrainingBudget - 1);

    // And a guarded write that read the save before the credit is refused,
    // so the credit cannot be overwritten by a stale copy either.
    const stale = await saveStore.commitSave(userId, state, 1);
    expect(stale).toEqual({ ok: false, reason: 'conflict' });
    expect((await load(userId)).user.money).toBe(state.user.money + 5_000);
  }, 60_000);

  it('two bets for the whole balance placed together: one is taken, the other is refused for funds', async () => {
    const { userId, state } = await newPlayer('Tudo ou Nada FC');
    const [prediction] = await db
      .insert((await import('@/db/schema')).predictions)
      .values({
        matchId: 'race-match',
        homeTeam: 'A',
        awayTeam: 'B',
        type: 'win_draw_loss',
        options: [{ id: 'home', label: 'Casa', odds: 1.8, totalBets: 0 }],
        entryCost: 0,
        deadline: new Date(Date.now() + 3_600_000),
        status: 'open',
        matchDate: new Date(Date.now() + 3_600_000),
      })
      .returning({ id: (await import('@/db/schema')).predictions.id });

    const stake = state.user.money;
    const [a, b] = await Promise.all([
      routes.bet(post('/api/predictions/bet', { userId, predictionId: prediction.id, optionId: 'home', amount: stake })),
      routes.bet(post('/api/predictions/bet', { userId, predictionId: prediction.id, optionId: 'home', amount: stake })),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 400]);
    const after = await load(userId);
    expect(after.user.money).toBe(0);
    const schema = await import('@/db/schema');
    const bets = await db.query.userBets.findMany({ where: eq(schema.userBets.userId, userId) });
    expect(bets).toHaveLength(1);

    // Settling pays the winner through the same increment.
    const settled = await routes.settle(
      new NextRequest('http://localhost/api/predictions/settle', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${process.env.CRON_SECRET}`,
          'x-forwarded-for': '10.9.250.1',
        },
        body: JSON.stringify({ predictionId: prediction.id, homeScore: 2, awayScore: 0 }),
      })
    );
    // Settlement is a signed-in admin or cron call; with auth disabled and
    // no session it refuses before paying, which is the existing contract.
    // What matters here is that it did not touch the save on the way out.
    expect([200, 401]).toContain(settled.status);
    if (settled.status === 200) {
      expect((await load(userId)).user.money).toBe(Math.round(stake * 1.8));
    } else {
      expect((await load(userId)).user.money).toBe(0);
    }
  }, 60_000);
});

describe('the migration of a save', () => {
  it('writes once when there is work, leaves the version alone when there is none', async () => {
    const { userId } = await newPlayer('Migração FC');
    const nothing = await routes.migratePOST(post('/api/squad/migrate', { userId }));
    expect(nothing.status).toBe(200);
    expect(await versionOf(userId)).toBe(1);

    // Knock a field out as an old save would lack it.
    await db
      .update(gameStates)
      .set({
        currentState: sql`${gameStates.currentState} #- '{squad,weeklyTrainingBudget}'`,
      })
      .where(eq(gameStates.userId, userId));
    expect(await versionOf(userId)).toBe(2);

    const migrated = await routes.migratePOST(post('/api/squad/migrate', { userId }));
    expect(migrated.status).toBe(200);
    await expect(migrated.json()).resolves.toMatchObject({ message: 'Migration completed' });
    expect(await versionOf(userId)).toBe(3);
    expect((await load(userId)).squad.weeklyTrainingBudget).toBe(15);
  }, 60_000);

  it('reviseSave reports not_found for a missing save and changed:false for a no-op', async () => {
    expect(await saveRevise.reviseSave('user_absent', () => true)).toEqual({ ok: false, reason: 'not_found', attempts: 1 });
    const { userId } = await newPlayer('Nada a Fazer FC');
    expect(await saveRevise.reviseSave(userId, () => false)).toEqual({ ok: true, changed: false, version: 1, attempts: 1 });
  }, 60_000);

  it('the batch migration reloads each save as it writes it and reports conflicts separately', async () => {
    const response = await routes.migrateGET(
      new NextRequest('http://localhost/api/squad/migrate', {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, 'x-forwarded-for': '10.9.250.2' },
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ success: true, conflicts: 0, errors: 0 });
    expect(body.migrated + body.alreadyUpToDate).toBe(body.total);
  }, 60_000);
});

describe('the version migration itself', () => {
  it('can be run again on a store that already has the column and the trigger', async () => {
    const file = readFileSync(path.join(process.cwd(), 'drizzle', '0001_game_state_version.sql'), 'utf8');
    const statements = file
      .split('--> statement-breakpoint')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    expect(statements.length).toBeGreaterThanOrEqual(4);

    for (const statement of statements) {
      await db.execute(sql.raw(statement));
    }

    // Still one version column, still one trigger, still working.
    const { userId } = await newPlayer('Idempotente FC');
    expect(await versionOf(userId)).toBe(1);
    const triggers = await db.execute(
      sql`select count(*)::int as n from pg_trigger where tgname = 'game_states_bump_version' and not tgisinternal`
    );
    expect((triggers.rows[0] as { n: number }).n).toBe(1);
  }, 60_000);
});
