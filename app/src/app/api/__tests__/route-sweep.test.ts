// @vitest-environment node
/// <reference types="vite/client" />
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

/**
 * Every API route, called once normally and once refused, with the logging
 * contract checked on each call.
 *
 * The chat and match routes have close tests of their own; nothing else
 * walked every route, so a new route or a changed one could stop leaving a
 * summary line and nobody would notice. This sweep discovers the route files
 * itself (a route without an entry in SPECS fails the suite) and, for every
 * call, requires that everything written to the console is one JSON line,
 * that every line carries that call's request ID, and that exactly one of
 * them is the request's summary.
 *
 * It runs with the API key, the auth secrets and the database URL set to
 * recognisable fakes, with every outbound fetch answered by an upstream that
 * reflects our request back — headers included — and with a sentinel as the
 * player's message. None of those may appear anywhere in the output.
 *
 * Real embedded store, real auth helpers, real rate limiter. Only
 * next-auth's session lookup is replaced, so the sweep can sign the player
 * in and out per call.
 */

// ---------------------------------------------------------------------------
// Values that must never reach a log line.

const SECRETS = {
  OPENROUTER_API_KEY: 'sk-or-SWEEP-FAKE-OPENROUTER-KEY-0001',
  NEXTAUTH_SECRET: 'SWEEP-FAKE-NEXTAUTH-SECRET-0002',
  GOOGLE_CLIENT_ID: 'SWEEP-FAKE-GOOGLE-CLIENT-ID-0003',
  GOOGLE_CLIENT_SECRET: 'SWEEP-FAKE-GOOGLE-CLIENT-SECRET-0004',
  CRON_SECRET: 'SWEEP-FAKE-CRON-SECRET-0005',
  ADMIN_SECRET: 'SWEEP-FAKE-ADMIN-SECRET-0006',
  DATABASE_URL: 'postgres://sweep_user:SWEEP-FAKE-DB-PASSWORD-0007@db.invalid:5432/sweep',
} as const;

/** The password on its own, so a line quoting only part of the URL still fails. */
const DATABASE_PASSWORD = 'SWEEP-FAKE-DB-PASSWORD-0007';

/** What the player typed. The one piece of body content a route handles as prose. */
const PLAYER_MESSAGE = 'SWEEP-PLAYER-MESSAGE-quero-vender-o-neymar-7731';

const FORBIDDEN = [...Object.values(SECRETS), DATABASE_PASSWORD, PLAYER_MESSAGE];

const SESSION_USER = 'sweep-player-0001';

// ---------------------------------------------------------------------------
// Session control: the only thing mocked.

let session: { user: { id: string; email: string; name: string } } | null = null;

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => session),
}));

function signIn(userId: string | null): void {
  session = userId ? { user: { id: userId, email: 'sweep@example.test', name: 'Sweep' } } : null;
}

// ---------------------------------------------------------------------------
// Route discovery and the per-route call specs.

type Handler = (request: NextRequest) => Promise<Response>;
type RouteModule = Record<string, unknown>;

/** Every route file under src/app/api, keyed by its path relative to there. */
const ROUTE_FILES = import.meta.glob<RouteModule>('../**/route.ts', { eager: false });

/**
 * Routes the sweep knowingly leaves out, each with the reason. Anything else
 * discovered on disk and missing from SPECS fails the suite.
 */
const EXCLUDED: Record<string, string> = {
  'auth/[...nextauth]/route.ts':
    "NextAuth's own handler, re-exported as-is; it has no seam for the route wrapper.",
};

type Call = {
  method: 'GET' | 'POST';
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Signed-in user for this call. Default SESSION_USER. */
  session?: string | null;
  /**
   * Set on a `normal` call that must come back 2xx, not merely avoid a 500.
   *
   * Two of these fixtures named things the game does not have — a facility
   * called `training` and a ticket method called `daily_login` — so the
   * calls meant to be the happy path were refusals, and the sweep passed
   * them because a 400 is not a 500. Marking the ones that should succeed
   * stops that happening again quietly.
   */
  expectOk?: boolean;
};

/**
 * A bug the sweep found that is written down but not yet fixed.
 *
 * The sweep still runs the call and still checks its logging; what it
 * tolerates is the one wrong outcome named here, and it insists on seeing
 * it. The day the route is fixed, the sweep fails on that call with a
 * message saying to remove the marker — so a fix cannot land silently and
 * the roadmap entry cannot outlive the bug.
 */
type KnownFailure = {
  /** Which wrong outcome is expected: a 5xx on the normal call, or a refused call answered 2xx. */
  kind: 'server_error' | 'did_not_refuse';
  /** Where the bug is written down. */
  roadmap: string;
};

type Spec = {
  /** The route name the wrapper stamps on every line. */
  route: string;
  /** Set only while a known bug makes one of the two calls come out wrong. */
  known?: KnownFailure;
  /** A well-formed call from a signed-in player with a save. */
  normal: Call;
  /**
   * A call the route must refuse, and how. Omitted only where the route has
   * nothing to refuse (auth/mode answers everyone).
   */
  refused?: Call & { expectStatus: readonly number[]; expectReason?: string };
  /**
   * Calls the route refuses on its own checks — a bad formation, an unknown
   * action, not enough money — rather than at the shared gates. The player is
   * signed in and owns a save; the request itself is the problem. Each one is
   * held to the same contract as `refused`: a warn summary carrying a reason.
   */
  domainRefusals?: ReadonlyArray<Call & { expectStatus: readonly number[]; expectReason?: string }>;
};

/** Shared refusal: nobody signed in while auth is enforced. */
const UNAUTHENTICATED = { session: null, expectStatus: [401], expectReason: 'unauthorized' } as const;

/** Shared refusal for the scheduled routes: the wrong bearer. */
const WRONG_CRON_SECRET = {
  headers: { authorization: 'Bearer not-the-secret' },
  expectStatus: [401],
  expectReason: 'cron_secret_invalid',
} as const;

const API = 'http://localhost/api';

/**
 * The reason a body that failed its schema is recorded under.
 *
 * Several of the refusals below used to be the route's own: a hand-written
 * check on an unknown action, an out-of-range stake, a focus the game does
 * not have, each answering in its own words. They are schema refusals now,
 * so they come back under one code with the offending field beside it, and
 * these entries say so rather than pinning seven different sentences.
 */
const SCHEMA_REFUSAL = 'body_failed_schema';

/**
 * A ticket-earning method that exists. The table is keyed by these
 * upper-case names and the route looks methods up by key, so the
 * `daily_login` this fixture used to send was never one of them.
 */
const TICKET_METHOD = 'WIN_5_MATCHES_STREAK';

/**
 * What the sweep's player is given to spend.
 *
 * A new save starts on 100,000, and the cheapest facility upgrade is
 * 300,000 — so even with a real facility named, the upgrade would answer
 * 'Insufficient funds' and the happy path would still not be walked. Well
 * under the 5,000,000,000 fee the transfer/buy refusal below relies on.
 */
const SWEEP_BUDGET = 50_000_000;

/**
 * A whole player, as /api/transfer/buy requires one.
 *
 * The sweep used to send `{ id, name, position, age, overall, value, wage }`
 * here, which has none of the six ratings a fee is calculated from; the route
 * priced it at NaN, let `money < NaN` through as affordable, and banked a
 * save whose balance was NaN — with the sweep seeing a 200 and passing. The
 * schema on the route now refuses that body, and a signing the sweep means to
 * succeed has to be a real one.
 */
function signing(id: string, name: string) {
  return {
    id,
    name,
    position: 'MID',
    pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70,
    potential: 75,
    consistency: 70,
    bigMatchPlayer: 60,
    leadership: 50,
    injuryProneness: 30,
  };
}

/** Built once the player has a save, since several bodies need their squad. */
function specsFor(userId: string, squad: { players: Array<{ id: string }>; formation: string }, predictionId: string): Record<string, Record<string, Spec>> {
  const firstPlayer = squad.players[0]?.id ?? 'p1';
  return {
    'auth/mode/route.ts': {
      GET: {
        route: 'auth-mode',
        normal: { method: 'GET', url: `${API}/auth/mode`, session: null },
      },
    },
    'conversation/route.ts': {
      GET: {
        route: 'conversation',
        normal: { method: 'GET', url: `${API}/conversation?userId=${userId}` },
        refused: { method: 'GET', url: `${API}/conversation?userId=${userId}`, ...UNAUTHENTICATED },
      },
      POST: {
        route: 'conversation',
        // No useMock: with a key set this goes to the (stubbed) live model.
        normal: { method: 'POST', url: `${API}/conversation`, body: { userId, message: PLAYER_MESSAGE } },
        refused: {
          method: 'POST',
          url: `${API}/conversation`,
          body: { userId, message: PLAYER_MESSAGE },
          ...UNAUTHENTICATED,
        },
      },
    },
    'cron/daily-yield/route.ts': {
      GET: {
        route: 'cron-daily-yield',
        normal: {
          method: 'GET',
          url: `${API}/cron/daily-yield`,
          headers: { authorization: `Bearer ${SECRETS.CRON_SECRET}` },
          session: null,
        },
        refused: { method: 'GET', url: `${API}/cron/daily-yield`, session: null, ...WRONG_CRON_SECRET },
      },
    },
    'cron/expire-yields/route.ts': {
      GET: {
        route: 'cron-expire-yields',
        normal: {
          method: 'GET',
          url: `${API}/cron/expire-yields`,
          headers: { authorization: `Bearer ${SECRETS.CRON_SECRET}` },
          session: null,
        },
        refused: { method: 'GET', url: `${API}/cron/expire-yields`, session: null, ...WRONG_CRON_SECRET },
      },
    },
    'daily-reward/route.ts': {
      POST: {
        route: 'daily-reward',
        normal: { method: 'POST', url: `${API}/daily-reward`, body: { userId } },
        refused: { method: 'POST', url: `${API}/daily-reward`, body: { userId }, ...UNAUTHENTICATED },
      },
    },
    'facilities/upgrade/route.ts': {
      POST: {
        route: 'facilities-upgrade',
        normal: { method: 'POST', url: `${API}/facilities/upgrade`, body: { userId, facilityType: 'trainingCenter' }, expectOk: true },
        refused: {
          method: 'POST',
          url: `${API}/facilities/upgrade`,
          body: { userId, facilityType: 'trainingCenter' },
          ...UNAUTHENTICATED,
        },
      },
    },
    'insights/route.ts': {
      POST: {
        route: 'insights',
        normal: { method: 'POST', url: `${API}/insights`, body: { userId } },
        refused: { method: 'POST', url: `${API}/insights`, body: { userId }, ...UNAUTHENTICATED },
      },
    },
    'investment/route.ts': {
      GET: {
        route: 'investment',
        normal: { method: 'GET', url: `${API}/investment?userId=${userId}` },
        refused: { method: 'GET', url: `${API}/investment?userId=${userId}`, ...UNAUTHENTICATED },
      },
      POST: {
        route: 'investment',
        normal: { method: 'POST', url: `${API}/investment`, body: { userId, option: 'clube_torcedores' }, expectOk: true },
        refused: { method: 'POST', url: `${API}/investment`, body: { userId, option: 'clube_torcedores' }, ...UNAUTHENTICATED },
        domainRefusals: [
          {
            method: 'POST',
            url: `${API}/investment`,
            body: { userId, option: 'Z' },
            expectStatus: [400],
            expectReason: SCHEMA_REFUSAL,
          },
        ],
      },
    },
    'investment/claim/route.ts': {
      POST: {
        route: 'investment-claim',
        normal: { method: 'POST', url: `${API}/investment/claim`, body: { claimAll: true } },
        refused: { method: 'POST', url: `${API}/investment/claim`, body: { claimAll: true }, ...UNAUTHENTICATED },
      },
    },
    'match/route.ts': {
      POST: {
        route: 'match',
        normal: { method: 'POST', url: `${API}/match`, body: { userId } },
        refused: { method: 'POST', url: `${API}/match`, body: { userId }, ...UNAUTHENTICATED },
      },
    },
    'match/decide/route.ts': {
      POST: {
        route: 'match-decide',
        normal: {
          method: 'POST',
          url: `${API}/match/decide`,
          body: {
            userId,
            turnNumber: 0,
            decision: null,
            seed: 'sweep-turn-0',
            priorState: {
              homeScore: 0,
              awayScore: 0,
              homeMomentum: 0,
              awayMomentum: 0,
              tension: 30,
              formation: squad.formation || '4-3-3',
              mentality: 'balanced',
              hasRedCard: false,
              squad: squad.players,
            },
          },
        },
        refused: { method: 'POST', url: `${API}/match/decide`, body: { userId }, ...UNAUTHENTICATED },
      },
    },
    'match/finalize/route.ts': {
      POST: {
        route: 'match-finalize',
        // Deliberately incomplete: a finalize with no decisions is refused by
        // validation, which is a legitimate well-formed-but-rejected call. The
        // full happy path is the journey tests' job.
        normal: { method: 'POST', url: `${API}/match/finalize`, body: { userId, seed: 'sweep-match' } },
        refused: { method: 'POST', url: `${API}/match/finalize`, body: { userId }, ...UNAUTHENTICATED },
      },
    },
    'match/stream/route.ts': {
      POST: {
        route: 'match-stream',
        normal: { method: 'POST', url: `${API}/match/stream`, body: { userId, seed: 'sweep-stream' } },
        refused: { method: 'POST', url: `${API}/match/stream`, body: { userId }, ...UNAUTHENTICATED },
      },
    },
    'onboarding/create-team/route.ts': {
      POST: {
        route: 'onboarding-create-team',
        // A second trip through onboarding for a player with a save; the
        // route answers with the save they already own.
        normal: {
          method: 'POST',
          url: `${API}/onboarding/create-team`,
          body: { teamName: 'Varredura FC', primaryColor: '#112233', secondaryColor: '#AABBCC', badgeStyle: 'shield' },
        },
        refused: {
          method: 'POST',
          url: `${API}/onboarding/create-team`,
          body: { teamName: 'Varredura FC', primaryColor: '#112233', secondaryColor: '#AABBCC', badgeStyle: 'shield' },
          ...UNAUTHENTICATED,
        },
      },
    },
    'predictions/route.ts': {
      GET: {
        route: 'predictions',
        normal: { method: 'GET', url: `${API}/predictions?userId=${userId}` },
        refused: { method: 'GET', url: `${API}/predictions?userId=${userId}`, ...UNAUTHENTICATED },
      },
      POST: {
        route: 'predictions',
        normal: { method: 'POST', url: `${API}/predictions`, body: {} },
        refused: { method: 'POST', url: `${API}/predictions`, body: {}, ...UNAUTHENTICATED },
      },
    },
    'predictions/bet/route.ts': {
      POST: {
        route: 'predictions-bet',
        // A real market (seeded in beforeAll): with `predictionId: 'none'`
        // this was a refusal passing as the happy path.
        normal: {
          method: 'POST',
          url: `${API}/predictions/bet`,
          body: { userId, predictionId, optionId: 'home', amount: 1 },
          expectOk: true,
        },
        refused: { method: 'POST', url: `${API}/predictions/bet`, body: { userId }, ...UNAUTHENTICATED },
        domainRefusals: [
          {
            // A stake that would credit the player if the sign check slipped.
            method: 'POST',
            url: `${API}/predictions/bet`,
            body: { userId, predictionId: 'irrelevant', optionId: 'a', amount: -500 },
            expectStatus: [400],
            expectReason: SCHEMA_REFUSAL,
          },
        ],
      },
    },
    'predictions/settle/route.ts': {
      // The scheduled settlement job: no session, the cron secret only.
      GET: {
        route: 'predictions-settle',
        normal: {
          method: 'GET',
          url: `${API}/predictions/settle`,
          headers: { authorization: `Bearer ${SECRETS.CRON_SECRET}` },
          session: null,
        },
        refused: { method: 'GET', url: `${API}/predictions/settle`, session: null, ...WRONG_CRON_SECRET },
      },
      POST: {
        route: 'predictions-settle',
        // Settles the market the bet above was placed on; home won, so the
        // sweep's player is paid out. Runs after the bet because the specs
        // are walked in key order and bet sorts first.
        normal: {
          method: 'POST',
          url: `${API}/predictions/settle`,
          headers: { authorization: `Bearer ${SECRETS.CRON_SECRET}` },
          body: { predictionId, homeScore: 1, awayScore: 0 },
          expectOk: true,
        },
        // Signed in but without the cron or admin secret.
        refused: {
          method: 'POST',
          url: `${API}/predictions/settle`,
          body: { predictionId, homeScore: 1, awayScore: 0 },
          expectStatus: [403],
        },
      },
    },
    'squad/formation/route.ts': {
      POST: {
        route: 'squad-formation',
        normal: { method: 'POST', url: `${API}/squad/formation`, body: { userId, formation: '4-4-2' } },
        refused: { method: 'POST', url: `${API}/squad/formation`, body: { userId, formation: '4-4-2' }, ...UNAUTHENTICATED },
        domainRefusals: [
          {
            method: 'POST',
            url: `${API}/squad/formation`,
            body: { userId, formation: '9-9-9' },
            expectStatus: [400],
          },
        ],
      },
    },
    'predictions/resolve/route.ts': {
      POST: {
        route: 'predictions-resolve',
        // The operator's call, on a bet that is not held: answered 404, not
        // refused for auth. Resolving a real held bet is covered against the
        // database in fixture-edge-cases.test.ts.
        normal: {
          method: 'POST',
          url: `${API}/predictions/resolve`,
          headers: { authorization: `Bearer ${SECRETS.ADMIN_SECRET}` },
          session: null,
          body: { betId: '00000000-0000-4000-8000-000000000000', paidByOldRun: false },
        },
        // The job's secret cannot give an operator's answer.
        refused: {
          method: 'POST',
          url: `${API}/predictions/resolve`,
          headers: { authorization: `Bearer ${SECRETS.CRON_SECRET}` },
          session: null,
          body: { betId: '00000000-0000-4000-8000-000000000000', paidByOldRun: false },
          expectStatus: [403],
        },
      },
    },
    'squad/migrate/route.ts': {
      GET: {
        route: 'squad-migrate',
        normal: {
          method: 'GET',
          url: `${API}/squad/migrate`,
          headers: { authorization: `Bearer ${SECRETS.ADMIN_SECRET}` },
          session: null,
        },
        // No bearer at all: refused as neither cron nor admin.
        refused: { method: 'GET', url: `${API}/squad/migrate`, session: null, expectStatus: [403] },
      },
      POST: {
        route: 'squad-migrate',
        normal: { method: 'POST', url: `${API}/squad/migrate`, body: { userId } },
        refused: { method: 'POST', url: `${API}/squad/migrate`, body: { userId }, ...UNAUTHENTICATED },
      },
    },
    'squad/train/route.ts': {
      POST: {
        route: 'squad-train',
        normal: { method: 'POST', url: `${API}/squad/train`, body: { userId, playerId: firstPlayer, focus: 'technical' } },
        refused: {
          method: 'POST',
          url: `${API}/squad/train`,
          body: { userId, playerId: firstPlayer, focus: 'technical' },
          ...UNAUTHENTICATED,
        },
        domainRefusals: [
          {
            method: 'POST',
            url: `${API}/squad/train`,
            body: { userId, playerId: firstPlayer, focus: 'juggling' },
            expectStatus: [400],
            expectReason: SCHEMA_REFUSAL,
          },
        ],
      },
    },
    'stadium/upgrade/route.ts': {
      POST: {
        route: 'stadium-upgrade',
        normal: { method: 'POST', url: `${API}/stadium/upgrade`, body: { userId } },
        refused: { method: 'POST', url: `${API}/stadium/upgrade`, body: { userId }, ...UNAUTHENTICATED },
      },
    },
    'staff/route.ts': {
      POST: {
        route: 'staff',
        normal: { method: 'POST', url: `${API}/staff`, body: { userId, action: 'hire', role: 'headCoach', tier: 'rookie' } },
        refused: {
          method: 'POST',
          url: `${API}/staff`,
          body: { userId, action: 'hire', role: 'headCoach', tier: 'rookie' },
          ...UNAUTHENTICATED,
        },
        domainRefusals: [
          {
            method: 'POST',
            url: `${API}/staff`,
            body: { userId, action: 'summon', role: 'headCoach', tier: 'rookie' },
            expectStatus: [400],
            expectReason: SCHEMA_REFUSAL,
          },
          {
            method: 'POST',
            url: `${API}/staff`,
            body: { userId, action: 'hire', role: 'wizard', tier: 'rookie' },
            expectStatus: [400],
            expectReason: SCHEMA_REFUSAL,
          },
        ],
      },
    },
    'tournaments/tickets/route.ts': {
      GET: {
        route: 'tournaments-tickets',
        normal: { method: 'GET', url: `${API}/tournaments/tickets?userId=${userId}` },
        refused: { method: 'GET', url: `${API}/tournaments/tickets?userId=${userId}`, ...UNAUTHENTICATED },
      },
      POST: {
        route: 'tournaments-tickets',
        normal: { method: 'POST', url: `${API}/tournaments/tickets`, body: { method: TICKET_METHOD }, expectOk: true },
        refused: { method: 'POST', url: `${API}/tournaments/tickets`, body: { method: TICKET_METHOD }, ...UNAUTHENTICATED },
        domainRefusals: [
          {
            method: 'POST',
            url: `${API}/tournaments/tickets`,
            body: { method: 'found_in_the_street' },
            expectStatus: [400],
            expectReason: SCHEMA_REFUSAL,
          },
        ],
      },
    },
    'transfer/buy/route.ts': {
      POST: {
        route: 'transfer-buy',
        normal: {
          method: 'POST',
          url: `${API}/transfer/buy`,
          body: { userId, player: signing('sweep-buy-1', 'Reforço') },
        },
        refused: { method: 'POST', url: `${API}/transfer/buy`, body: { userId }, ...UNAUTHENTICATED },
        domainRefusals: [
          {
            // A transfer the budget cannot cover: the asking price dwarfs the
            // starting money of the save seeded above.
            method: 'POST',
            url: `${API}/transfer/buy`,
            body: {
              userId,
              player: signing('sweep-buy-2', 'Caríssimo'),
              sellValue: 10_000_000_000,
            },
            expectStatus: [400],
            expectReason: 'Insufficient funds',
          },
          {
            // The body's own schema, not one of the route's domain checks:
            // a signing with no ratings used to be priced at NaN and banked.
            method: 'POST',
            url: `${API}/transfer/buy`,
            body: { userId, player: { id: 'sweep-buy-3', name: 'Sem Atributos', position: 'MID' } },
            expectStatus: [400],
            expectReason: 'body_failed_schema',
          },
        ],
      },
    },
    'transfer/sell/route.ts': {
      POST: {
        route: 'transfer-sell',
        normal: { method: 'POST', url: `${API}/transfer/sell`, body: { userId, playerId: firstPlayer } },
        refused: { method: 'POST', url: `${API}/transfer/sell`, body: { userId, playerId: firstPlayer }, ...UNAUTHENTICATED },
      },
    },
    'youth/route.ts': {
      GET: {
        route: 'youth',
        normal: { method: 'GET', url: `${API}/youth?userId=${userId}` },
        refused: { method: 'GET', url: `${API}/youth?userId=${userId}`, ...UNAUTHENTICATED },
      },
      POST: {
        route: 'youth',
        normal: { method: 'POST', url: `${API}/youth?userId=${userId}`, body: { action: 'generate' } },
        refused: { method: 'POST', url: `${API}/youth?userId=${userId}`, body: { action: 'generate' }, ...UNAUTHENTICATED },
        domainRefusals: [
          {
            method: 'POST',
            url: `${API}/youth?userId=${userId}`,
            body: { action: 'clone' },
            expectStatus: [400],
            expectReason: SCHEMA_REFUSAL,
          },
        ],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Console capture: every call recorded, parsed where it can be.

type Captured = { raw: unknown[]; line: Record<string, unknown> | null };
let captured: Captured[] = [];

function captureConsole(): void {
  const record = (...args: unknown[]) => {
    let line: Record<string, unknown> | null = null;
    if (args.length === 1 && typeof args[0] === 'string') {
      try {
        line = JSON.parse(args[0]);
      } catch {
        line = null;
      }
    }
    captured.push({ raw: args, line });
  };
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation(record);
  }
}

/** Everything written during the sweep, as one string to search for secrets. */
const transcript: string[] = [];

// ---------------------------------------------------------------------------
// Setup.

let dataDir: string;
let local: typeof import('@/db/local');
let modules: Record<string, RouteModule>;
let specs: Record<string, Record<string, Spec>>;
let requestCounter = 0;

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'falamestre-sweep-'));

  // Auth enforced, embedded store, live AI path (the fetch below answers it).
  delete process.env.AUTH_DISABLED;
  delete process.env.USE_MOCK_AI;
  delete process.env.DATABASE_URL;
  process.env.PGLITE_DATA_DIR = dataDir;
  for (const [key, value] of Object.entries(SECRETS)) {
    if (key !== 'DATABASE_URL') process.env[key] = value;
  }

  vi.resetModules();

  // The store module reads DATABASE_URL once, when it loads. Load it first
  // with the variable unset so the sweep runs on the embedded store, then
  // set the fake so it is present in the environment for everything else —
  // anything that dumps its configuration into a log line would show it.
  local = await import('@/db/local');
  await import('@/db');
  process.env.DATABASE_URL = SECRETS.DATABASE_URL;

  // Every outbound call reaches an upstream that reflects the request back,
  // headers included. Validation errors from real providers do this; it is
  // the case in which a verbatim body copy carries our own prompt and key.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      let request: unknown = null;
      try {
        request = JSON.parse(String(init?.body ?? 'null'));
      } catch {
        request = String(init?.body);
      }
      return new Response(
        JSON.stringify({
          error: {
            message: `Rejected. Authorization was ${headers.Authorization ?? headers.authorization}`,
            code: 'invalid_api_key',
            request,
          },
        }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      );
    })
  );

  modules = {};
  for (const [file, load] of Object.entries(ROUTE_FILES)) {
    const key = file.replace(/^\.\.\//, '');
    if (key in EXCLUDED) continue;
    modules[key] = await load();
  }

  // One signed-in player with a save, so the routes have something to act on.
  captureConsole();
  signIn(SESSION_USER);
  const create = modules['onboarding/create-team/route.ts'].POST as Handler;
  const created = await create(
    request({
      method: 'POST',
      url: `${API}/onboarding/create-team`,
      body: { teamName: 'Varredura FC', primaryColor: '#112233', secondaryColor: '#AABBCC', badgeStyle: 'shield' },
    })
  );
  expect(created.status).toBe(201);
  const { userId } = await created.json();
  expect(userId).toBe(SESSION_USER);
  vi.restoreAllMocks();

  // Enough in the bank that the spending routes reach their real work
  // rather than stopping at 'Insufficient funds'.
  const saveStore = await import('@/lib/save-store');
  const initial = await saveStore.loadSave(userId);
  initial!.state.user.money = SWEEP_BUDGET;
  expect((await saveStore.commitSave(userId, initial!.state, initial!.version)).ok).toBe(true);

  const load = modules['conversation/route.ts'].GET as Handler;
  captureConsole();
  const loaded = await load(request({ method: 'GET', url: `${API}/conversation?userId=${userId}` }));
  const save = await loaded.json();
  vi.restoreAllMocks();

  // One open market for the bet and settle calls to really go through.
  const { db } = await import('@/db');
  const schema = await import('@/db/schema');
  const [market] = await db
    .insert(schema.predictions)
    .values({
      matchId: 'sweep-market-1',
      homeTeam: 'Casa FC',
      awayTeam: 'Fora FC',
      type: 'win_draw_loss',
      options: [
        { id: 'home', label: 'Casa', odds: 1.8, totalBets: 0 },
        { id: 'away', label: 'Fora', odds: 2.2, totalBets: 0 },
      ],
      entryCost: 0,
      deadline: new Date(Date.now() + 3_600_000),
      status: 'open',
      matchDate: new Date(Date.now() + 3_600_000),
    })
    .returning({ id: schema.predictions.id });

  specs = specsFor(userId, save.gameState.squad, market.id);
}, 60_000);

afterAll(async () => {
  vi.unstubAllGlobals();
  await local.closeLocalDatabase();
  delete process.env.DATABASE_URL;
  for (const key of Object.keys(SECRETS)) delete process.env[key];
  delete process.env.PGLITE_DATA_DIR;
  rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  captured = [];
  captureConsole();
});

afterEach(() => {
  for (const entry of captured) {
    transcript.push(entry.raw.map((value) => (typeof value === 'string' ? value : JSON.stringify(value))).join(' '));
  }
  vi.restoreAllMocks();
});

function request(call: Call & { requestId?: string }): NextRequest {
  requestCounter += 1;
  const headers: Record<string, string> = {
    // Each call from its own address so the real rate limiter never trips.
    'x-forwarded-for': `10.77.${Math.floor(requestCounter / 250)}.${requestCounter % 250}`,
    ...(call.requestId ? { 'x-request-id': call.requestId } : {}),
    ...(call.headers ?? {}),
  };
  if (call.body !== undefined) headers['content-type'] = 'application/json';
  return new NextRequest(call.url, {
    method: call.method,
    headers,
    body: call.body !== undefined ? JSON.stringify(call.body) : undefined,
  });
}

/** Runs one call and returns its response plus everything it logged. */
async function perform(file: string, method: string, call: Call): Promise<{ response: Response; lines: Captured[] }> {
  const handler = modules[file][method] as Handler;
  const requestId = `sweep-${file.replace(/[^a-z]+/gi, '-')}-${method}-${requestCounter + 1}`;
  signIn(call.session === undefined ? SESSION_USER : call.session);

  const before = captured.length;
  const response = await handler(request({ ...call, requestId }));
  // A stream reports when it settles; drain it the way a browser would.
  if ((response.headers.get('content-type') ?? '').includes('text/event-stream')) {
    await response.text();
  }
  const lines = captured.slice(before);
  return { response, lines };
}

function summaryOf(lines: Captured[]): Record<string, unknown> | null {
  return lines.map((entry) => entry.line).find((line) => line?.message === 'Request completed') ?? null;
}

/** The logging contract for one call, as a list of what it broke. */
function checkLogging(lines: Captured[], { route, label }: { route: string; label: string }): string[] {
  const problems: string[] = [];

  // Everything written was one JSON line.
  for (const entry of lines) {
    if (entry.line === null) problems.push(`${label}: unstructured console output: ${JSON.stringify(entry.raw).slice(0, 200)}`);
  }
  const parsed = lines.flatMap((entry) => (entry.line ? [entry.line] : []));
  if (parsed.length === 0) {
    problems.push(`${label}: wrote nothing at all`);
    return problems;
  }

  // Every line belongs to one request — this one — and names this route.
  const ids = new Set(parsed.map((line) => line.requestId));
  if (ids.size !== 1) problems.push(`${label}: lines carry ${ids.size} different request IDs: ${[...ids].join(', ')}`);
  const expectedId = parsed[0].requestId;
  if (typeof expectedId !== 'string' || !expectedId.startsWith('sweep-')) {
    problems.push(`${label}: lines do not carry the request ID the call sent (got ${String(expectedId)})`);
  }
  for (const line of parsed) {
    if (line.route !== route) problems.push(`${label}: line stamped with route ${String(line.route)}, expected ${route}`);
  }

  // Exactly one summary, with what a summary must carry.
  const summaries = parsed.filter((line) => line.message === 'Request completed');
  if (summaries.length !== 1) problems.push(`${label}: expected exactly one summary line, got ${summaries.length}`);
  const [summary] = summaries;
  if (summary) {
    for (const field of ['status', 'durationMs'] as const) {
      if (typeof summary[field] !== 'number') problems.push(`${label}: summary without numeric ${field}`);
    }
    if (typeof summary.method !== 'string') problems.push(`${label}: summary without method`);
  }
  return problems;
}

// ---------------------------------------------------------------------------
// The sweep.

describe('every API route', () => {
  it('is either in the sweep or excluded with a reason', () => {
    const onDisk = Object.keys(ROUTE_FILES).map((file) => file.replace(/^\.\.\//, '')).sort();
    const covered = [...Object.keys(specs), ...Object.keys(EXCLUDED)].sort();
    expect(onDisk, 'a route file exists that this sweep does not know about').toEqual(covered);

    // And every spec names a real exported method.
    for (const [file, byMethod] of Object.entries(specs)) {
      for (const method of Object.keys(byMethod)) {
        expect(typeof modules[file][method], `${file} does not export ${method}`).toBe('function');
      }
      const exported = Object.keys(modules[file]).filter((key) => /^(GET|POST|PUT|PATCH|DELETE)$/.test(key)).sort();
      expect(exported, `${file} exports a method the sweep does not call`).toEqual(Object.keys(byMethod).sort());
    }
  });

  it('leaves one structured summary line per normal call, under that call\'s ID', async () => {
    // Every route is checked before anything is asserted, so one broken
    // route reports alongside the others rather than hiding them.
    const problems: string[] = [];
    for (const [file, byMethod] of Object.entries(specs)) {
      for (const [method, spec] of Object.entries(byMethod)) {
        const label = `${method} ${file} (normal)`;
        const { response, lines } = await perform(file, method, spec.normal);
        problems.push(...checkLogging(lines, { route: spec.route, label }));
        const summary = summaryOf(lines);
        if (summary && summary.status !== response.status) {
          problems.push(`${label}: summary says ${summary.status}, response was ${response.status}`);
        }
        // A well-formed call from a player with a save must not be a server
        // error — unless that is the bug on record for this route.
        const known = spec.known?.kind === 'server_error' ? spec.known : undefined;
        if (response.status >= 500 && !known) {
          problems.push(`${label}: server error ${response.status} — ${JSON.stringify(summary)}`);
        }
        // And where the call is meant to go through, it has to go through:
        // a 400 is not a 500, so without this a fixture naming something
        // the game does not have reads as a pass.
        if (spec.normal.expectOk && response.status >= 300) {
          problems.push(`${label}: expected 2xx, got ${response.status} — ${JSON.stringify(summary)}`);
        }
        if (known && response.status < 500) {
          problems.push(`${label}: no longer a server error — the bug is fixed, so remove its \`known\` marker and close ${known.roadmap}`);
        }
      }
    }
    expect(problems).toEqual([]);
  }, 120_000);

  it('reports every refused call at warn, with the reason, under that call\'s ID', async () => {
    const problems: string[] = [];
    for (const [file, byMethod] of Object.entries(specs)) {
      for (const [method, spec] of Object.entries(byMethod)) {
        if (!spec.refused) continue;
        const label = `${method} ${file} (refused)`;
        const { expectStatus, expectReason, ...call } = spec.refused;
        const { response, lines } = await perform(file, method, call);
        problems.push(...checkLogging(lines, { route: spec.route, label }));
        const summary = summaryOf(lines);
        const known = spec.known?.kind === 'did_not_refuse' ? spec.known : undefined;
        if (!expectStatus.includes(response.status)) {
          if (known && response.status < 400) {
            // The bug on record: the route answers a call it should refuse.
            // Its logging is still held to the contract above.
            continue;
          }
          problems.push(`${label}: expected ${expectStatus.join('/')}, got ${response.status} — the route did not refuse`);
          continue;
        }
        if (known) {
          problems.push(`${label}: now refuses with ${response.status} — the bug is fixed, so remove its \`known\` marker and close ${known.roadmap}`);
        }
        if (summary?.level !== 'warn') problems.push(`${label}: refusal logged at ${summary?.level}, not warn`);
        if (typeof summary?.reason !== 'string') problems.push(`${label}: refusal without a reason`);
        else if (expectReason && summary.reason !== expectReason) {
          problems.push(`${label}: reason ${summary.reason}, expected ${expectReason}`);
        }
      }
    }
    expect(problems).toEqual([]);
  }, 120_000);

  it('reports a refusal from the route\'s own checks at warn, with the reason', async () => {
    // The shared gates (auth, cron secrets, body caps) record their reasons
    // themselves; a refusal the route decides — a bad formation, an unknown
    // action, not enough money — reaches the summary only through the reply's
    // own error text. This holds those to the same contract, so a route whose
    // refusal stops carrying a reason fails here rather than going quiet.
    const problems: string[] = [];
    for (const [file, byMethod] of Object.entries(specs)) {
      for (const [method, spec] of Object.entries(byMethod)) {
        for (const [index, refusal] of (spec.domainRefusals ?? []).entries()) {
          const label = `${method} ${file} (domain refusal ${index + 1})`;
          const { expectStatus, expectReason, ...call } = refusal;
          const { response, lines } = await perform(file, method, call);
          problems.push(...checkLogging(lines, { route: spec.route, label }));
          const summary = summaryOf(lines);
          if (!expectStatus.includes(response.status)) {
            problems.push(`${label}: expected ${expectStatus.join('/')}, got ${response.status} — the route did not refuse`);
            continue;
          }
          if (summary?.level !== 'warn') problems.push(`${label}: refusal logged at ${summary?.level}, not warn`);
          if (typeof summary?.reason !== 'string') problems.push(`${label}: refusal without a reason`);
          else if (expectReason && summary.reason !== expectReason) {
            problems.push(`${label}: reason ${summary.reason}, expected ${expectReason}`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  }, 120_000);

  it('never wrote a secret, the database password or the player\'s message', () => {
    const all = transcript.join('\n');
    expect(all.length).toBeGreaterThan(0);
    for (const value of FORBIDDEN) {
      const at = all.indexOf(value);
      expect(at, `found ${value} in: ${all.slice(Math.max(0, at - 200), at + 100)}`).toBe(-1);
    }
  });

  it('actually exercised the live-model path, so the key check above meant something', () => {
    const all = transcript.join('\n');
    expect(all).toContain('"message":"OpenRouter API error"');
    expect(all).toContain('"upstreamCode":"invalid_api_key"');
  });
});
