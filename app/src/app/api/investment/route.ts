import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fanClubInvestments, investmentYields } from '@/db/schema';
import { eq, and, gt, gte } from 'drizzle-orm';
import {
  getInvestmentProduct,
  describeStoredInvestment,
  INVESTMENT_PRODUCT_IDS,
} from '@/lib/investments';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';
import { withApiRoute, ApiContext } from '@/lib/api-route';
import { loadSave, adjustMoney } from '@/lib/save-store';
import { investmentRequestSchema } from '@/lib/validations';

export const GET = withApiRoute('investment', async (
  request: NextRequest,
  { log }: ApiContext
) => {
  try {
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }

    const sessionUserId = await getAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (sessionUserId && userId && userId !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetUserId = sessionUserId || userId;

    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const now = new Date();

    // `active` plus the unlock date, same as the bonus loader: the daily cron
    // is what flips the flag, so a row whose lock just ended must not read as
    // owned (or boost, or promise a yield) while the cron is yet to run.
    const investments = await db.query.fanClubInvestments.findMany({
      where: and(
        eq(fanClubInvestments.userId, targetUserId),
        eq(fanClubInvestments.active, true),
        gt(fanClubInvestments.unlockDate, now)
      ),
    });

    // The unclaimed yields go out with them. The screen needs both to show
    // what a player owns and what it has earned, and it had no way to ask for
    // the second: the only thing that listed yields was a dashboard card that
    // is never rendered, so money the cron generated was unreachable.
    // Only what a press of the claim button can actually pay: not claimed,
    // not swept, not past its window. The screen used to be offered yields
    // already expired, and claiming one consumed it for nothing.
    const pendingYields = await db.query.investmentYields.findMany({
      where: and(
        eq(investmentYields.userId, targetUserId),
        eq(investmentYields.claimed, false),
        eq(investmentYields.expired, false),
        gte(investmentYields.expiryDate, now)
      ),
    });

    // Named for the card, so a row from the retired tiers reads as something
    // other than 'A'. The product's own figures ride along so the active list
    // can show what each one is doing without a second source of truth.
    const described = investments.map((investment: { option: string }) => ({
      ...investment,
      ...describeStoredInvestment(investment.option),
      strategicBonus: getInvestmentProduct(investment.option)?.strategicBonus ?? null,
    }));

    return NextResponse.json({
      investments: described,
      activeCount: described.length,
      pendingYields,
      pendingYieldTotal: pendingYields.reduce((sum: number, y: { amount: number }) => sum + y.amount, 0),
    });
    
  } catch (error) {
    log.error('Error fetching investments', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withApiRoute('investment', async (
  request: NextRequest,
  { log, readBody, refuse }: ApiContext
) => {
  try {
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }

    const sessionUserId = await getAuthenticatedUser();

    const bodyResult = await readBody(investmentRequestSchema);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const { option, userId } = bodyResult.body;

    if (sessionUserId && userId && userId !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetUserId = sessionUserId || userId;

    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }
    
    // The catalogue prices the purchase. The screen renders from the same
    // rows, so what a card reads is what is charged here — the route used to
    // sell three tiers the screen never showed and charge tier C for five of
    // its seven cards.
    //
    // The schema already narrows `option` to a catalogue id, so this lookup
    // only misses if the two ever came apart; it refuses rather than trusts.
    const product = getInvestmentProduct(option);
    if (!product) {
      refuse('investment_unknown_product');
      return NextResponse.json({
        error: `No such investment: ${option}. Available investments: ${INVESTMENT_PRODUCT_IDS.join(', ')}`,
      }, { status: 400 });
    }

    // The friendly refusal, worded off the balance as it stands. The debit
    // below re-checks at the instant of the write; this read only exists so
    // a player who plainly cannot afford the product is told the numbers.
    const save = await loadSave(targetUserId);
    if (!save) {
      return NextResponse.json({ error: 'Game state not found' }, { status: 404 });
    }
    const userMoney = save.state.user.money;
    if (userMoney - product.cost < 0) {
      return NextResponse.json({
        error: `Insufficient funds. You have ${userMoney}, need ${product.cost}`
      }, { status: 400 });
    }

    // The investment is recorded first, so the money can only ever move once
    // there is an investment to show for it, and the cost comes off inside
    // the UPDATE itself — same shape as placing a bet, which this is a close
    // cousin of: a money-only change to the save plus a row in another
    // table. Writing the save back whole would need the version-retry dance
    // and could lose a race it has no reason to enter.
    //
    // This insert used to go through `createInvestment`, which mints an id
    // of the form `inv_<time>_<random>` for what is a uuid column, so it
    // raised every time — into a catch that logged 'Investment recorded in
    // memory' at info and answered success. The id is the database's to
    // generate, and a failure here is now the player's answer, not a log
    // line's.
    const now = new Date();
    const unlockDate = new Date(now);
    unlockDate.setDate(unlockDate.getDate() + product.durationDays);

    const inserted = await db.insert(fanClubInvestments).values({
      userId: targetUserId,
      option,
      amount: product.cost,
      startDate: now,
      unlockDate,
      yieldPerDay: product.dailyYield,
      moraleBoost: product.moraleBoost,
      revenueBoostPerMatch: product.revenueBoostPerMatch,
      active: true,
    }).returning({ id: fanClubInvestments.id });
    const investmentId = inserted[0]?.id;

    const debited = await adjustMoney(targetUserId, -product.cost, { floor: 0 });
    if (!debited.ok) {
      // Undone by hand: neither driver gives us a transaction across the
      // two statements (see predictions/bet), so the row must not outlive
      // the debit that was meant to pay for it.
      if (investmentId) {
        await db.delete(fanClubInvestments).where(eq(fanClubInvestments.id, investmentId));
      }
      log.warn('Investment refused: the balance moved below the cost while it was being placed', {
        option,
        amount: product.cost,
      });
      return NextResponse.json(
        { error: 'Insufficient funds. The balance changed while the investment was being made.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      newBalance: debited.money,
      yields: {
        perDay: product.dailyYield,
        totalAfterLock: product.dailyYield * product.durationDays
      }
    });
    
  } catch (error) {
    log.error('Error creating investment', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});