/**
 * Reading a player's bonuses out of the database.
 *
 * Kept apart from investment-bonuses.ts, which does the arithmetic and is
 * reachable from client code through economy.ts. Only server routes get here.
 */

import { db } from '@/db';
import { fanClubInvestments } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import {
  aggregateInvestmentBonuses,
  NO_INVESTMENT_BONUSES,
  type InvestmentBonuses,
} from './investment-bonuses';

/**
 * The bonuses in force for a player right now.
 *
 * Reads the same `active` rows the investment screen lists. A failure to read
 * them returns no bonuses rather than raising: a database hiccup should cost a
 * player their bonus for one match, not their match.
 */
export async function loadInvestmentBonuses(userId: string): Promise<InvestmentBonuses> {
  try {
    // `active` alone is not enough: the daily cron is what flips it off, so
    // between the lock ending and the next run a row would still be boosting.
    // The unlock date is checked here too, which makes the end of a bonus
    // exact however stale the flag is.
    const rows = await db.query.fanClubInvestments.findMany({
      where: and(
        eq(fanClubInvestments.userId, userId),
        eq(fanClubInvestments.active, true),
        gt(fanClubInvestments.unlockDate, new Date())
      ),
    });
    return aggregateInvestmentBonuses(rows);
  } catch {
    return { ...NO_INVESTMENT_BONUSES };
  }
}
