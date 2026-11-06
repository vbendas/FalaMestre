/**
 * What an active investment actually does to the game.
 *
 * The catalogue in investments.ts says what a card promises; this is where the
 * promise is cashed. Every bonus here reaches a real mechanic — gate receipts,
 * prize money, morale, youth intake, training — and a bonus with nowhere to
 * land is not in the catalogue at all.
 *
 * This module is pure, and stays that way: economy.ts reads it and economy.ts
 * is bundled into the client. Reading the rows from the database lives next
 * door in investment-bonuses-store.ts.
 *
 * Two eras of row feed this. A row bought from the catalogue is read through
 * its product, so its percentage bonus is whatever the card prints. A row from
 * the retired 'A'/'B'/'C' tiers has no product, so it is read off the columns
 * it was written with — `moraleBoost` and `revenueBoostPerMatch` — which is
 * exactly what those tiers sold. Both keep working, neither needs a migration.
 */

import { getInvestmentProduct } from './investments';

/** The shape of a stored investment this module needs to read. */
export interface InvestmentBonusSource {
  option: string;
  moraleBoost: number;
  revenueBoostPerMatch: number;
}

export interface InvestmentBonuses {
  /** Percentage points added to squad morale for the purposes of a match. */
  moralePercent: number;
  /** Percent uplift on the gate (ticket) part of a home match's earnings. */
  ticketSalesPercent: number;
  /** Percent uplift on the whole of a match's earnings. */
  matchEarningsPercent: number;
  /** Percent uplift on the ability and potential of a youth intake. */
  youthQualityPercent: number;
  /** Percent uplift on what one training session gains. */
  trainingSpeedPercent: number;
  /** Flat money added to a home match's earnings. */
  revenuePerMatch: number;
}

export const NO_INVESTMENT_BONUSES: InvestmentBonuses = {
  moralePercent: 0,
  ticketSalesPercent: 0,
  matchEarningsPercent: 0,
  youthQualityPercent: 0,
  trainingSpeedPercent: 0,
  revenuePerMatch: 0,
};

/**
 * The ceiling on stacked morale, carried over from the helper this replaces.
 * Morale multiplies team power directly, so an unbounded stack of investments
 * would be a straight route to an unbeatable side.
 */
const MAX_MORALE_PERCENT = 25;

/** Adds up what a set of active investments is worth, all at once. */
export function aggregateInvestmentBonuses(
  investments: InvestmentBonusSource[]
): InvestmentBonuses {
  const total: InvestmentBonuses = { ...NO_INVESTMENT_BONUSES };

  for (const investment of investments) {
    // Written on the row at purchase, so a legacy tier brings its own.
    total.moralePercent += investment.moraleBoost ?? 0;
    total.revenuePerMatch += investment.revenueBoostPerMatch ?? 0;

    // The percentage bonuses are the product's. A legacy row has no product
    // and contributes only the two columns above — those were its whole deal.
    const product = getInvestmentProduct(investment.option);
    if (!product?.strategicBonus) continue;

    const { type, value } = product.strategicBonus;
    switch (type) {
      case 'ticket_sales':
        total.ticketSalesPercent += value;
        break;
      case 'match_earnings':
        total.matchEarningsPercent += value;
        break;
      case 'youth_quality':
        total.youthQualityPercent += value;
        break;
      case 'training_speed':
        total.trainingSpeedPercent += value;
        break;
      case 'morale':
        // Already counted off `moraleBoost`, which the catalogue keeps equal
        // to the printed value. Counting it here too would double it.
        break;
    }
  }

  total.moralePercent = Math.min(total.moralePercent, MAX_MORALE_PERCENT);
  return total;
}

/**
 * Squad morale as a match should see it, with the fan club behind the team.
 *
 * The saved morale is left alone — the boost lasts as long as the investment
 * does, and writing it into the save would make it permanent.
 */
export function effectiveMorale(morale: number, bonuses: InvestmentBonuses): number {
  return Math.min(100, morale + bonuses.moralePercent);
}

/** Scales a value by a percentage bonus, e.g. 20 → ×1.2. */
export function applyPercent(value: number, percent: number): number {
  return value * (1 + percent / 100);
}
