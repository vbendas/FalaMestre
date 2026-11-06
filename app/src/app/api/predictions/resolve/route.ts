import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { withApiRoute, ApiContext } from '@/lib/api-route';
import { heldBetResolveRequestSchema } from '@/lib/validations';
import { resolveHeldBet } from '@/lib/market-settlement';
import { recordRefusal, REFUSAL_REASONS } from '@/lib/request-context';

/**
 * An operator settles a bet the old settlement code left claimed, saying
 * whether that run had already paid it (see resolveHeldBet in
 * src/lib/market-settlement.ts). The settlement job lists these bets as
 * `needsReview`.
 *
 * Admin secret only. The job's cron secret settles what can be settled
 * without knowing anything more; this is a person's answer to a question the
 * database cannot answer, so a scheduled caller cannot give it.
 */

function isAdmin(request: NextRequest): boolean {
  const header = request.headers.get('authorization');
  const configured = process.env.ADMIN_SECRET;
  if (!header?.startsWith('Bearer ') || !configured) return false;
  const presented = Buffer.from(header.slice('Bearer '.length));
  const expected = Buffer.from(configured);
  return presented.length === expected.length && crypto.timingSafeEqual(presented, expected);
}

export const POST = withApiRoute('predictions-resolve', async (
  request: NextRequest,
  { log, readBody }: ApiContext
) => {
  try {
    if (!isAdmin(request)) {
      recordRefusal(REFUSAL_REASONS.cronSecretInvalid);
      return NextResponse.json({ error: 'Admin auth required to resolve a held bet' }, { status: 403 });
    }

    const bodyResult = await readBody(heldBetResolveRequestSchema);
    if (!bodyResult.ok) return bodyResult.response;
    const { betId, paidByOldRun } = bodyResult.body;

    const resolved = await resolveHeldBet(betId, paidByOldRun);
    switch (resolved.status) {
      case 'not_found':
        return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
      case 'not_held':
        return NextResponse.json(
          { error: 'This bet is not held: it is settled, or settlement can settle it on its own' },
          { status: 409 }
        );
      case 'no_result':
        return NextResponse.json({ error: 'The match this bet is on has no result yet' }, { status: 409 });
    }

    log.info('Held bet resolved', { won: resolved.won, payout: resolved.payout, credited: resolved.credited });
    return NextResponse.json({ success: true, ...resolved });
  } catch (error) {
    log.error('Error resolving a held bet', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
