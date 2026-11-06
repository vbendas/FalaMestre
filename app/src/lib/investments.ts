/**
 * The investment catalogue — the one definition of what the game sells.
 *
 * The screen used to carry its own list of seven products with their own
 * prices, yields and durations, and then post one of three server tiers,
 * mapping everything that was not the first two cards onto the most expensive
 * one. A player could read R$ 150.000 on a card and be charged R$ 500.000.
 *
 * So the products live here, and both sides read them from here: the route
 * prices and records a purchase off `INVESTMENT_PRODUCTS`, and the screen
 * prints the same rows it buys from. A price on a card is now, by
 * construction, the price the route charges.
 */

/**
 * The bonuses that reach a real mechanic, and nowhere else to put one.
 *
 * Adding a member here is a promise that investment-bonuses.ts cashes it: the
 * catalogue used to print `viral_events` and `player_discovery` too, and the
 * game has no random events and no server-side scouting for either to boost.
 */
export type InvestmentBonusType =
  | 'morale'
  | 'ticket_sales'
  | 'match_earnings'
  | 'youth_quality'
  | 'training_speed';

export interface InvestmentStrategicBonus {
  type: InvestmentBonusType;
  /** Percentage points, as printed on the card. */
  value: number;
  /** What the card says the bonus is, in the player's language. */
  label: string;
}

export interface InvestmentProduct {
  /** Stored in `fan_club_investments.option`. Also the id the client posts. */
  id: string;
  name: string;
  icon: string;
  /** What the route charges. */
  cost: number;
  /** What one day of this investment pays. Zero for the bonus-only products. */
  dailyYield: number;
  /** How long it stays active — the gap between start date and unlock date. */
  durationDays: number;
  /** Omitted for a product that boosts nothing — see the two below. */
  strategicBonus?: InvestmentStrategicBonus;
  /**
   * Percentage points of morale, recorded on the row at purchase and read
   * back by investment-bonuses.ts. Kept equal to a `morale` strategic bonus
   * where there is one, so the card and the mechanic cannot disagree.
   */
  moraleBoost: number;
  /** Flat money added to a home match's earnings while this is active. */
  revenueBoostPerMatch: number;
  description: string;
}

export const INVESTMENT_PRODUCTS: readonly InvestmentProduct[] = [
  {
    id: 'clube_torcedores',
    name: 'Clube de Torcedores',
    icon: '💰',
    cost: 50000,
    dailyYield: 10000,
    durationDays: 3,
    strategicBonus: { type: 'morale', value: 2, label: 'Moral do elenco' },
    moraleBoost: 2,
    revenueBoostPerMatch: 15000,
    description: 'Investimento no clube de torcedores. Aumenta a moral do time em 2% e gera rendimento diário.',
  },
  {
    id: 'marketing_digital',
    name: 'Marketing Digital',
    icon: '📱',
    cost: 200000,
    dailyYield: 0,
    durationDays: 7,
    strategicBonus: { type: 'ticket_sales', value: 15, label: 'Receita de bilheteria' },
    moraleBoost: 0,
    revenueBoostPerMatch: 0,
    description: 'Campanha digital para atrair mais torcedores. Aumenta receita de bilheteria em 15%.',
  },
  {
    id: 'social_media',
    name: 'Campanha Redes Sociais',
    icon: '📣',
    cost: 150000,
    dailyYield: 0,
    durationDays: 14,
    moraleBoost: 0,
    revenueBoostPerMatch: 0,
    // Sold a 20% boost to 'eventos especiais'. The game has no random event
    // system for it to boost, so the card no longer claims one.
    description: 'Campanha viral nas redes sociais para dar visibilidade ao clube. Sem efeito sobre as partidas.',
  },
  {
    id: 'academia_base',
    name: 'Academia de Base',
    icon: '🌟',
    cost: 300000,
    dailyYield: 0,
    durationDays: 30,
    strategicBonus: { type: 'youth_quality', value: 20, label: 'Qualidade da base' },
    moraleBoost: 0,
    revenueBoostPerMatch: 0,
    description: 'Investimento na academia de base. Melhora a qualidade dos jovens jogadores em 20%.',
  },
  {
    id: 'staff_esportivo',
    name: 'Staff Esportivo',
    icon: '👔',
    cost: 400000,
    dailyYield: 0,
    durationDays: 14,
    strategicBonus: { type: 'training_speed', value: 20, label: 'Velocidade de treino' },
    moraleBoost: 0,
    revenueBoostPerMatch: 0,
    description: 'Contratar staff adicional. Aumenta velocidade de treinamento em 20%.',
  },
  {
    id: 'scout_network',
    name: 'Rede de Scouts',
    icon: '🔍',
    cost: 250000,
    dailyYield: 0,
    durationDays: 21,
    moraleBoost: 0,
    revenueBoostPerMatch: 0,
    // Sold a 25% boost to player discovery. Scouting quality is only rolled
    // in the youth intake (that is `academia_base`); the transfer market is
    // generated on the client and no server mechanic reads a scout bonus.
    description: 'Rede de sondagens pelo país para dar nome ao clube. Sem efeito sobre as partidas.',
  },
  {
    id: 'infraestrutura',
    name: 'Infraestrutura',
    icon: '🏟️',
    cost: 500000,
    dailyYield: 0,
    durationDays: 30,
    strategicBonus: { type: 'match_earnings', value: 30, label: 'Receita por jogo' },
    moraleBoost: 0,
    revenueBoostPerMatch: 0,
    description: 'Melhorias na infraestrutura do estádio. Aumenta receita por jogo em 30%.',
  },
] as const;

/** The ids the route sells, in catalogue order. */
export const INVESTMENT_PRODUCT_IDS = INVESTMENT_PRODUCTS.map((p) => p.id);

/** The catalogue entry for `id`, or undefined for a product we do not sell. */
export function getInvestmentProduct(id: string): InvestmentProduct | undefined {
  return INVESTMENT_PRODUCTS.find((product) => product.id === id);
}

/**
 * The three tiers the route used to sell, kept for reading what they wrote.
 *
 * Nothing sells these any more. Rows recorded under them carry their own
 * amount, yield and dates, so the yield cron and the active list go on paying
 * them off the row — this is only here to put a name and an icon on one when
 * it is shown next to a catalogue product. 'A' was the same deal as
 * `clube_torcedores`; 'B' and 'C' were never on any card.
 */
export const LEGACY_INVESTMENT_OPTIONS: Record<string, { name: string; icon: string }> = {
  A: { name: 'Clube de Torcedores', icon: '💰' },
  B: { name: 'Investimento (Opção B)', icon: '💰' },
  C: { name: 'Investimento (Opção C)', icon: '💰' },
};

/**
 * How to label a stored row, whichever era it was bought in.
 *
 * Falls back to the raw stored value rather than inventing one, so a row from
 * some third naming never shows up blank.
 */
export function describeStoredInvestment(option: string): { name: string; icon: string } {
  const product = getInvestmentProduct(option);
  if (product) return { name: product.name, icon: product.icon };
  return LEGACY_INVESTMENT_OPTIONS[option] ?? { name: option, icon: '💰' };
}
