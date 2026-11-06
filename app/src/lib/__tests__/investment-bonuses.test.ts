// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  aggregateInvestmentBonuses,
  effectiveMorale,
  NO_INVESTMENT_BONUSES,
} from '@/lib/investment-bonuses';
import { INVESTMENT_PRODUCTS, getInvestmentProduct } from '@/lib/investments';
import { calculateMatchEarnings } from '@/lib/economy';
import { applyMatchOutcome } from '@/lib/match-bookkeeping';
import { generateYouthPlayer } from '@/lib/youth-generator';
import { createInitialGameState, BRAZILIAN_TEAMS } from '@/lib/game-engine';
import { withSeed } from '@/lib/rng';
import type { GameState, Stadium } from '@/lib/types';

/**
 * What an investment is worth, where it is worth it.
 *
 * Every bonus the catalogue prints used to be decorative: the three helpers
 * in economy.ts that computed them had no callers at all, so a player could
 * buy a 500k 'Infraestrutura' card promising +30% receita por jogo and the
 * match would pay exactly what it paid before. These check each one reaches
 * the mechanic its card names.
 */

const USER_ID = 'user_abc123def';

/** A stored row, as the aggregate reads it. */
function row(option: string, moraleBoost = 0, revenueBoostPerMatch = 0) {
  return { option, moraleBoost, revenueBoostPerMatch };
}

const STADIUM: Stadium = {
  level: 3,
  capacity: 20_000,
  amenities: 0,
  ticketPrice: 50,
  maintenanceLevel: 1,
};

describe('aggregateInvestmentBonuses', () => {
  it('reads a percentage bonus off the product the row was bought from', () => {
    const bonuses = aggregateInvestmentBonuses([row('infraestrutura'), row('marketing_digital')]);

    expect(bonuses.matchEarningsPercent).toBe(30);
    expect(bonuses.ticketSalesPercent).toBe(15);
    expect(bonuses.youthQualityPercent).toBe(0);
  });

  it('counts a morale product once, not twice', () => {
    // `clube_torcedores` carries the same 2% as a column and as a strategic
    // bonus; the column is what the retired tiers wrote, so it is the one
    // that counts and the product must not add it again.
    const product = getInvestmentProduct('clube_torcedores')!;
    const bonuses = aggregateInvestmentBonuses([
      row('clube_torcedores', product.moraleBoost, product.revenueBoostPerMatch),
    ]);

    expect(bonuses.moralePercent).toBe(2);
    expect(bonuses.revenuePerMatch).toBe(15_000);
  });

  it('still pays a row from the retired A, B and C tiers off its own columns', () => {
    // Nothing sells these any more and no product describes them, so the
    // columns they were written with are the whole of what they are worth.
    const bonuses = aggregateInvestmentBonuses([row('C', 15, 150_000)]);

    expect(bonuses.moralePercent).toBe(15);
    expect(bonuses.revenuePerMatch).toBe(150_000);
  });

  it('caps stacked morale, which multiplies team power directly', () => {
    const bonuses = aggregateInvestmentBonuses(
      Array.from({ length: 20 }, () => row('clube_torcedores', 2))
    );

    expect(bonuses.moralePercent).toBe(25);
  });

  it('gives nothing for a product that promises nothing', () => {
    // The two cards whose bonus the game had no mechanic for.
    expect(aggregateInvestmentBonuses([row('social_media'), row('scout_network')]))
      .toEqual(NO_INVESTMENT_BONUSES);
  });

  it('has a mechanic behind every bonus the catalogue prints', () => {
    // The guard against a card promising something again: a bonus type the
    // aggregate does not route anywhere would show up here as a product
    // whose purchase changes nothing.
    for (const product of INVESTMENT_PRODUCTS) {
      if (!product.strategicBonus) continue;
      const bonuses = aggregateInvestmentBonuses([
        row(product.id, product.moraleBoost, product.revenueBoostPerMatch),
      ]);
      expect(bonuses, `${product.id} promises a bonus that lands nowhere`)
        .not.toEqual(NO_INVESTMENT_BONUSES);
    }
  });
});

describe('effectiveMorale', () => {
  it('lifts morale for the match without touching the saved value', () => {
    expect(effectiveMorale(75, { ...NO_INVESTMENT_BONUSES, moralePercent: 2 })).toBe(77);
  });

  it('does not push morale past 100', () => {
    expect(effectiveMorale(99, { ...NO_INVESTMENT_BONUSES, moralePercent: 25 })).toBe(100);
  });
});

describe('calculateMatchEarnings with investments', () => {
  const base = () => calculateMatchEarnings('Serie D', 'win', true, STADIUM);

  it('pays exactly what it used to when there are no investments', () => {
    expect(calculateMatchEarnings('Serie D', 'win', true, STADIUM, NO_INVESTMENT_BONUSES))
      .toBe(base());
  });

  it('lifts the gate, and only the gate, for a bilheteria bonus', () => {
    // Attendance is 70% of capacity and the club keeps 70% of the gate; the
    // division's prize is untouched, so the whole difference is 15% of that.
    const gate = 20_000 * 0.7 * 50 * 0.7;
    const boosted = calculateMatchEarnings('Serie D', 'win', true, STADIUM, {
      ...NO_INVESTMENT_BONUSES,
      ticketSalesPercent: 15,
    });

    // Within a cruzeiro: only the total is floored, not the gate alone.
    expect(Math.abs(boosted - base() - gate * 0.15)).toBeLessThanOrEqual(1);
  });

  it('is worth nothing away from home, where there is no gate', () => {
    const away = calculateMatchEarnings('Serie D', 'win', false, STADIUM);
    expect(calculateMatchEarnings('Serie D', 'win', false, STADIUM, {
      ...NO_INVESTMENT_BONUSES,
      ticketSalesPercent: 15,
    })).toBe(away);
  });

  it('lifts the whole of a match for a receita-por-jogo bonus, prize included', () => {
    const boosted = calculateMatchEarnings('Serie D', 'win', true, STADIUM, {
      ...NO_INVESTMENT_BONUSES,
      matchEarningsPercent: 30,
    });

    // base() is already floored, so the two differ by under a cruzeiro per
    // flooring, not by a bonus that failed to apply.
    expect(Math.abs(boosted - base() * 1.3)).toBeLessThanOrEqual(2);
  });

  it('adds a flat home top-up', () => {
    expect(calculateMatchEarnings('Serie D', 'win', true, STADIUM, {
      ...NO_INVESTMENT_BONUSES,
      revenuePerMatch: 15_000,
    })).toBeCloseTo(base() + 15_000, -0.5);
  });
});

describe('applyMatchOutcome with investments', () => {
  function state(): GameState {
    const s = withSeed('fixture', () => createInitialGameState(USER_ID, BRAZILIAN_TEAMS[0].name));
    s.stadium = { ...STADIUM };
    s.season.division = 'Serie D';
    return s;
  }

  it('banks the boosted earnings, not the base ones', () => {
    const plain = state();
    const invested = state();
    const outcome = { homeScore: 2, awayScore: 0, winner: BRAZILIAN_TEAMS[0].name };
    const input = { opponentTeam: BRAZILIAN_TEAMS[1].name, isHome: true, outcome };

    const plainResult = withSeed('m', () => applyMatchOutcome(plain, input));
    const investedResult = withSeed('m', () =>
      applyMatchOutcome(invested, {
        ...input,
        bonuses: { ...NO_INVESTMENT_BONUSES, matchEarningsPercent: 30 },
      })
    );

    expect(investedResult.matchEarnings).toBeGreaterThan(plainResult.matchEarnings);
    expect(invested.user.money - plain.user.money).toBe(
      investedResult.matchEarnings - plainResult.matchEarnings
    );
  });
});

describe('youth intake with an academy investment', () => {
  it('raises the potential a prospect can be born with', () => {
    // Rolled rather than computed, so the claim is about the distribution:
    // over a sample the invested intake is better, and never worse than the
    // ceiling the generator has always enforced.
    const sample = (quality: number) =>
      Array.from({ length: 200 }, () => generateYouthPlayer(0, 0, quality));

    const plain = sample(0);
    const invested = sample(20);

    const mean = (players: { potential: number }[]) =>
      players.reduce((sum, p) => sum + p.potential, 0) / players.length;

    expect(mean(invested)).toBeGreaterThan(mean(plain));
    expect(Math.max(...invested.map((p) => p.potential))).toBeLessThanOrEqual(95);
    expect(Math.max(...invested.map((p) => p.currentAbility))).toBeLessThanOrEqual(99);
  });
});
