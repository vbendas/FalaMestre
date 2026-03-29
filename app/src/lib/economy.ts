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

export function getTierFromLeague(league: string): TierDivision {
  if (league.includes('Serie A')) return 'Serie A';
  if (league.includes('Serie B')) return 'Serie B';
  if (league.includes('Serie C')) return 'Serie C';
  return 'Serie D';
}

export function getTierConstants(division: TierDivision) {
  return TIER_CONSTANTS[division];
}

export function calculateMatchEarnings(
  division: TierDivision,
  result: 'win' | 'draw' | 'loss',
  isHome: boolean,
  stadium: Stadium
): number {
  const tier = getTierConstants(division);
  
  if (isHome && stadium.capacity > 0) {
    const attendanceRate = Math.min(
      ECONOMY_CONSTANTS.BASE_ATTENDANCE + (stadium.amenities / 500),
      1.0
    );
    const actualAttendance = Math.floor(stadium.capacity * attendanceRate);
    const ticketRevenue = actualAttendance * stadium.ticketPrice * ECONOMY_CONSTANTS.TICKET_REVENUE_SHARE;
    
    let matchResultBonus = 0;
    if (result === 'win') matchResultBonus = tier.winPrize;
    else if (result === 'draw') matchResultBonus = tier.drawPrize;
    else matchResultBonus = tier.lossPrize;
    
    return Math.floor(ticketRevenue + matchResultBonus);
  } else {
    if (result === 'win') return tier.winPrize;
    if (result === 'draw') return tier.drawPrize;
    return tier.lossPrize;
  }
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

export function calculatePlayerValue(player: Player): number {
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

export function calculatePlayerWage(player: Player): number {
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

import { INVESTMENT_TIERS, INVESTMENT_CONFIG } from './constants';
import type { InvestmentOption, FanClubInvestment, InvestmentYield } from './types';

export function getInvestmentTier(option: InvestmentOption) {
  return INVESTMENT_TIERS[option];
}

export function calculateYieldExpiryDate(createdAt: Date): Date {
  const expiryDate = new Date(createdAt);
  expiryDate.setDate(expiryDate.getDate() + INVESTMENT_CONFIG.YIELD_EXPIRY_DAYS);
  return expiryDate;
}

export function isYieldExpired(yieldRecord: InvestmentYield): boolean {
  if (yieldRecord.claimed) return false;
  
  const expiryDate = new Date(yieldRecord.expiryDate);
  return expiryDate < new Date();
}

export function canClaimYield(yieldRecord: InvestmentYield): boolean {
  if (yieldRecord.claimed) return false;
  
  const createdAt = new Date(yieldRecord.createdAt);
  const now = new Date();
  const daysPassed = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  
  return daysPassed > 0;
}

export function calculateInvestmentMoraleBoost(activeInvestments: FanClubInvestment[]): number {
  let totalMoraleBoost = 0;
  
  for (const investment of activeInvestments) {
    if (investment.active) {
      totalMoraleBoost += investment.moraleBoost;
    }
  }
  
  return Math.min(totalMoraleBoost, 25); // Max 25% morale boost
}

export function calculateInvestmentRevenueBoost(activeInvestments: FanClubInvestment[]): number {
  let totalRevenueBoost = 0;
  
  for (const investment of activeInvestments) {
    if (investment.active) {
      totalRevenueBoost += investment.revenueBoostPerMatch;
    }
  }
  
  return totalRevenueBoost;
}

export function adjustMatchEarningsWithInvestment(
  baseEarnings: number,
  revenueBoost: number,
  isHomeMatch: boolean
): number {
  if (!isHomeMatch) return baseEarnings;
  
  return baseEarnings + revenueBoost;
}

export function createInvestment(
  userId: string,
  option: InvestmentOption
): FanClubInvestment {
  const tier = getInvestmentTier(option);
  if (!tier) {
    throw new Error('Invalid investment option');
  }
  
  const now = new Date();
  const unlockDate = new Date(now);
  unlockDate.setDate(unlockDate.getDate() + tier.lockPeriodDays);
  
  return {
    id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    option,
    amount: tier.amount,
    startDate: now.toISOString(),
    unlockDate: unlockDate.toISOString(),
    yieldPerDay: tier.yieldPerDay,
    moraleBoost: tier.moraleBoost,
    revenueBoostPerMatch: tier.revenueBoostPerMatch,
    active: true,
    createdAt: now.toISOString(),
  };
}