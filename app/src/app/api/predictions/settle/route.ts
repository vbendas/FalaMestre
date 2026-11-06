import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { predictions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withApiRoute, ApiContext } from '@/lib/api-route';
import { requireCronAuth } from '@/lib/cron-auth';
import { predictionSettleRequestSchema } from '@/lib/validations';
import { bankedResult, fixtureOfMatchId } from '@/lib/fixture-markets';
import { recordMarketResult, settleDueMarkets, settleMarket } from '@/lib/market-settlement';
import { recordRefusal, REFUSAL_REASONS } from '@/lib/request-context';
import { loadSave } from '@/lib/save-store';

/**
 * Settlement, for callers that are not a player: the scheduled job and an
 * operator. Markets are normally settled the moment their match is banked
 * (see src/lib/market-settlement.ts); these are the backstop.
 *
 * Neither asks for a signed-in player. Settlement used to demand a session
 * *and* the job secret at once, so the scheduler, which has no session,
 * could never call it.
 */

function presentedSecret(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
}

function matches(presented: string, configured: string | undefined): boolean {
  if (!configured) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(configured);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * The scheduled job (Vercel cron calls GET with the cron secret): settles
 * every market whose match has been banked and that still has something to
 * do. Running it again once it has finished pays nobody again.
 */
export const GET = withApiRoute('predictions-settle', async (
  request: NextRequest,
  { log }: ApiContext
) => {
  const authError = requireCronAuth(request);
  if (authError) return authError;

  try {
    const sweep = await settleDueMarkets(log);
    if (sweep.failed > 0 || sweep.stuck > 0) {
      log.warn('Settlement left bets unpaid', { failed: sweep.failed, stuck: sweep.stuck });
    }
    // A failed payout is reported, so the scheduler shows the run as failed
    // and the next one retries it.
    return NextResponse.json(
      { success: sweep.failed === 0, ...sweep },
      { status: sweep.failed === 0 ? 200 : 502 }
    );
  } catch (error) {
    log.error('Error running settlement', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

/**
 * Settles one market, with the cron or admin secret. A fixture market is
 * settled against the score banked for it, never the one sent: the scores
 * in the body must agree with it, or the call is refused. Only a market on
 * no player's fixture (hand-seeded, with nothing banked to read) takes its
 * result from the body.
 */
export const POST = withApiRoute('predictions-settle', async (
  request: NextRequest,
  { log, readBody }: ApiContext
) => {
  try {
    const secret = presentedSecret(request);
    if (!secret || (!matches(secret, process.env.CRON_SECRET) && !matches(secret, process.env.ADMIN_SECRET))) {
      recordRefusal(secret ? REFUSAL_REASONS.cronSecretInvalid : REFUSAL_REASONS.cronSecretMissing);
      return NextResponse.json({ error: 'Admin or cron auth required to settle predictions' }, { status: 403 });
    }

    const bodyResult = await readBody(predictionSettleRequestSchema);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }
    const { predictionId, homeScore, awayScore } = bodyResult.body;

    const market = await db.query.predictions.findFirst({
      where: eq(predictions.id, predictionId),
    });
    if (!market) {
      return NextResponse.json({ error: 'Prediction not found' }, { status: 404 });
    }

    let recorded =
      market.homeScore !== null && market.awayScore !== null
        ? { homeScore: market.homeScore, awayScore: market.awayScore }
        : null;

    if (!recorded && market.userId) {
      // A fixture market: its result is whatever the save banked.
      const fixture = fixtureOfMatchId(market.matchId);
      const save = fixture === null ? null : await loadSave(market.userId);
      recorded = (fixture !== null && save && bankedResult(save.state, fixture)) || null;
      if (!recorded) {
        return NextResponse.json(
          { error: 'This fixture has not been played yet, there is no result to settle on' },
          { status: 409 }
        );
      }
    }

    if (recorded && (recorded.homeScore !== homeScore || recorded.awayScore !== awayScore)) {
      return NextResponse.json(
        { error: 'Score does not match the result recorded for this match', recorded },
        { status: 409 }
      );
    }

    await recordMarketResult(predictionId, recorded ?? { homeScore, awayScore });
    const settled = await settleMarket(predictionId, log);

    if (settled.failed > 0) {
      // Not a success: bets are still open. The run is reported so the
      // caller retries it, and the retry pays only what is still open.
      log.warn('Settlement left bets open', { failedPayouts: settled.failed, predictionId });
    }

    return NextResponse.json(
      {
        success: settled.failed === 0,
        alreadySettled: settled.alreadySettled,
        totalBets: settled.betsSettled,
        totalPayouts: settled.paid,
        failedPayouts: settled.failed,
        options: settled.options,
        winner: settled.options.find(o => o.result === 'won')?.label || 'Draw',
      },
      { status: settled.failed === 0 ? 200 : 502 }
    );
  } catch (error) {
    log.error('Error settling prediction', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
