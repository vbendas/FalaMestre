import {
  TierDivision,
  Stadium,
  Facilities,
  Staff,
  Player,
  GameState,
} from './types';
import {
  TIER_CONSTANTS,
  ECONOMY_CONSTANTS,
  STADIUM_UPGRADES,
  FACILITY_UPGRADES,
  PLAYER_VALUE,
} from './constants';
import {
  applyPercent,
  NO_INVESTMENT_BONUSES,
  type InvestmentBonuses,
} from './investment-bonuses';

export function getTierFromLeague(league: string): TierDivision {
  if (league.includes('Serie A')) return 'Serie A';
  if (league.includes('Serie B')) return 'Serie B';
  if (league.includes('Serie C')) return 'Serie C';
  return 'Serie D';
}

export function getTierConstants(division: TierDivision) {
  return TIER_CONSTANTS[division];
}

/**
 * What a match pays: the gate, plus the division's prize for the result.
 *
 * `bonuses` is what the player's active investments add. Each lands where the
 * card says it does and nowhere else:
 *   - `ticketSalesPercent` lifts the gate only, so it is worth nothing away
 *     from home and nothing without a stadium — which is what a bilheteria
 *     bonus means;
 *   - `revenuePerMatch` is a flat home-match top-up;
 *   - `matchEarningsPercent` lifts the whole, gate and prize together, after
 *     the other two, because the card says 'receita por jogo'.
 * Default to no bonuses so every caller that does not know about investments
 * keeps its old answer exactly.
 */
export function calculateMatchEarnings(
  division: TierDivision,
  result: 'win' | 'draw' | 'loss',
  isHome: boolean,
  stadium: Stadium,
  bonuses: InvestmentBonuses = NO_INVESTMENT_BONUSES
): number {
  const tier = getTierConstants(division);

  const prize = result === 'win' ? tier.winPrize
    : result === 'draw' ? tier.drawPrize
    : tier.lossPrize;

  if (isHome && stadium.capacity > 0) {
    const attendanceRate = Math.min(
      ECONOMY_CONSTANTS.BASE_ATTENDANCE + (stadium.amenities / 500),
      1.0
    );
    const actualAttendance = Math.floor(stadium.capacity * attendanceRate);
    const ticketRevenue = applyPercent(
      actualAttendance * stadium.ticketPrice * ECONOMY_CONSTANTS.TICKET_REVENUE_SHARE,
      bonuses.ticketSalesPercent
    );

    const total = ticketRevenue + prize + bonuses.revenuePerMatch;
    return Math.floor(applyPercent(total, bonuses.matchEarningsPercent));
  }

  return Math.floor(applyPercent(prize, bonuses.matchEarningsPercent));
}

export function calculateStadiumRevenue(stadium: Stadium): number {
  if (stadium.capacity === 0) return 0;
  
  const attendanceRate = Math.min(
    ECONOMY_CONSTANTS.BASE_ATTENDANCE + (stadium.amenities / 500),
    1.0
  );
  const actualAttendance = Math.floor(stadium.capacity * attendanceRate);
  return Math.floor(actualAttendance * stadium.ticketPrice * ECONOMY_CONSTANTS.TICKET_REVENUE_SHARE);
}

/**
 * What pricing a player actually reads: the six ratings and `potential`.
 *
 * Narrower than `Player` so a player who is being priced before they are a
 * squad member — a signing arriving on /api/transfer/buy, which has no
 * fatigue or injury history yet — can be valued without inventing those
 * fields or casting around the gap. A whole `Player` still satisfies it.
 */
export type PriceablePlayer = Pick<
  Player,
  'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy' | 'potential'
>;

export function calculatePlayerValue(player: PriceablePlayer): number {
  const avgAttribute = Math.floor(
    (player.pac + player.sho + player.pas + player.dri + player.def + player.phy) / 6
  );
  
  const ageBonus = player.potential >= PLAYER_VALUE.AGE_BONUS_THRESHOLD 
    ? PLAYER_VALUE.AGE_BONUS_MULTIPLIER 
    : 1;
  
  const value = Math.round(
    avgAttribute * avgAttribute * ageBonus * PLAYER_VALUE.BASE +
    (Math.random() * PLAYER_VALUE.RANDOM_FACTOR * avgAttribute * 1000)
  );
  
  return Math.max(PLAYER_VALUE.BASE, value);
}

export function calculatePlayerWage(player: PriceablePlayer): number {
  const avgAttribute = Math.floor(
    (player.pac + player.sho + player.pas + player.dri + player.def + player.phy) / 6
  );
  return Math.floor(avgAttribute * PLAYER_VALUE.WAGE_PER_OVR);
}

export function calculateSellValue(purchaseValue: number): number {
  return Math.floor(purchaseValue * ECONOMY_CONSTANTS.PLAYER_SELL_VALUE_RATIO);
}

export function getStadiumUpgradeCost(currentLevel: number): number {
  if (currentLevel >= STADIUM_UPGRADES.length - 1) return 0;
  return STADIUM_UPGRADES[currentLevel + 1].cost;
}

export function upgradeStadium(stadium: Stadium): Stadium {
  const nextLevel = stadium.level + 1;
  if (nextLevel >= STADIUM_UPGRADES.length - 1) return stadium;
  
  const upgrade = STADIUM_UPGRADES[nextLevel];
  
  return {
    level: nextLevel,
    capacity: upgrade.capacity,
    amenities: stadium.amenities,
    ticketPrice: upgrade.ticketPrice,
    maintenanceLevel: stadium.maintenanceLevel,
  };
}

export function getFacilityUpgradeCost(
  currentLevel: number,
  facilityType: keyof typeof FACILITY_UPGRADES
): number {
  const facility = FACILITY_UPGRADES[facilityType];
  if (currentLevel >= facility.maxLevel) return 0;
  
  return Math.floor(facility.baseCost * Math.pow(facility.costMultiplier, currentLevel));
}

export function upgradeFacility(
  facilities: Facilities,
  facilityType: keyof Facilities
): Facilities {
  const currentLevel = facilities[facilityType];
  const facility = FACILITY_UPGRADES[facilityType];
  
  if (currentLevel >= facility.maxLevel) return facilities;
  
  return {
    ...facilities,
    [facilityType]: currentLevel + 1,
  };
}

export function getFacilityEffect(
  facilities: Facilities,
  facilityType: keyof Facilities
): number {
  const currentLevel = facilities[facilityType];
  const facility = FACILITY_UPGRADES[facilityType];
  return currentLevel * facility.effectPerLevel;
}

export function calculateWeeklyStaffWages(staff: Staff | null | undefined): number {
  let total = 0;
  
  if (!staff) return total;
  if (staff.headCoach) total += staff.headCoach.weeklyWage;
  if (staff.scout) total += staff.scout.weeklyWage;
  if (staff.medicalStaff) total += staff.medicalStaff.weeklyWage;
  
  return total;
}

export function getDailyRewardAmount(dayOfCycle: number): number {
  const cycleIndex = (dayOfCycle - 1) % ECONOMY_CONSTANTS.DAILY_REWARD_BASE.length;
  return ECONOMY_CONSTANTS.DAILY_REWARD_BASE[cycleIndex];
}

export function getStreakBonus(streak: number): number {
  return Math.floor(
    getDailyRewardAmount(1) * streak * ECONOMY_CONSTANTS.STREAK_BONUS_MULTIPLIER
  );
}

export function getPromotionReward(currentDivision: TierDivision, newDivision: TierDivision): number {
  const currentTier = TIER_CONSTANTS[currentDivision];
  const targetTier = TIER_CONSTANTS[newDivision];
  
  if (targetTier.order > currentTier.order) {
    return targetTier.promotionPrize;
  }
  return 0;
}

export function getChampionshipReward(
  division: TierDivision,
  position: number
): number {
  const tier = TIER_CONSTANTS[division];
  
  if (position === 1) return tier.championshipWinner;
  if (position === 2) return tier.championshipSecond;
  if (position === 3) return tier.championshipThird;
  
  return 0;
}

export function calculateYouthDevelopmentBonus(facilities: Facilities): number {
  const academyLevel = facilities.youthAcademy;
  const trainingLevel = facilities.trainingCenter;
  
  return (academyLevel / 10) * (trainingLevel / 50);
}

export function formatMoney(amount: number): string {
  if (amount >= 1000000000) {
    return `R$ ${(amount / 1000000000).toFixed(1)}B`;
  }
  if (amount >= 1000000) {
    return `R$ ${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `R$ ${(amount / 1000).toFixed(1)}K`;
  }
  return `R$ ${amount.toLocaleString()}`;
}

// =====================================================
// FAN CLUB INVESTMENT FUNCTIONS
// =====================================================

import { INVESTMENT_CONFIG } from './constants';

export function calculateYieldExpiryDate(createdAt: Date): Date {
  const expiryDate = new Date(createdAt);
  expiryDate.setDate(expiryDate.getDate() + INVESTMENT_CONFIG.YIELD_EXPIRY_DAYS);
  return expiryDate;
}

// isYieldExpired and canClaimYield used to sit here, each a private
// definition of when a yield may be paid. Nothing applied canClaimYield, and
// the claim route and the expiry sweep now both judge a yield by its own
// expiryDate column, so there is no second definition left to drift.

// The three helpers that used to sit here — calculateInvestmentMoraleBoost,
// calculateInvestmentRevenueBoost and adjustMatchEarningsWithInvestment —
// computed investment bonuses that no caller ever applied. The work they
// described now happens for real in investment-bonuses.ts and in
// calculateMatchEarnings above.
