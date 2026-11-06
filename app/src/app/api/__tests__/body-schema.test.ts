// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';

/**
 * Every route that takes a body, checked against its schema, held to one
 * contract between all of them.
 *
 * Two things are being pinned down. The first is that they agree: the same
 * malformed request gets the same status and the same reply shape whichever
 * route it reaches, which it did not before — a few answered in Zod's
 * wording, /api/match/decide in seventy lines of its own, /api/insights with
 * a flat 'Invalid request' that threw away which field was wrong, and most
 * answered nothing at all because they never looked. The second is that a
 * body problem is reported as a body problem. A request with no `userId`
 * used to be read as `undefined` and carried past the ownership check into
 * the save lookup, where it came back `Forbidden` or `User not found`: both
 * wrong, and neither any help to whoever sent it.
 *
 * The database is mocked to fail loudly rather than return a save. Nothing
 * here should reach it: every call in this file is refused at the body.
 */

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(async () => null),
  getAuthenticatedUser: vi.fn(async () => null),
  getRequestUserId: vi.fn(async () => null),
}));

vi.mock('@/db', () => {
  const reach = async () => {
    throw new Error('a body-schema test reached the database');
  };
  return {
    db: {
      query: new Proxy({}, { get: () => ({ findFirst: reach, findMany: reach }) }),
      insert: () => ({ values: reach }),
      update: () => ({ set: () => ({ where: reach }) }),
    },
  };
});

import { POST as conversationPOST } from '../conversation/route';
import { POST as dailyRewardPOST } from '../daily-reward/route';
import { POST as facilitiesUpgradePOST } from '../facilities/upgrade/route';
import { POST as insightsPOST } from '../insights/route';
import { POST as investmentPOST } from '../investment/route';
import { POST as investmentClaimPOST } from '../investment/claim/route';
import { POST as matchPOST } from '../match/route';
import { POST as matchDecidePOST } from '../match/decide/route';
import { POST as matchFinalizePOST } from '../match/finalize/route';
import { POST as matchStreamPOST } from '../match/stream/route';
import { POST as createTeamPOST } from '../onboarding/create-team/route';
import { POST as predictionsBetPOST } from '../predictions/bet/route';
import { POST as predictionsSettlePOST } from '../predictions/settle/route';
import { POST as squadFormationPOST } from '../squad/formation/route';
import { POST as squadMigratePOST } from '../squad/migrate/route';
import { POST as squadTrainPOST } from '../squad/train/route';
import { POST as stadiumUpgradePOST } from '../stadium/upgrade/route';
import { POST as staffPOST } from '../staff/route';
import { POST as ticketsPOST } from '../tournaments/tickets/route';
import { POST as transferBuyPOST } from '../transfer/buy/route';
import { POST as transferSellPOST } from '../transfer/sell/route';
import { POST as youthPOST } from '../youth/route';

const USER = 'user_abc123def';
const CRON_SECRET = 'cron-secret-for-body-schema-tests';

type Handler = (request: NextRequest) => Promise<Response>;

function post(url: string, body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  });
}

async function send(handler: Handler, url: string, body: unknown, headers?: Record<string, string>) {
  const response = await handler(post(url, body, headers));
  const payload = (await response.json()) as { error?: string; message?: string; field?: string };
  return { status: response.status, ...payload };
}

/** A whole squad member, which is what playing a turn takes. */
function turnPlayer(id = 'squad-1') {
  return {
    id,
    name: 'Jogador',
    position: 'MID',
    pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70,
    potential: 75,
    consistency: 70,
    bigMatchPlayer: 60,
    leadership: 50,
    injuryProneness: 30,
    fatigue: 90,
    currentForm: 'average',
    weeklyTrainingCount: 0,
    isInjured: false,
    injuryWeeksRemaining: 0,
    injuryType: null,
  };
}

/** A whole player, which is what signing one takes. */
function signing(id = 'market-1') {
  return {
    id,
    name: 'Reforço',
    position: 'MID',
    pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70,
    potential: 75,
    consistency: 70,
    bigMatchPlayer: 60,
    leadership: 50,
    injuryProneness: 30,
  };
}

type BadBodyCase = {
  name: string;
  handler: Handler;
  url: string;
  /** A body this route's schema refuses, and the field it should name. */
  body: unknown;
  field: string;
  /** Signed-in user, for routes that insist on one before reading the body. */
  session?: string;
  headers?: Record<string, string>;
};

/**
 * Every route that takes a body, each with one body its schema turns away.
 *
 * The bodies differ because the schemas do — there is no single payload that
 * is wrong for all of them — but the *answer* must not differ, and that is
 * what the sweep below checks. Routes whose every field is optional
 * (investment/claim, squad/migrate, insights) are given a field of the wrong
 * type rather than a missing one, since there is nothing they require.
 */
const BAD_BODIES: BadBodyCase[] = [
  { name: 'conversation', handler: conversationPOST, url: '/api/conversation', body: { message: 'olá' }, field: 'userId' },
  { name: 'daily-reward', handler: dailyRewardPOST, url: '/api/daily-reward', body: {}, field: 'userId' },
  {
    name: 'facilities-upgrade',
    handler: facilitiesUpgradePOST,
    url: '/api/facilities/upgrade',
    body: { userId: USER, facilityType: 'training' },
    field: 'facilityType',
  },
  { name: 'insights', handler: insightsPOST, url: '/api/insights', body: { userId: 42 }, field: 'userId' },
  {
    name: 'investment',
    handler: investmentPOST,
    url: '/api/investment',
    body: { userId: USER, option: 'Z' },
    field: 'option',
  },
  {
    name: 'investment-claim',
    handler: investmentClaimPOST,
    url: '/api/investment/claim',
    body: { claimAll: 'yes please' },
    field: 'claimAll',
    session: USER,
  },
  { name: 'match', handler: matchPOST, url: '/api/match', body: { userId: USER, seed: 1.5 }, field: 'seed' },
  {
    name: 'match-decide',
    handler: matchDecidePOST,
    url: '/api/match/decide',
    body: {
      userId: USER,
      turnNumber: 99,
      decision: null,
      priorState: {
        homeScore: 0, awayScore: 0, formation: '4-3-3', mentality: 'balanced', squad: [turnPlayer()],
      },
    },
    field: 'turnNumber',
  },
  {
    name: 'match-finalize',
    handler: matchFinalizePOST,
    url: '/api/match/finalize',
    body: { userId: USER, week: 1, opponent: 'Rival', isHome: true, decisions: [{ turnNumber: 0, decisionId: null }] },
    field: 'seed',
  },
  {
    name: 'match-stream',
    handler: matchStreamPOST,
    url: '/api/match/stream',
    body: { userId: USER, seed: { nested: true } },
    field: 'seed',
  },
  {
    name: 'onboarding-create-team',
    handler: createTeamPOST,
    url: '/api/onboarding/create-team',
    body: { teamName: 'OK', primaryColor: '#112233', secondaryColor: '#445566', badgeStyle: 'shield' },
    field: 'teamName',
  },
  {
    name: 'predictions-bet',
    handler: predictionsBetPOST,
    url: '/api/predictions/bet',
    body: { userId: USER, predictionId: 'not-a-uuid', optionId: 'home', amount: 10 },
    field: 'predictionId',
  },
  {
    name: 'predictions-settle',
    handler: predictionsSettlePOST,
    url: '/api/predictions/settle',
    body: { predictionId: '11111111-1111-4111-8111-111111111111', homeScore: 1 },
    field: 'awayScore',
    session: USER,
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  },
  {
    name: 'squad-formation',
    handler: squadFormationPOST,
    url: '/api/squad/formation',
    body: { userId: USER, formation: '9-0-1' },
    field: 'formation',
  },
  {
    name: 'squad-migrate',
    handler: squadMigratePOST,
    url: '/api/squad/migrate',
    body: { userId: 42 },
    field: 'userId',
  },
  {
    name: 'squad-train',
    handler: squadTrainPOST,
    url: '/api/squad/train',
    body: { userId: USER, playerId: 'p1', focus: 'juggling' },
    field: 'focus',
  },
  { name: 'stadium-upgrade', handler: stadiumUpgradePOST, url: '/api/stadium/upgrade', body: {}, field: 'userId' },
  {
    name: 'staff',
    handler: staffPOST,
    url: '/api/staff',
    body: { userId: USER, action: 'hire', role: 'wizard', tier: 'rookie' },
    field: 'role',
  },
  {
    name: 'tournaments-tickets',
    handler: ticketsPOST,
    url: '/api/tournaments/tickets',
    body: { method: 'found_in_the_street' },
    field: 'method',
    session: USER,
  },
  {
    name: 'transfer-buy',
    handler: transferBuyPOST,
    url: '/api/transfer/buy',
    body: { userId: USER, player: { id: 'ghost', name: 'Sem Atributos', position: 'MID' } },
    field: 'player.pac',
  },
  {
    name: 'transfer-sell',
    handler: transferSellPOST,
    url: '/api/transfer/sell',
    body: { userId: USER, playerId: '' },
    field: 'playerId',
  },
  {
    name: 'youth',
    handler: youthPOST,
    url: `/api/youth?userId=${USER}`,
    body: { action: 'sign' },
    field: 'playerId',
  },
];

describe('every route that takes a body', () => {
  let previousAuthDisabled: string | undefined;
  let previousCronSecret: string | undefined;

  beforeEach(() => {
    previousAuthDisabled = process.env.AUTH_DISABLED;
    previousCronSecret = process.env.CRON_SECRET;
    process.env.AUTH_DISABLED = 'true';
    process.env.CRON_SECRET = CRON_SECRET;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    if (previousAuthDisabled === undefined) delete process.env.AUTH_DISABLED;
    else process.env.AUTH_DISABLED = previousAuthDisabled;
    if (previousCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousCronSecret;
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    vi.restoreAllMocks();
  });

  it('covers every route in the app that reads a body', () => {
    // The same count body-limit.test.ts holds itself to. A new route that
    // takes a body and is not listed here fails this.
    expect(BAD_BODIES).toHaveLength(22);
    expect(new Set(BAD_BODIES.map((c) => c.name)).size).toBe(22);
  });

  it.each(BAD_BODIES)('$name refuses a bad body with 400 naming $field', async (route) => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(route.session ?? null);

    const result = await send(route.handler, route.url, route.body, route.headers);

    expect(result.status).toBe(400);
    expect(result.error).toBe('Validation failed');
    expect(result.field).toBe(route.field);
  });

  it('is the only way a route reads a body', async () => {
    // The point of the exercise, enforced on the source rather than on
    // behaviour: a route that goes back to casting a body would pass every
    // test above by simply never refusing anything, and this is what
    // notices. `readJson` still exists — `readBody` is built on it and its
    // own tests use it — but a route must take a schema.
    //
    // The check itself lives in scripts/check-route-bodies.mjs, which CI
    // also runs as its own step so the failure arrives with the fix spelled
    // out rather than as one red assertion in eleven hundred. Imported
    // rather than reimplemented so the two cannot drift.
    const { routesReadingBodyAnotherWay } = await import('../../../../scripts/check-route-bodies.mjs');

    expect(routesReadingBodyAnotherWay()).toEqual([]);
  });

  it('answers in the same three keys whichever route it was', async () => {
    const shapes = new Set<string>();

    for (const route of BAD_BODIES) {
      vi.mocked(getAuthenticatedUser).mockResolvedValue(route.session ?? null);
      const response = await route.handler(post(route.url, route.body, route.headers));
      const payload = (await response.json()) as Record<string, unknown>;
      shapes.add(`${response.status} ${Object.keys(payload).sort().join(',')}`);
    }

    expect(shapes).toEqual(new Set(['400 error,field,message']));
  });

  it('always says something, and always names the field in it', async () => {
    const silent: string[] = [];

    for (const route of BAD_BODIES) {
      vi.mocked(getAuthenticatedUser).mockResolvedValue(route.session ?? null);
      const result = await send(route.handler, route.url, route.body, route.headers);
      // The leaf of the path, so `player.pac` is satisfied by a message
      // about `pac`.
      const leaf = route.field.slice(route.field.lastIndexOf('.') + 1);
      if (!result.message || !result.message.includes(leaf)) {
        silent.push(`${route.name}: ${JSON.stringify(result.message)} does not mention ${leaf}`);
      }
    }

    expect(silent).toEqual([]);
  });
});

/** Each route, with a body that is complete apart from the missing userId. */
const ROUTES: Array<{ name: string; handler: Handler; url: string; bodyWithoutUserId: object }> = [
  {
    name: 'transfer-buy',
    handler: transferBuyPOST,
    url: '/api/transfer/buy',
    bodyWithoutUserId: { player: signing() },
  },
  {
    name: 'transfer-sell',
    handler: transferSellPOST,
    url: '/api/transfer/sell',
    bodyWithoutUserId: { playerId: 'p1' },
  },
  {
    name: 'facilities-upgrade',
    handler: facilitiesUpgradePOST,
    url: '/api/facilities/upgrade',
    bodyWithoutUserId: { facilityType: 'trainingCenter' },
  },
  {
    name: 'stadium-upgrade',
    handler: stadiumUpgradePOST,
    url: '/api/stadium/upgrade',
    bodyWithoutUserId: {},
  },
];

describe('the routes that check their body against a schema', () => {
  let previousAuthDisabled: string | undefined;

  beforeEach(() => {
    previousAuthDisabled = process.env.AUTH_DISABLED;
    process.env.AUTH_DISABLED = 'true';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    if (previousAuthDisabled === undefined) delete process.env.AUTH_DISABLED;
    else process.env.AUTH_DISABLED = previousAuthDisabled;
    vi.restoreAllMocks();
  });

  it.each(ROUTES)(
    '$name answers a missing userId by saying so, not Forbidden or User not found',
    async ({ handler, url, bodyWithoutUserId }) => {
      const result = await send(handler, url, bodyWithoutUserId);

      expect(result.status).toBe(400);
      expect(result.error).toBe('Validation failed');
      expect(result.field).toBe('userId');
      expect(result.message).toContain('userId');
    }
  );

  it.each(ROUTES)('$name refuses a userId of the wrong type the same way', async ({ handler, url, bodyWithoutUserId }) => {
    const result = await send(handler, url, { ...bodyWithoutUserId, userId: 12345 });

    expect(result.status).toBe(400);
    expect(result.error).toBe('Validation failed');
    expect(result.field).toBe('userId');
  });

  it.each(ROUTES)('$name refuses a userId that is not in the id format', async ({ handler, url, bodyWithoutUserId }) => {
    const result = await send(handler, url, { ...bodyWithoutUserId, userId: 'has spaces and /slashes' });

    expect(result.status).toBe(400);
    expect(result.field).toBe('userId');
    expect(result.message).toContain('Invalid user ID format');
  });

  it('every route answers a bad body in the same three keys', async () => {
    const shapes = await Promise.all(
      ROUTES.map(async ({ handler, url, bodyWithoutUserId }) => {
        const response = await handler(post(url, bodyWithoutUserId));
        const payload = (await response.json()) as Record<string, unknown>;
        return `${response.status} ${Object.keys(payload).sort().join(',')}`;
      })
    );

    expect(new Set(shapes)).toEqual(new Set(['400 error,field,message']));
  });
});

describe('transfer-buy', () => {
  beforeEach(() => {
    process.env.AUTH_DISABLED = 'true';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('refuses a signing with no ratings instead of pricing it at NaN', async () => {
    // The fee is the average of the six ratings. Without them it was NaN,
    // `money < NaN` was false so the budget check passed, and the save was
    // written with a NaN balance.
    const result = await send(transferBuyPOST, '/api/transfer/buy', {
      userId: USER,
      player: { id: 'ghost', name: 'Sem Atributos', position: 'MID' },
    });

    expect(result.status).toBe(400);
    expect(result.field).toBe('player.pac');
  });

  it('names the exact rating that is wrong', async () => {
    const result = await send(transferBuyPOST, '/api/transfer/buy', {
      userId: USER,
      player: { ...signing(), sho: 'brilliant' },
    });

    expect(result.field).toBe('player.sho');
    expect(result.message).toContain('player.sho');
  });

  it('refuses a position the game does not have', async () => {
    const result = await send(transferBuyPOST, '/api/transfer/buy', {
      userId: USER,
      player: { ...signing(), position: 'ST' },
    });

    expect(result.field).toBe('player.position');
    expect(result.message).toContain('GK, DEF, MID, FWD');
  });

  it('refuses a sellValue that is not a finite number', async () => {
    for (const sellValue of ['1000', null, Number.NaN]) {
      const result = await send(transferBuyPOST, '/api/transfer/buy', {
        userId: USER,
        player: signing(),
        sellValue,
      });

      expect(result.status).toBe(400);
      expect(result.field).toBe('sellValue');
    }
  });

  it('refuses a negative sellValue, which would have paid the club to sign', async () => {
    const result = await send(transferBuyPOST, '/api/transfer/buy', {
      userId: USER,
      player: signing(),
      sellValue: -5_000_000,
    });

    expect(result.status).toBe(400);
    expect(result.field).toBe('sellValue');
  });
});

describe('facilities-upgrade', () => {
  beforeEach(() => {
    process.env.AUTH_DISABLED = 'true';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('lists the facilities that exist when asked for one that does not', async () => {
    const result = await send(facilitiesUpgradePOST, '/api/facilities/upgrade', {
      userId: USER,
      facilityType: 'training',
    });

    expect(result.status).toBe(400);
    expect(result.field).toBe('facilityType');
    expect(result.message).toContain('trainingCenter');
    expect(result.message).toContain('scoutOffice');
  });

  it('refuses a missing facilityType before it reaches the save', async () => {
    const result = await send(facilitiesUpgradePOST, '/api/facilities/upgrade', { userId: USER });

    expect(result.status).toBe(400);
    expect(result.field).toBe('facilityType');
  });
});

describe('transfer-sell', () => {
  beforeEach(() => {
    process.env.AUTH_DISABLED = 'true';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('refuses an empty playerId rather than looking for a player with no id', async () => {
    const result = await send(transferSellPOST, '/api/transfer/sell', { userId: USER, playerId: '' });

    expect(result.status).toBe(400);
    expect(result.field).toBe('playerId');
  });
});
