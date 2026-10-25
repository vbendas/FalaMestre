// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DEFAULT_MAX_BODY_BYTES } from '@/lib/request-body';

// Auth is checked before the body is read on most routes; stub it so these
// tests exercise the body-size path rather than the 401 branch. Routes that
// also insist on a signed-in user before the body (investment-claim,
// predictions-settle, tournaments-tickets) set `session` below, which the
// test applies to getAuthenticatedUser before calling the handler.
vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(async () => null),
  getAuthenticatedUser: vi.fn(async () => null),
  getRequestUserId: vi.fn(async () => null),
}));

// The logger-only handlers (GET and cron) write nothing on a successful run,
// so make every query fail: the one line they then write is the one whose
// request ID we check. The body-reading tests never reach the database.
vi.mock('@/db', () => {
  const reject = async () => {
    throw new Error('db unavailable in tests');
  };
  const table = { findFirst: reject, findMany: reject };
  return {
    db: {
      query: new Proxy({}, { get: () => table }),
      insert: () => ({ values: reject }),
      update: () => ({ set: () => ({ where: reject }) }),
    },
  };
});

// match-stream allows 10 requests a minute per client and the hand-wired
// routes 30 to 60; this file sends each route more than that, so the limiter
// is stubbed open. The body checks run after the rate limit on those routes
// and are unaffected by it.
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ ok: true })),
}));

import { getAuthenticatedUser } from '@/lib/auth-helpers';

import { POST as conversationPOST } from '../conversation/route';
import { POST as matchPOST } from '../match/route';
import { POST as matchDecidePOST } from '../match/decide/route';
import { POST as matchStreamPOST } from '../match/stream/route';
import { POST as dailyRewardPOST } from '../daily-reward/route';
import { POST as facilitiesUpgradePOST } from '../facilities/upgrade/route';
import { POST as insightsPOST } from '../insights/route';
import { GET as investmentGET, POST as investmentPOST } from '../investment/route';
import { POST as investmentClaimPOST } from '../investment/claim/route';
import { POST as createTeamPOST } from '../onboarding/create-team/route';
import { GET as predictionsGET, POST as predictionsPOST } from '../predictions/route';
import { POST as predictionsBetPOST } from '../predictions/bet/route';
import { POST as predictionsSettlePOST } from '../predictions/settle/route';
import { POST as squadFormationPOST } from '../squad/formation/route';
import { GET as squadMigrateGET, POST as squadMigratePOST } from '../squad/migrate/route';
import { POST as squadTrainPOST } from '../squad/train/route';
import { POST as stadiumUpgradePOST } from '../stadium/upgrade/route';
import { POST as staffPOST } from '../staff/route';
import { GET as ticketsGET, POST as ticketsPOST } from '../tournaments/tickets/route';
import { POST as transferBuyPOST } from '../transfer/buy/route';
import { POST as transferSellPOST } from '../transfer/sell/route';
import { GET as youthGET, POST as youthPOST } from '../youth/route';
import { GET as cronDailyYieldGET } from '../cron/daily-yield/route';
import { GET as cronExpireYieldsGET } from '../cron/expire-yields/route';

const CRON_SECRET = 'cron-secret-for-tests';
const SESSION_USER = 'user_abc123def';

/** A syntactically valid JSON body larger than the default limit. */
function oversizedBody(): string {
  const padding = 'x'.repeat(DEFAULT_MAX_BODY_BYTES);
  return JSON.stringify({ userId: SESSION_USER, message: padding, padding });
}

type Handler = (request: NextRequest) => Promise<Response>;

type BodyRoute = {
  name: string;
  url: string;
  handler: Handler;
  /** User getAuthenticatedUser reports; null signs nobody in. */
  session?: string;
  /** Extra headers the route needs to get past its own checks. */
  headers?: Record<string, string>;
  /** The route's reply to a malformed body, where it differs from the default. */
  malformedReply?: { error: string };
};

function request(method: string, url: string, body?: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, {
    method,
    body,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function postRequest(route: Pick<BodyRoute, 'url' | 'headers'>, body: string, extra: Record<string, string> = {}) {
  return request('POST', route.url, body, { ...route.headers, ...extra });
}

function signIn(session: string | null) {
  vi.mocked(getAuthenticatedUser).mockResolvedValue(session);
}

/** The four routes wired by hand before the wrapper existed. */
const HAND_WIRED_ROUTES: BodyRoute[] = [
  { name: 'conversation', url: 'http://localhost/api/conversation', handler: conversationPOST },
  { name: 'match', url: 'http://localhost/api/match', handler: matchPOST },
  { name: 'match-decide', url: 'http://localhost/api/match/decide', handler: matchDecidePOST },
  { name: 'match-stream', url: 'http://localhost/api/match/stream', handler: matchStreamPOST },
];

/** Every route whose body now comes through withApiRoute's readJson. */
const WRAPPED_ROUTES: BodyRoute[] = [
  { name: 'daily-reward', url: 'http://localhost/api/daily-reward', handler: dailyRewardPOST },
  { name: 'facilities-upgrade', url: 'http://localhost/api/facilities/upgrade', handler: facilitiesUpgradePOST },
  {
    name: 'insights',
    url: 'http://localhost/api/insights',
    handler: insightsPOST,
    malformedReply: { error: 'Invalid JSON' },
  },
  { name: 'investment', url: 'http://localhost/api/investment', handler: investmentPOST },
  {
    name: 'investment-claim',
    url: 'http://localhost/api/investment/claim',
    handler: investmentClaimPOST,
    session: SESSION_USER,
  },
  { name: 'onboarding-create-team', url: 'http://localhost/api/onboarding/create-team', handler: createTeamPOST },
  { name: 'predictions-bet', url: 'http://localhost/api/predictions/bet', handler: predictionsBetPOST },
  {
    name: 'predictions-settle',
    url: 'http://localhost/api/predictions/settle',
    handler: predictionsSettlePOST,
    session: SESSION_USER,
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  },
  { name: 'squad-formation', url: 'http://localhost/api/squad/formation', handler: squadFormationPOST },
  { name: 'squad-migrate', url: 'http://localhost/api/squad/migrate', handler: squadMigratePOST },
  { name: 'squad-train', url: 'http://localhost/api/squad/train', handler: squadTrainPOST },
  { name: 'stadium-upgrade', url: 'http://localhost/api/stadium/upgrade', handler: stadiumUpgradePOST },
  { name: 'staff', url: 'http://localhost/api/staff', handler: staffPOST },
  {
    name: 'tournaments-tickets',
    url: 'http://localhost/api/tournaments/tickets',
    handler: ticketsPOST,
    session: SESSION_USER,
  },
  { name: 'transfer-buy', url: 'http://localhost/api/transfer/buy', handler: transferBuyPOST },
  { name: 'transfer-sell', url: 'http://localhost/api/transfer/sell', handler: transferSellPOST },
  { name: 'youth', url: `http://localhost/api/youth?userId=${SESSION_USER}`, handler: youthPOST },
];

const ALL_BODY_ROUTES = [...HAND_WIRED_ROUTES, ...WRAPPED_ROUTES];

/** Handlers that never read a body and only pick up the request logger. */
const LOGGER_ONLY_ROUTES: Array<{ name: string; method: string; url: string; handler: Handler; headers?: Record<string, string> }> = [
  { name: 'cron-daily-yield', method: 'GET', url: 'http://localhost/api/cron/daily-yield', handler: cronDailyYieldGET, headers: { authorization: `Bearer ${CRON_SECRET}` } },
  { name: 'cron-expire-yields', method: 'GET', url: 'http://localhost/api/cron/expire-yields', handler: cronExpireYieldsGET, headers: { authorization: `Bearer ${CRON_SECRET}` } },
  { name: 'investment', method: 'GET', url: `http://localhost/api/investment?userId=${SESSION_USER}`, handler: investmentGET },
  { name: 'predictions', method: 'GET', url: 'http://localhost/api/predictions', handler: predictionsGET },
  { name: 'squad-migrate', method: 'GET', url: 'http://localhost/api/squad/migrate', handler: squadMigrateGET },
  { name: 'tournaments-tickets', method: 'GET', url: `http://localhost/api/tournaments/tickets?userId=${SESSION_USER}`, handler: ticketsGET },
  { name: 'youth', method: 'GET', url: `http://localhost/api/youth?userId=${SESSION_USER}`, handler: youthGET },
];

describe('request bodies on API routes', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let previousCronSecret: string | undefined;

  beforeEach(() => {
    // The routes log a warn line for a rejected body; capture it and keep
    // test output clean.
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    previousCronSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = CRON_SECRET;
    signIn(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (previousCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previousCronSecret;
    }
  });

  it('covers every route that reads a body through the wrapper', () => {
    // 17 route files call readJson; the two cron routes and the plain
    // predictions route only take the logger. Keep this list honest.
    expect(WRAPPED_ROUTES).toHaveLength(17);
    expect(new Set(WRAPPED_ROUTES.map((r) => r.name)).size).toBe(17);
  });

  describe('oversized bodies', () => {
    it.each(ALL_BODY_ROUTES)('$name answers an oversized body with 413', async (route) => {
      signIn(route.session ?? null);
      const body = oversizedBody();
      expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(DEFAULT_MAX_BODY_BYTES);

      const response = await route.handler(postRequest(route, body));

      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toEqual({
        error: 'Request body too large',
        maxBytes: DEFAULT_MAX_BODY_BYTES,
      });
    });

    it.each(ALL_BODY_ROUTES)(
      '$name rejects an oversized body declared only via Content-Length',
      async (route) => {
        signIn(route.session ?? null);
        // A body that fits, but with a header claiming it is far larger: the
        // declared-length check short-circuits before any bytes are read.
        const req = postRequest(route, JSON.stringify({ userId: SESSION_USER }), {
          'content-length': String(DEFAULT_MAX_BODY_BYTES + 1),
        });

        const response = await route.handler(req);

        expect(response.status).toBe(413);
      }
    );

    it.each(ALL_BODY_ROUTES)(
      '$name logs the rejection as one JSON line naming the route',
      async (route) => {
        signIn(route.session ?? null);

        await route.handler(postRequest(route, oversizedBody()));

        expect(warnSpy).toHaveBeenCalledTimes(1);
        const line = warnSpy.mock.calls[0][0] as string;
        expect(line).not.toContain('\n');
        const parsed = JSON.parse(line);
        expect(parsed).toMatchObject({
          level: 'warn',
          route: route.name,
          message: 'Request body rejected: too large',
        });
        expect(typeof parsed.requestId).toBe('string');
        expect(parsed.requestId.length).toBeGreaterThan(0);
      }
    );

    it.each(ALL_BODY_ROUTES)('$name stamps a supplied x-request-id on the rejection line', async (route) => {
      signIn(route.session ?? null);

      await route.handler(postRequest(route, oversizedBody(), { 'x-request-id': 'trace-123' }));

      expect(JSON.parse(warnSpy.mock.calls[0][0] as string).requestId).toBe('trace-123');
    });
  });

  describe('malformed bodies', () => {
    // The hand-wired conversation, match and match-decide routes wrap body
    // parsing in a timeout and reply 'Invalid JSON body or timeout' without
    // logging; they are covered by their own tests. match-stream and every
    // wrapped route answer with the plain reply they had before.
    const MALFORMED_ROUTES = [HAND_WIRED_ROUTES[3], ...WRAPPED_ROUTES.filter((r) => !r.malformedReply)];

    it.each(MALFORMED_ROUTES)('$name still answers a malformed body with its 400 reply', async (route) => {
      signIn(route.session ?? null);

      const response = await route.handler(postRequest(route, '{"userId": '));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' });
    });

    // conversation, match and match-decide wrap body parsing in a timeout and
    // cannot tell a malformed body from a slow one, so they keep their own
    // 'or timeout' reply; the log line is what names the cause.
    const TIMEOUT_WRAPPED = HAND_WIRED_ROUTES.slice(0, 3);

    it.each(TIMEOUT_WRAPPED)('$name answers a malformed body with its own 400 reply', async (route) => {
      signIn(route.session ?? null);

      const response = await route.handler(postRequest(route, '{"userId": '));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body or timeout' });
    });

    it.each(TIMEOUT_WRAPPED)('$name logs the malformed body rather than dropping it', async (route) => {
      signIn(route.session ?? null);

      await route.handler(postRequest(route, 'not json', { 'x-request-id': 'trace-malformed' }));

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(JSON.parse(warnSpy.mock.calls[0][0] as string)).toMatchObject({
        level: 'warn',
        route: route.name,
        requestId: 'trace-malformed',
        message: 'Request body rejected: invalid JSON or timeout',
      });
    });

    it('insights keeps its own wording for a malformed body', async () => {
      const response = await insightsPOST(request('POST', 'http://localhost/api/insights', 'not json'));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON' });
    });

    it.each([...MALFORMED_ROUTES, WRAPPED_ROUTES.find((r) => r.name === 'insights')!])(
      '$name logs a malformed body at warn with the route name and a request ID',
      async (route) => {
        signIn(route.session ?? null);

        await route.handler(postRequest(route, 'not json'));

        expect(warnSpy).toHaveBeenCalledTimes(1);
        const parsed = JSON.parse(warnSpy.mock.calls[0][0] as string);
        expect(parsed).toMatchObject({
          level: 'warn',
          route: route.name,
          message: 'Request body rejected: invalid JSON',
        });
        expect(typeof parsed.requestId).toBe('string');
        expect(parsed.requestId.length).toBeGreaterThan(0);
      }
    );
  });

  describe('bodies that are valid JSON but not an object', () => {
    // These parse fine and fit the cap, so only the shape check stands
    // between them and a route pulling fields off `null` or a number.
    const NON_OBJECT_BODIES = [
      { label: 'null', body: 'null' },
      { label: 'an array', body: '[{"userId":"user_abc123def"}]' },
      { label: 'a number', body: '42' },
    ];
    const CASES = ALL_BODY_ROUTES.flatMap((route) =>
      NON_OBJECT_BODIES.map((payload) => ({ ...payload, route, name: route.name }))
    );

    it.each(CASES)('$name answers $label with 400, not 500', async ({ route, body }) => {
      signIn(route.session ?? null);

      const response = await route.handler(postRequest(route, body));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'Request body must be a JSON object' });
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it.each(CASES)('$name logs $label at warn with the route name and a request ID', async ({ route, body }) => {
      signIn(route.session ?? null);

      await route.handler(postRequest(route, body));

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(warnSpy.mock.calls[0][0] as string);
      expect(parsed).toMatchObject({
        level: 'warn',
        route: route.name,
        message: 'Request body rejected: not a JSON object',
      });
      expect(typeof parsed.requestId).toBe('string');
      expect(parsed.requestId.length).toBeGreaterThan(0);
    });
  });

  describe('routes that reach the body only after their own checks', () => {
    it('investment-claim stops at 401 with nobody signed in, so the body test signs a user in', async () => {
      signIn(null);
      const response = await investmentClaimPOST(postRequest(WRAPPED_ROUTES[4], oversizedBody()));
      expect(response.status).toBe(401);
    });

    it('predictions-settle stops at 403 without the cron or admin secret', async () => {
      signIn(SESSION_USER);
      const response = await predictionsSettlePOST(
        request('POST', 'http://localhost/api/predictions/settle', oversizedBody())
      );
      expect(response.status).toBe(403);
    });

    it('predictions POST never reads a body, so an oversized one is not rejected', async () => {
      signIn(SESSION_USER);
      const response = await predictionsPOST(request('POST', 'http://localhost/api/predictions', oversizedBody()));
      expect(response.status).toBe(200);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('logger-only handlers', () => {
    it.each(LOGGER_ONLY_ROUTES)('$name $method writes JSON lines carrying the route name and a request ID', async (route) => {
      const response = await route.handler(request(route.method, route.url, undefined, route.headers));

      // With the database failing, each of these handlers reports the error
      // and answers 500; that line is the one we inspect.
      expect(response.status).toBe(500);
      const lines = [...errorSpy.mock.calls, ...warnSpy.mock.calls, ...logSpy.mock.calls].map((c) => c[0] as string);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line).not.toContain('\n');
        const parsed = JSON.parse(line);
        expect(parsed.route).toBe(route.name);
        expect(typeof parsed.requestId).toBe('string');
        expect(parsed.requestId.length).toBeGreaterThan(0);
      }
    });

    it.each(LOGGER_ONLY_ROUTES)('$name $method reuses a supplied x-request-id', async (route) => {
      await route.handler(request(route.method, route.url, undefined, { ...route.headers, 'x-request-id': 'trace-get-1' }));

      const line = JSON.parse(errorSpy.mock.calls[0][0] as string);
      expect(line.requestId).toBe('trace-get-1');
    });
  });
});
