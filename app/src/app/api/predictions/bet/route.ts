import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates, predictions, userBets, predictionHistory } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';
import { withApiRoute, ApiContext } from '@/lib/api-route';
import { predictionBetRequestSchema } from '@/lib/validations';
import { loadSave } from '@/lib/save-store';
import { fixtureMatchId } from '@/lib/fixture-markets';

type PredictionOption = { id: string; label: string; odds: number };

export const POST = withApiRoute('predictions-bet', async (
  request: NextRequest,
  { log, readBody }: ApiContext
) => {
  try {
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }

    const sessionUserId = await getAuthenticatedUser();

    const bodyResult = await readBody(predictionBetRequestSchema);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const { predictionId, optionId, amount, userId } = bodyResult.body;

    if (sessionUserId && userId && userId !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetUserId = sessionUserId || userId;

    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Everything below this point is checked before any write. The stake used
    // to come off the save first, so a bet on a prediction that did not exist,
    // or was already closed, charged the player and then failed.
    const prediction = await db.query.predictions.findFirst({
      where: eq(predictions.id, predictionId),
    });

    // A fixture market is on one player's fixture (see fixture-markets.ts)
    // and is theirs to bet on. Someone else's is answered as not found, so
    // the route does not confirm which markets other players have.
    if (!prediction || (prediction.userId && prediction.userId !== targetUserId)) {
      return NextResponse.json({ error: 'Prediction not found' }, { status: 404 });
    }

    if (prediction.status !== 'open') {
      return NextResponse.json(
        { error: `Prediction is ${prediction.status}, no longer accepting bets` },
        { status: 409 }
      );
    }

    if (prediction.deadline && new Date(prediction.deadline) <= new Date()) {
      return NextResponse.json(
        { error: 'Betting deadline has passed' },
        { status: 409 }
      );
    }

    const options = (prediction.options ?? []) as PredictionOption[];
    const option = options.find(o => o.id === optionId);

    if (!option) {
      return NextResponse.json(
        { error: 'Unknown optionId for this prediction' },
        { status: 400 }
      );
    }

    // No save means no balance to bet from. This used to fall back to a
    // fabricated R$1,000,000 and report a balance that was never stored.
    const save = await loadSave(targetUserId);
    if (!save) {
      return NextResponse.json({ error: 'Game state not found' }, { status: 404 });
    }

    // A first look at the balance, for a clear refusal before anything is
    // written. The check that counts is the one inside the debit below.
    // A fixture market takes bets only while its fixture is the one the save
    // is waiting on. Once the match is banked the market is closed, but that
    // close runs after the save is committed; between the two, the result is
    // already in the save and a bet on it would be a bet on a known score.
    if (prediction.userId && prediction.matchId !== fixtureMatchId(save.state.season)) {
      return NextResponse.json(
        { error: 'This fixture has already been played, no longer accepting bets' },
        { status: 409 }
      );
    }

    const userMoney = save.state.user.money;
    if (userMoney - amount < 0) {
      return NextResponse.json({
        error: `Insufficient funds. You have ${userMoney}, need ${amount}`
      }, { status: 400 });
    }

    // At the odds of the option backed, which is what the screen shows the
    // player before they bet. This used to be a flat 1.8x whatever the odds.
    const potentialWin = Math.round(amount * option.odds);

    // Placing the bet is one statement: the market is checked open (and, for
    // a fixture market, still on the fixture the save is waiting on), the
    // stake comes off the balance, the bet is recorded and counted in the
    // player's history, all together or not at all. Postgres applies all of
    // a statement's data-modifying CTEs or none, so a process dying here
    // leaves either a paid-for bet or no bet and no stake taken.
    //
    // It used to be an insert, then a debit, then a history write, undone
    // by hand on failure; dying after the insert left a bet that settlement
    // would pay with no stake ever taken.
    //
    // The checks above are reads a moment old, there for a clear refusal.
    // These are the ones that count:
    //  - the market row is locked FOR SHARE while it is checked open, so a
    //    kickoff closing it (kickOffFixture) waits for this bet to
    //    commit, or this bet sees it closed. A match's first score is shown
    //    only after its kickoff commits, so no bet lands after it;
    //  - the stake is computed from the balance as it is at that instant and
    //    refused below zero, so two bets landing together cannot overdraw,
    //    and nothing else written to the save meanwhile is erased.
    const money = sql`(${gameStates.currentState}->'user'->>'money')::numeric`;
    const placed = (await db.execute(sql`
      with market as (
        select ${predictions.id} from ${predictions}, ${gameStates}
        where ${predictions.id} = ${predictionId}::uuid
          and ${predictions.status} = 'open'
          and ${gameStates.userId} = ${targetUserId}
          and (
            ${predictions.userId} is null
            or (
              ${predictions.userId} = ${targetUserId}
              -- fixtureMatchId, computed from the save as it is now
              and ${predictions.matchId} = (
                case when coalesce((${gameStates.currentState}->'season'->>'number')::int, 1) > 1
                  then 's' || (${gameStates.currentState}->'season'->>'number') || '-'
                  else '' end
              ) || 'round-' || (${gameStates.currentState}->'season'->>'week')
            )
          )
        for share of ${predictions}
      ),
      debited as (
        update ${gameStates}
        set current_state = jsonb_set(${gameStates.currentState}, '{user,money}', to_jsonb(${money} - ${amount}::integer)),
            version = ${gameStates.version} + 1,
            updated_at = now()
        where ${gameStates.userId} = ${targetUserId}
          and ${money} - ${amount}::integer >= 0
          and exists (select 1 from market)
        returning (${gameStates.currentState}->'user'->>'money')::numeric as money
      ),
      bet as (
        insert into ${userBets} (user_id, prediction_id, option_id, amount, potential_win, settled)
        select ${targetUserId}::text, ${predictionId}::uuid, ${optionId}::text,
               ${amount}::integer, ${potentialWin}::integer, false
        from debited
        returning id
      ),
      counted as (
        insert into ${predictionHistory} (user_id, total_bets, last_bet_at)
        select ${targetUserId}::text, 1, now() from bet
        on conflict (user_id) do update set
          total_bets = ${predictionHistory.totalBets} + 1,
          last_bet_at = now(),
          updated_at = now()
        returning 1
      )
      select (select id from bet) as bet_id,
             (select money from debited) as money,
             exists (select 1 from market) as market_open
    `)) as { rows: Array<{ bet_id: string | null; money: string | number | null; market_open: boolean }> };

    const outcome = placed.rows[0];
    if (!outcome?.bet_id) {
      if (!outcome?.market_open) {
        return NextResponse.json(
          { error: 'This match has kicked off, no longer accepting bets' },
          { status: 409 }
        );
      }
      log.warn('Bet refused: the balance moved below the stake while the bet was being placed', {
        amount,
      });
      return NextResponse.json(
        { error: 'Insufficient funds. The balance changed while the bet was being placed.' },
        { status: 400 }
      );
    }
    const newBalance = Number(outcome.money);

    return NextResponse.json({
      success: true,
      newBalance: newBalance,
      potentialWin: potentialWin,
      message: `Aposta de R$ ${amount.toLocaleString()} realizada!`
    });

  } catch (error) {
    log.error('Error placing bet', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});