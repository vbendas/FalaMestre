# Socios.com Manager - Game Mechanics & Stats
## Comprehensive Technical Specification

**Version:** 1.0  
**Date:** October 29, 2025  
**Purpose:** Detailed documentation of all game mechanics, formulas, and statistical systems

---

## Table of Contents

1. [Executive Summary (Stakeholder Version)](#1-executive-summary-stakeholder-version)
2. [Player Attributes System](#2-player-attributes-system)
3. [Match Simulation Engine](#3-match-simulation-engine)
4. [Formation & Tactics](#4-formation--tactics)
5. [Virtual Fanbase Mechanics](#5-virtual-fanbase-mechanics)
6. [Transfer Market Dynamics](#6-transfer-market-dynamics)
7. [Training & Player Development](#7-training--player-development)
8. [Points & Rewards Economy](#8-points--rewards-economy)
9. [Morale & Fitness Systems](#9-morale--fitness-systems)
10. [PVP Competitive Balance](#10-pvp-competitive-balance)

---

## 1. Executive Summary (Stakeholder Version)

### 1.1 Game Mechanics Overview (Non-Technical)

**What Makes Our Game Unique:**

Socios Manager is a text-based football management game powered by AI that simulates running a real football club. Players make strategic decisions through natural conversation, and the game responds with dramatic, realistic outcomes.

**Core Gameplay Loop:**

```
1. Manage Squad → 2. Make Tactical Decisions → 3. Play Matches → 4. Earn Points
         ↑                                                              ↓
    8. Improve Team ← 7. Develop Players ← 6. Buy/Sell Players ← 5. Use Points
```

**Key Mechanics (Simple Explanation):**

| Mechanic | What It Does | Why It Matters |
|----------|--------------|----------------|
| **Player Ratings** | Each player has a number (60-99) showing how good they are | Higher numbers = better performance in matches |
| **Formations** | How you arrange your 11 players (e.g., 4-3-3) | Different formations work better against different opponents |
| **Virtual Fans** | AI-controlled supporters who react to your decisions | Keep fans happy = better team performance and more money |
| **Match Simulation** | AI generates realistic match stories with goals, drama | Every match feels unique and exciting |
| **Socios Points** | In-game currency earned by winning and achieving goals | Spend points to improve team or save for real fan token rewards |
| **Morale** | How happy your players and fans are | Happy team = plays better, unhappy = plays worse |

**How Balance Works:**

- **70% Skill, 30% Randomness:** Good management usually wins, but surprises happen (like real football)
- **Strategic Depth:** Multiple paths to success (attacking style, defensive, balanced)
- **Fair Progression:** Free players can compete; premium just accelerates progress
- **PVP Fairness:** Players matched by skill level and team strength

**What Players Love:**

1. **Accessible:** Just type what you want to do (no complex menus)
2. **Quick Sessions:** Play a match in 2-3 minutes
3. **Strategic Depth:** Master tactics to dominate opponents
4. **Real Rewards:** Earn actual fan tokens through gameplay
5. **Always Fresh:** AI ensures no two matches feel the same

---

### 1.2 Statistical Balance Summary

**Average Game Session:**
- Duration: 15-20 minutes
- Matches played: 2-3
- Decisions made: 5-8
- Points earned: 100-200

**Typical Player Progression:**
- Week 1: Learn basics, win ~60% of matches
- Week 2-4: Develop strategy, win ~65-70%
- Month 2+: Mastery, win 70-75% (PvE)

**Economy Balance:**
- Time to first fan token voucher: 15-20 hours of gameplay
- Free vs Premium advantage: ~30% faster progression (not pay-to-win)
- Points inflation controlled: Rewards scale with difficulty

---

## 2. Player Attributes System

### 2.1 Core Attributes (Technical Specification)

Every player has **6 core attributes** rated from **60-99**:

```typescript
interface PlayerAttributes {
  pac: number;  // Pace (Speed, Acceleration)
  sho: number;  // Shooting (Finishing, Power, Accuracy)
  pas: number;  // Passing (Vision, Short/Long Pass)
  dri: number;  // Dribbling (Ball Control, Agility)
  def: number;  // Defending (Tackling, Positioning, Marking)
  phy: number;  // Physical (Strength, Stamina, Jumping)
}
```

**Rating Scale:**

| Range | Description | Example |
|-------|-------------|---------|
| 60-69 | Poor / Below Average | Bench player in Serie B |
| 70-74 | Average | Regular starter in Serie B |
| 75-79 | Good | Average Brasileirão starter |
| 80-84 | Very Good | Top Brasileirão player |
| 85-89 | Excellent | Elite Brazilian player |
| 90-94 | World Class | International star |
| 95-99 | Legendary | Pelé, Neymar, Ronaldo level |

### 2.2 Overall Rating Calculation

**Position-Weighted Formula:**

```typescript
function calculateOverall(player: Player): number {
  const weights = POSITION_WEIGHTS[player.position];
  
  const overall = (
    player.pac * weights.pac +
    player.sho * weights.sho +
    player.pas * weights.pas +
    player.dri * weights.dri +
    player.def * weights.def +
    player.phy * weights.phy
  ) / 100;
  
  return Math.round(overall);
}

const POSITION_WEIGHTS = {
  GK: {
    pac: 5, sho: 0, pas: 10, dri: 5, def: 65, phy: 15
  },
  DEF: {
    pac: 15, sho: 5, pas: 10, dri: 10, def: 45, phy: 15
  },
  MID: {
    pac: 15, sho: 10, pas: 30, dri: 20, def: 10, phy: 15
  },
  FWD: {
    pac: 25, sho: 35, pas: 10, dri: 20, def: 0, phy: 10
  }
};
```

**Example Calculation (Forward):**

```
Player: Gabigol (Flamengo)
- PAC: 88 → 88 × 0.25 = 22.0
- SHO: 91 → 91 × 0.35 = 31.85
- PAS: 78 → 78 × 0.10 = 7.8
- DRI: 85 → 85 × 0.20 = 17.0
- DEF: 35 → 35 × 0.00 = 0.0
- PHY: 81 → 81 × 0.10 = 8.1

Overall = 22.0 + 31.85 + 7.8 + 17.0 + 0.0 + 8.1 = 86.75 → 87
```

### 2.3 Hidden Attributes

**Not visible to players but affect gameplay:**

```typescript
interface HiddenAttributes {
  potential: number;        // 60-99 (max rating player can reach)
  consistency: number;      // 0-100 (performance variance)
  injury_prone: number;     // 0-100 (injury risk)
  big_match_player: number; // 0-100 (performance in important games)
  leadership: number;       // 0-100 (team morale influence)
  work_rate: number;        // 0-100 (defensive contribution)
  weak_foot: number;        // 1-5 stars (ability on non-dominant foot)
  skill_moves: number;      // 1-5 stars (dribbling variety)
}
```

**How They Work:**

1. **Potential:** Young players can improve to this rating
   - Formula: `potential = base_overall + (20 - age) + random(0, 10)`
   - Example: 21-year-old 75-rated player could reach 85-90

2. **Consistency:** Match-to-match performance variance
   - Formula: `actual_rating = base_rating ± (10 - consistency/10)`
   - 90 consistency = very stable (87-93 range)
   - 50 consistency = unpredictable (82-88 range)

3. **Big Match Player:** Bonus in important games
   - Formula: `rating_boost = big_match_player / 20` (0-5 points)
   - Finals, derbies, title deciders get this boost

4. **Leadership:** Affects team morale
   - Formula: `team_morale_bonus = leader_leadership / 20` (0-5%)
   - Captain with 90 leadership = +4.5% team morale

### 2.4 Dynamic Attributes (Change During Season)

```typescript
interface DynamicAttributes {
  morale: number;      // 0-100 (current happiness)
  fitness: number;     // 0-100 (current stamina)
  form: number;        // 0-100 (recent performance)
  sharpness: number;   // 0-100 (match readiness)
}
```

**How They Affect Performance:**

```typescript
function getEffectiveRating(player: Player): number {
  const baseRating = player.overall;
  
  // Morale modifier: -15% to +15%
  const moraleModifier = (player.morale - 50) * 0.003;
  
  // Fitness modifier: -20% to 0%
  const fitnessModifier = (player.fitness - 100) * 0.002;
  
  // Form modifier: -10% to +10%
  const formModifier = (player.form - 50) * 0.002;
  
  const effectiveRating = baseRating * 
    (1 + moraleModifier + fitnessModifier + formModifier);
  
  return Math.round(Math.max(60, Math.min(99, effectiveRating)));
}
```

**Example:**

```
Base Rating: 85
Morale: 70 (+20 above neutral) → +6% modifier
Fitness: 90 (-10 below full) → -2% modifier
Form: 80 (+30 above neutral) → +6% modifier

Effective Rating = 85 × (1 + 0.06 - 0.02 + 0.06) = 85 × 1.10 = 93.5 → 94
```

---

## 3. Match Simulation Engine

### 3.1 Team Strength Calculation

**Step 1: Calculate Position Group Averages**

```typescript
function calculateTeamStrength(team: Team): TeamStrength {
  const lineup = team.startingXI;
  
  // Attackers (FWD)
  const attackers = lineup.filter(p => p.position === 'FWD');
  const attackRating = average(attackers.map(p => 
    (p.sho * 0.5 + p.pac * 0.3 + p.dri * 0.2) * 
    getMoraleMultiplier(p) * 
    getFitnessMultiplier(p)
  ));
  
  // Midfielders (MID)
  const midfielders = lineup.filter(p => p.position === 'MID');
  const midfieldRating = average(midfielders.map(p =>
    (p.pas * 0.4 + p.dri * 0.3 + p.phy * 0.3) *
    getMoraleMultiplier(p) *
    getFitnessMultiplier(p)
  ));
  
  // Defenders (DEF)
  const defenders = lineup.filter(p => p.position === 'DEF');
  const defenseRating = average(defenders.map(p =>
    (p.def * 0.5 + p.phy * 0.3 + p.pac * 0.2) *
    getMoraleMultiplier(p) *
    getFitnessMultiplier(p)
  ));
  
  // Goalkeeper (GK)
  const goalkeeper = lineup.find(p => p.position === 'GK');
  const gkRating = goalkeeper.def * 
    getMoraleMultiplier(goalkeeper) * 
    getFitnessMultiplier(goalkeeper);
  
  return {
    attack: attackRating,
    midfield: midfieldRating,
    defense: (defenseRating + gkRating) / 2,
    overall: (attackRating + midfieldRating + defenseRating + gkRating) / 4
  };
}

function getMoraleMultiplier(player: Player): number {
  return 0.85 + (player.morale / 100) * 0.30; // 0.85 to 1.15
}

function getFitnessMultiplier(player: Player): number {
  return 0.80 + (player.fitness / 100) * 0.20; // 0.80 to 1.00
}
```

### 3.2 Match Outcome Calculation

**Step 2: Apply Tactical Modifiers**

```typescript
interface TacticalSetup {
  formation: Formation;
  mentality: 'defensive' | 'balanced' | 'attacking';
  pressing: 'low' | 'medium' | 'high';
  width: 'narrow' | 'standard' | 'wide';
}

function applyTacticalModifiers(
  strength: TeamStrength, 
  tactics: TacticalSetup
): ModifiedStrength {
  let { attack, midfield, defense } = strength;
  
  // Mentality modifiers
  if (tactics.mentality === 'attacking') {
    attack *= 1.15;
    defense *= 0.90;
  } else if (tactics.mentality === 'defensive') {
    attack *= 0.90;
    defense *= 1.15;
  }
  
  // Pressing modifiers
  if (tactics.pressing === 'high') {
    midfield *= 1.10;
    defense *= 0.95; // Risk of being caught out
  }
  
  // Formation modifiers (example: 4-3-3)
  const formationMods = FORMATION_MODIFIERS[tactics.formation];
  attack *= formationMods.attack;
  midfield *= formationMods.midfield;
  defense *= formationMods.defense;
  
  return { attack, midfield, defense };
}

const FORMATION_MODIFIERS = {
  '4-3-3': { attack: 1.10, midfield: 1.00, defense: 0.95 },
  '4-4-2': { attack: 1.00, midfield: 1.05, defense: 1.00 },
  '3-5-2': { attack: 0.95, midfield: 1.15, defense: 0.95 },
  '5-3-2': { attack: 0.85, midfield: 0.95, defense: 1.20 },
  '4-2-3-1': { attack: 1.05, midfield: 1.10, defense: 1.00 }
};
```

**Step 3: Calculate Goal Probabilities**

```typescript
function calculateGoalProbability(
  team: ModifiedStrength,
  opponent: ModifiedStrength,
  isHome: boolean
): number {
  // Home advantage
  const homeBonus = isHome ? 1.10 : 1.00;
  
  // Attack vs Defense ratio
  const attackPower = team.attack * homeBonus;
  const defensePower = opponent.defense;
  
  // Base probability using ratio
  const ratio = attackPower / defensePower;
  
  // Convert to expected goals (logarithmic scale)
  const xG = Math.log(ratio + 1) * 1.3; // 0.0 to ~3.5 goals
  
  return Math.max(0, xG);
}
```

**Step 4: Generate Score (Poisson Distribution)**

```typescript
function generateScore(xG: number): number {
  // Simplified Poisson: use xG as lambda parameter
  let score = 0;
  let probability = Math.exp(-xG); // P(0)
  let cumulative = probability;
  const random = Math.random();
  
  // Generate score based on Poisson distribution
  while (cumulative < random && score < 8) {
    score++;
    probability *= xG / score;
    cumulative += probability;
  }
  
  // Add variance (±20% randomness)
  const variance = Math.random() * 0.4 - 0.2; // -0.2 to +0.2
  score = Math.round(score * (1 + variance));
  
  return Math.max(0, Math.min(7, score)); // Cap at 0-7 goals
}
```

### 3.3 Match Events Generation

**Step 5: Create Match Narrative**

```typescript
function generateMatchEvents(
  homeTeam: Team,
  awayTeam: Team,
  homeScore: number,
  awayScore: number
): MatchEvent[] {
  const events: MatchEvent[] = [];
  
  // Generate goals
  for (let i = 0; i < homeScore; i++) {
    events.push(generateGoalEvent(homeTeam, 'home'));
  }
  for (let i = 0; i < awayScore; i++) {
    events.push(generateGoalEvent(awayTeam, 'away'));
  }
  
  // Generate other events (probability-based)
  if (Math.random() < 0.30) events.push(generateCardEvent());
  if (Math.random() < 0.15) events.push(generateInjuryEvent());
  if (Math.random() < 0.25) events.push(generateNearMissEvent());
  
  // Sort by minute
  return events.sort((a, b) => a.minute - b.minute);
}

function generateGoalEvent(team: Team, side: 'home' | 'away'): GoalEvent {
  // Weight scorers by shooting attribute
  const attackers = team.startingXI.filter(p => 
    p.position === 'FWD' || p.position === 'MID'
  );
  const shooter = weightedRandom(attackers, p => p.sho);
  
  // Assist probability
  const hasAssist = Math.random() < 0.70;
  const assister = hasAssist ? 
    weightedRandom(attackers.filter(p => p !== shooter), p => p.pas) : 
    null;
  
  const minute = Math.floor(Math.random() * 90) + 1;
  
  return {
    type: 'goal',
    minute,
    team: side,
    player: shooter,
    assister,
    description: generateGoalDescription(shooter, assister, minute)
  };
}

function generateGoalDescription(
  scorer: Player, 
  assister: Player | null, 
  minute: number
): string {
  const templates = [
    `${scorer.name} receives the ball, turns, and fires into the bottom corner!`,
    `Brilliant finish from ${scorer.name}! The goalkeeper had no chance!`,
    `${scorer.name} with a powerful strike from outside the box! GOLAÇO!`,
    `Quick counter-attack! ${assister?.name || 'A teammate'} finds ${scorer.name}, who slots it home!`,
    `Header! ${scorer.name} rises above the defense and nods it in!`
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}
```

### 3.4 Randomness & Fairness Balance

**Controlled Randomness:**

```typescript
const RANDOMNESS_CONFIG = {
  // Score variance: ±20% from expected
  score_variance: 0.20,
  
  // Event probabilities
  yellow_card: 0.30,      // 30% chance per match
  red_card: 0.05,         // 5% chance per match
  injury: 0.15,           // 15% chance per match
  penalty: 0.10,          // 10% chance per match
  
  // Upset probability (weaker team wins)
  upset_chance: 0.15,     // 15% if 10+ rating difference
  
  // Consistency impact
  player_variance: 0.10   // ±10% from expected performance
};
```

**Fair Play Guarantees:**

1. **No scripting:** Outcomes determined by stats, not predetermined
2. **Transparent math:** Post-match shows exactly why result happened
3. **Skill rewarded:** Better teams win 70-85% of the time
4. **Comebacks possible:** Trailing teams get slight momentum boost
5. **No pay-to-win:** Premium accelerates but doesn't guarantee wins

---

## 4. Formation & Tactics

### 4.1 Available Formations

**Standard Formations:**

```typescript
const FORMATIONS = {
  '4-4-2': {
    name: 'Four-Four-Two (Classic)',
    positions: {
      GK: 1, DEF: 4, MID: 4, FWD: 2
    },
    style: 'balanced',
    strengths: ['Solid structure', 'Easy to understand', 'Balanced attack/defense'],
    weaknesses: ['Can be outnumbered in midfield'],
    modifiers: {
      attack: 1.00,
      midfield: 1.05,
      defense: 1.00,
      width: 'standard'
    }
  },
  
  '4-3-3': {
    name: 'Four-Three-Three (Attacking)',
    positions: {
      GK: 1, DEF: 4, MID: 3, FWD: 3
    },
    style: 'attacking',
    strengths: ['High press', 'Wide play', 'Overload attack'],
    weaknesses: ['Vulnerable to counters', 'Midfield can be overrun'],
    modifiers: {
      attack: 1.10,
      midfield: 1.00,
      defense: 0.95,
      width: 'wide'
    }
  },
  
  '3-5-2': {
    name: 'Three-Five-Two (Possession)',
    positions: {
      GK: 1, DEF: 3, MID: 5, FWD: 2
    },
    style: 'possession',
    strengths: ['Midfield dominance', 'Control tempo', 'Flexible width'],
    weaknesses: ['Weak to wingers', 'Requires technical midfielders'],
    modifiers: {
      attack: 0.95,
      midfield: 1.15,
      defense: 0.95,
      width: 'flexible'
    }
  },
  
  '5-3-2': {
    name: 'Five-Three-Two (Defensive)',
    positions: {
      GK: 1, DEF: 5, MID: 3, FWD: 2
    },
    style: 'defensive',
    strengths: ['Solid defense', 'Counter-attacking', 'Hard to break down'],
    weaknesses: ['Limited attacking', 'Can be pinned back'],
    modifiers: {
      attack: 0.85,
      midfield: 0.95,
      defense: 1.20,
      width: 'narrow'
    }
  },
  
  '4-2-3-1': {
    name: 'Four-Two-Three-One (Modern)',
    positions: {
      GK: 1, DEF: 4, MID: 5, FWD: 1
    },
    style: 'flexible',
    strengths: ['Versatile', 'Defensive stability', 'Creative freedom'],
    weaknesses: ['Lone striker isolated', 'Requires quality attacking mids'],
    modifiers: {
      attack: 1.05,
      midfield: 1.10,
      defense: 1.00,
      width: 'standard'
    }
  }
};
```

### 4.2 Tactical Matchups

**Counter System:**

```typescript
const TACTICAL_ADVANTAGES = {
  '4-3-3': {
    strong_vs: ['4-4-2', '5-3-2'],      // Wide play beats narrow
    weak_vs: ['3-5-2', '4-2-3-1'],      // Outnumbered in midfield
    neutral_vs: ['4-3-3']
  },
  
  '3-5-2': {
    strong_vs: ['4-3-3', '4-4-2'],      // Midfield dominance
    weak_vs: ['4-3-3 (wide)', '5-3-2'], // Exposed on wings or locked down
    neutral_vs: ['3-5-2']
  },
  
  '5-3-2': {
    strong_vs: ['4-3-3', '4-4-2'],      // Defensive solidity
    weak_vs: ['4-2-3-1', '3-5-2'],      // Lack of creativity
    neutral_vs: ['5-3-2']
  }
};

function calculateTacticalAdvantage(
  formation1: string, 
  formation2: string
): number {
  const matchup = TACTICAL_ADVANTAGES[formation1];
  
  if (matchup.strong_vs.includes(formation2)) {
    return 1.05; // +5% advantage
  } else if (matchup.weak_vs.includes(formation2)) {
    return 0.95; // -5% disadvantage
  } else {
    return 1.00; // Neutral
  }
}
```

### 4.3 In-Match Tactical Changes

**Dynamic Adjustments:**

```typescript
interface TacticalChange {
  minute: number;
  type: 'formation' | 'mentality' | 'pressing' | 'substitution';
  description: string;
  impact: number; // Modifier to team strength
}

// Example: Trailing team becomes more attacking
function applyTrailingBonus(team: Team, scoreDiff: number): number {
  if (scoreDiff < 0) { // Team is losing
    const desperation = Math.min(Math.abs(scoreDiff), 2) * 0.05;
    return 1 + desperation; // Up to +10% when 2+ goals down
  }
  return 1.0;
}

// Example: Winning team becomes more defensive
function applyWinningConservative(team: Team, scoreDiff: number, minute: number): number {
  if (scoreDiff > 0 && minute > 75) { // Winning and late in game
    const conservatism = Math.min(scoreDiff, 2) * 0.05;
    // Attack reduced, defense increased
    return {
      attack: 1 - conservatism,
      defense: 1 + conservatism
    };
  }
  return { attack: 1.0, defense: 1.0 };
}
```

### 4.4 Tactical Instructions

During each decision turn, the player can choose a **tactical instruction** that temporarily modifies their team's stats and affects the match simulation outcome for the upcoming 15-minute segment.

#### 4.4.1 Available Instructions

| Instruction | Icon | Description (PT-BR) | Stat Modifiers | Team × | Opponent × | Risk |
|---|---|---|---|---|---|---|
| **Pressão alta** | 🔥 | Pressão alta — recupera a bola rápido, mas gasta energia | phy+5, def+3 | 1.05 | 0.93 | 0.30 |
| **Bloco baixo** | 🚌 | Bloco baixo — máxima proteção defensiva | def+10, phy+5 | 0.95 | 0.85 | 0.05 |
| **Tique-taque** | ⚽ | Tique-taque — controle o ritmo do jogo com passes curtos | pas+10, dri+5 | 1.04 | 1.00 | 0.15 |
| **Contra-ataque** | ⚡ | Contra-ataque rápido — velocidade e oportunismo | pac+10, sho+5 | 1.02 | 1.00 | 0.40 |
| **Bolas longas** | 📏 | Bolas longas — jogo direto e físico | phy+8, sho+3 | 1.00 | 1.00 | 0.20 |
| **Jogo pelas laterais** | 🏃 | Jogo pelas laterais — cruzamentos e velocidade | pac+8, dri+5 | 1.03 | 1.00 | 0.25 |
| **Finalizar** | 💥 | Finalizar de qualquer posição — mais chutes, menos precisão | sho+10, pas+3 | 1.02 | 1.00 | 0.35 |
| **Cera** | ⏰ | Cera — segurar o resultado consumindo tempo | pas+5, dri+3 | 0.92 | 0.95 | 0.00 |
| **Jogo no pivô** | 🎯 | Jogo no pivô — bola no atacante e tabelas | phy+8, sho+5 | 1.02 | 1.00 | 0.20 |
| **Liberdade total** | 🌟 | Liberdade total — criatividade e imprevisibilidade | dri+8, pac+5, sho+3 | 1.03 | 1.00 | 0.30 |
| **Marcação individual** | 👤 | Marcação individual — neutralizar o principal atacante rival | def+8, phy+5 | 0.98 | 0.90 | 0.10 |
| **Sobreposição** | ↗️ | Sobreposição — laterais avançando no ataque | pac+6, pas+6 | 1.04 | 1.00 | 0.35 |

**Column legend:**
- **Stat Modifiers**: Temporary additive changes applied to all players' attributes during the segment
- **Team ×**: Multiplier applied to your team's final power value (1.00 = no change)
- **Opponent ×**: Multiplier applied to the opponent's final power value (< 1.00 = reduces their effectiveness)
- **Risk**: Factor that increases both teams' goal probability during the segment (higher = more goals, more exciting)

#### 4.4.2 How Instructions Affect Simulation

When a player selects a tactical instruction, the following steps occur in `simulateMatchSegment()`:

```
1. Apply stat modifiers to a COPY of the squad (original unchanged)
   └─ e.g., high_press → every player gets +5 PHY, +3 DEF

2. Recalculate team power using modified squad
   └─ calculateTeamPower(modifiedSquad, formation, morale, fitness)

3. Apply team power multiplier
   └─ adjustedHomePower *= teamPowerMultiplier

4. Apply opponent power multiplier
   └─ adjustedAwayPower *= opponentPowerMultiplier

5. Calculate base goal probability
   └─ homeGoalProb = (homePower / (homePower + awayPower)) * 0.4 + 0.1

6. Apply mentality modifier (if set)
   └─ homeGoalProb *= MENTALITY_MODIFIERS[mentality].homeGoalMultiplier

7. Apply risk factor
   └─ homeGoalProb *= (1 + riskFactor)
   └─ awayGoalProb *= (1 + riskFactor * 0.5)
```

#### 4.4.3 Strategic Trade-offs

Each instruction creates a meaningful trade-off:

| Risk Level | Instructions | Trade-off |
|---|---|---|
| **Low risk** (0.00-0.10) | Cera, Bloco baixo, Marcação individual | Defensive stability, fewer goals, safer |
| **Medium risk** (0.15-0.25) | Tique-taque, Bolas longas, Jogo no pivô, Jogo pelas laterais | Balanced approach with tactical advantage |
| **High risk** (0.30-0.40) | Pressão alta, Contra-ataque, Finalizar, Liberdade total, Sobreposição | More goals for both sides, high reward/high danger |

**Example scenario:**
- Your team is losing 0-1 at 60'. You select **Pressão alta** (+5 PHY, +3 DEF, team ×1.05, opponent ×0.93, risk 0.30)
- Your team power increases by 5%, opponent decreases by 7%
- Both teams' goal probability increases by 30% — you're more likely to score, but also more likely to concede
- If you'd selected **Contra-ataque** instead (pac+10, sho+5, risk 0.40), even more goals for both sides

#### 4.4.4 Contextual Availability

The tactical instructions shown depend on the match state:

| Match State | Available Instructions |
|---|---|
| **Losing** (score ≤ -1) | Pressão alta, Contra-ataque, Finalizar, Bolas longas, Jogo no pivô |
| **Winning** (score ≥ +1) | Bloco baixo, Cera, Marcação individual, Tique-taque, Contra-ataque |
| **Tied** (score = 0) | Tique-taque, Jogo pelas laterais, Liberdade total, Pressão alta, Sobreposição, Contra-ataque |

---

## 5. Virtual Fanbase Mechanics

### 5.1 Fan Faction System

**Faction Definitions:**

```typescript
interface FanFaction {
  name: string;
  percentage: number;        // Base % of total fanbase
  priorities: string[];      // What they care about
  volatility: number;        // 0-100 (how quickly mood changes)
  influence: number;         // 0-100 (weight in decisions)
}

const FAN_FACTIONS = {
  traditionalists: {
    name: 'Traditionalists',
    percentage: 30,
    priorities: ['club_history', 'classic_kits', 'local_players', 'conservative_spending'],
    volatility: 40,   // Slow to change
    influence: 80     // Strong voice
  },
  
  modernists: {
    name: 'Modernists',
    percentage: 25,
    priorities: ['innovation', 'star_signings', 'modern_tactics', 'global_brand'],
    volatility: 60,   // Moderate change
    influence: 70     // Moderate voice
  },
  
  ultras: {
    name: 'Ultras',
    percentage: 20,
    priorities: ['passion', 'attacking_football', 'loyalty', 'derby_wins'],
    volatility: 90,   // Extremely reactive
    influence: 85     // Very loud voice
  },
  
  casuals: {
    name: 'Casuals',
    percentage: 25,
    priorities: ['winning', 'entertainment', 'star_players', 'social_media'],
    volatility: 70,   // Fairly reactive
    influence: 50     // Quieter voice
  }
};
```

### 5.2 Fan Sentiment Calculation

**Dynamic Mood Engine:**

```typescript
class FanSentimentEngine {
  calculateFactionMood(
    faction: FanFaction,
    recentEvents: GameEvent[],
    clubState: ClubState
  ): FactionMood {
    let mood = 50; // Neutral baseline
    
    // Recent results (last 5 matches)
    const recentResults = clubState.lastFiveResults;
    const wins = recentResults.filter(r => r === 'W').length;
    mood += (wins - 2.5) * 10; // ±25 points based on form
    
    // Faction-specific concerns
    if (faction.name === 'Traditionalists') {
      // Care about club identity
      if (clubState.localPlayersPercent < 0.30) mood -= 15;
      if (clubState.kitStyle === 'classic') mood += 10;
    }
    
    if (faction.name === 'Ultras') {
      // Care about passion and rivalries
      if (clubState.lastDerbyResult === 'W') mood += 20;
      if (clubState.attackingStyle) mood += 10;
      if (clubState.attendanceAvg > 80) mood += 5;
    }
    
    if (faction.name === 'Modernists') {
      // Care about innovation and stars
      if (clubState.starSigningRecent) mood += 15;
      if (clubState.stadiumModern) mood += 10;
    }
    
    if (faction.name === 'Casuals') {
      // Care about winning and entertainment
      if (clubState.leaguePosition <= 6) mood += 15;
      if (clubState.socialMediaBuzz > 70) mood += 10;
    }
    
    // Apply volatility (some factions more stable)
    const stability = 100 - faction.volatility;
    mood = (mood * faction.volatility + 50 * stability) / 100;
    
    return {
      faction: faction.name,
      mood: Math.max(0, Math.min(100, mood)),
      trending: this.calculateTrend(mood, faction.previousMood)
    };
  }
  
  calculateOverallFanMood(factionMoods: FactionMood[]): number {
    // Weighted average by faction influence
    let totalMood = 0;
    let totalInfluence = 0;
    
    for (const factionMood of factionMoods) {
      const faction = FAN_FACTIONS[factionMood.faction];
      totalMood += factionMood.mood * faction.influence;
      totalInfluence += faction.influence;
    }
    
    return totalMood / totalInfluence;
  }
}
```

### 5.3 Fan-Driven Decision Voting

**Kit Vote Mechanism:**

```typescript
interface KitVote {
  option1: KitDesign;
  option2: KitDesign;
  option3: KitDesign;
}

function simulateKitVote(
  options: KitVote,
  factionMoods: FactionMood[],
  playerCampaign?: { option: number, pointsSpent: number }
): VoteResult {
  const votes = { option1: 0, option2: 0, option3: 0 };
  
  // Each faction votes based on preferences
  for (const faction of Object.values(FAN_FACTIONS)) {
    const factionMood = factionMoods.find(m => m.faction === faction.name);
    const factionVotes = faction.percentage; // % of total votes
    
    // Calculate preference scores
    const scores = {
      option1: scoreKitForFaction(options.option1, faction),
      option2: scoreKitForFaction(options.option2, faction),
      option3: scoreKitForFaction(options.option3, faction)
    };
    
    // Add randomness (events, media influence)
    Object.keys(scores).forEach(key => {
      scores[key] *= (0.8 + Math.random() * 0.4); // ±20% variance
    });
    
    // Distribute faction votes proportionally
    const total = scores.option1 + scores.option2 + scores.option3;
    votes.option1 += (scores.option1 / total) * factionVotes;
    votes.option2 += (scores.option2 / total) * factionVotes;
    votes.option3 += (scores.option3 / total) * factionVotes;
  }
  
  // Apply player campaign influence
  if (playerCampaign) {
    const campaignBoost = Math.min(playerCampaign.pointsSpent / 100, 15); // Max +15%
    votes[`option${playerCampaign.option}`] += campaignBoost;
  }
  
  // Normalize to 100%
  const totalVotes = votes.option1 + votes.option2 + votes.option3;
  const results = {
    option1: (votes.option1 / totalVotes) * 100,
    option2: (votes.option2 / totalVotes) * 100,
    option3: (votes.option3 / totalVotes) * 100
  };
  
  const winner = Object.keys(results).reduce((a, b) => 
    results[a] > results[b] ? a : b
  );
  
  return {
    winner,
    percentages: results,
    fanReaction: generateFanReaction(winner, results, playerCampaign)
  };
}

function scoreKitForFaction(kit: KitDesign, faction: FanFaction): number {
  let score = 50; // Baseline
  
  if (faction.name === 'Traditionalists') {
    if (kit.style === 'classic') score += 30;
    if (kit.colors === faction.clubTraditionalColors) score += 20;
  }
  
  if (faction.name === 'Modernists') {
    if (kit.style === 'modern') score += 30;
    if (kit.innovative) score += 20;
  }
  
  if (faction.name === 'Ultras') {
    if (kit.bold) score += 25;
    if (kit.representsIdentity) score += 25;
  }
  
  if (faction.name === 'Casuals') {
    if (kit.trendy) score += 20;
    if (kit.socialMediaAppeal) score += 20;
  }
  
  return score;
}
```

### 5.4 Fan Mood Impact on Gameplay

**Performance Modifiers:**

```typescript
function getFanMoodModifier(fanMood: number, isHome: boolean): GameplayModifier {
  if (!isHome) return { performance: 1.0, revenue: 1.0 };
  
  // Performance impact (morale affects players)
  const performanceModifier = 0.90 + (fanMood / 100) * 0.20; // 0.90 to 1.10
  
  // Revenue impact (attendance)
  const revenueModifier = 0.70 + (fanMood / 100) * 0.60; // 0.70 to 1.30
  
  // Dramatic effects at extremes
  if (fanMood >= 90) {
    return {
      performance: 1.15,  // Euphoric fans = +15% performance
      revenue: 1.40,      // Sellout crowds
      description: '🔥 The fans are creating an incredible atmosphere! The team feeds off this energy!'
    };
  } else if (fanMood <= 20) {
    return {
      performance: 0.85,  // Hostile fans = -15% performance
      revenue: 0.60,      // Empty seats
      description: '😠 Boos and whistles from the crowd. The players look nervous.'
    };
  }
  
  return { performance: performanceModifier, revenue: revenueModifier };
}
```

---

## 6. Transfer Market Dynamics

### 6.1 Player Valuation Formula

```typescript
function calculatePlayerValue(player: Player, context: MarketContext): number {
  // Base value from overall rating (exponential curve)
  const baseValue = Math.pow(player.overall, 2.5) * 10000;
  // Example: 85 overall = 85^2.5 × 10000 ≈ R$12.5M
  
  // Age modifier (peak value 24-28)
  let ageModifier = 1.0;
  if (player.age < 24) {
    ageModifier = 0.8 + (player.age / 24) * 0.6; // 0.8 to 1.4 (young talent premium)
  } else if (player.age >= 30) {
    const yearsOver = player.age - 29;
    ageModifier = Math.max(0.3, 1.0 - (yearsOver * 0.15)); // Depreciates 15% per year
  }
  
  // Form modifier (recent performance)
  const formModifier = 0.7 + (player.form / 100) * 0.6; // 0.7 to 1.3
  
  // Potential modifier (for young players)
  let potentialBonus = 1.0;
  if (player.age < 24 && player.potential > player.overall + 10) {
    potentialBonus = 1.3 + ((player.potential - player.overall) / 20); // Up to 1.8x
  }
  
  // Contract length modifier
  const contractModifier = 0.6 + (player.contractYearsLeft / 5) * 0.8; // 0.6 to 1.4
  
  // Market hype (media attention)
  const hypeModifier = 0.9 + (context.mediaHype / 100) * 0.4; // 0.9 to 1.3
  
  // Position scarcity (e.g., elite strikers more valuable)
  const positionModifier = POSITION_SCARCITY[player.position];
  
  const finalValue = baseValue * 
    ageModifier * 
    formModifier * 
    potentialBonus * 
    contractModifier * 
    hypeModifier * 
    positionModifier;
  
  return Math.round(finalValue / 100000) * 100000; // Round to nearest 100K
}

const POSITION_SCARCITY = {
  GK: 0.85,   // Keepers less valuable
  DEF: 0.95,  // Defenders moderate
  MID: 1.05,  // Midfielders in demand
  FWD: 1.15   // Strikers premium
};
```

### 6.2 AI Negotiation Logic

```typescript
class TransferNegotiator {
  evaluateOffer(
    player: Player,
    offerAmount: number,
    buyingClub: Club,
    sellingClub: Club
  ): OfferResponse {
    const playerValue = calculatePlayerValue(player, { mediaHype: 50 });
    const offerRatio = offerAmount / playerValue;
    
    // Calculate acceptance probability
    let acceptanceProbability = offerRatio; // Base: offer/value ratio
    
    // Club financial situation
    if (sellingClub.budget < 1000000) {
      acceptanceProbability += 0.15; // Desperate clubs sell cheaper
    }
    if (sellingClub.budget > 50000000) {
      acceptanceProbability -= 0.15; // Rich clubs demand premium
    }
    
    // Player factors
    if (player.morale < 50) {
      acceptanceProbability += 0.15; // Unhappy player wants out
    }
    if (player.isClubLegend) {
      acceptanceProbability -= 0.20; // Legend hard to sell
    }
    if (player.age > 32) {
      acceptanceProbability += 0.10; // Aging player easier
    }
    
    // Buyer reputation
    if (buyingClub.reputation > sellingClub.reputation) {
      acceptanceProbability += 0.10; // Step-up move
    }
    
    // Squad depth
    if (sellingClub.squadDepth[player.position] < 3) {
      acceptanceProbability -= 0.15; // Can't afford to sell
    }
    
    // Rivalry check (never sell to rivals)
    if (buyingClub.isRival(sellingClub)) {
      acceptanceProbability -= 0.50;
    }
    
    // Decide response
    if (acceptanceProbability >= 0.90) {
      return this.acceptOffer(player, offerAmount);
    } else if (acceptanceProbability >= 0.40) {
      const counterAmount = this.calculateCounterOffer(playerValue, offerRatio);
      return this.counterOffer(player, counterAmount, acceptanceProbability);
    } else {
      return this.rejectOffer(player, offerRatio);
    }
  }
  
  private calculateCounterOffer(playerValue: number, offerRatio: number): number {
    // Counter at 90-95% of player value
    const counterRatio = 0.90 + Math.random() * 0.05;
    return Math.round(playerValue * counterRatio / 100000) * 100000;
  }
  
  private generateNegotiationDialogue(
    response: OfferResponse, 
    club: Club
  ): string {
    const personality = club.negotiatorPersonality; // 'tough', 'fair', 'friendly'
    
    if (response.status === 'accepted') {
      const messages = {
        tough: `"Fine. We accept your offer. Don't waste our time with paperwork."`,
        fair: `"That's a fair offer. We have a deal."`,
        friendly: `"Excellent! We're happy to do business with you."`
      };
      return messages[personality];
    }
    
    if (response.status === 'counter') {
      const messages = {
        tough: `"That's insulting. We want R$${(response.counterOffer / 1000000).toFixed(1)}M minimum."`,
        fair: `"We value him higher. How about R$${(response.counterOffer / 1000000).toFixed(1)}M?"`,
        friendly: `"Close, but not quite. Can you do R$${(response.counterOffer / 1000000).toFixed(1)}M?"`
      };
      return messages[personality];
    }
    
    if (response.status === 'rejected') {
      const messages = {
        tough: `"Not interested. Don't insult us with lowball offers."`,
        fair: `"Sorry, that's too far from our valuation."`,
        friendly: `"We appreciate the interest, but that's not enough for us."`
      };
      return messages[personality];
    }
  }
}
```

### 6.3 Transfer Deadline Drama

**Last-Day Mechanics:**

```typescript
interface DeadlineDayEvent {
  hour: number;           // 0-24 (deadline at hour 24)
  urgency: number;        // 0-100 (increases as deadline approaches)
  opportunitiesAvailable: Player[];
}

function generateDeadlineDayOpportunities(
  userClub: Club,
  hour: number
): DeadlineDayEvent {
  const urgency = (hour / 24) * 100;
  
  // More opportunities appear as deadline approaches
  const numOpportunities = Math.floor(1 + (urgency / 25));
  
  // Desperate clubs offer bargains
  const opportunities = [];
  for (let i = 0; i < numOpportunities; i++) {
    const player = generateRandomPlayer({ quality: 'good' });
    const normalValue = calculatePlayerValue(player, { mediaHype: 50 });
    
    // Discount increases with urgency
    const discount = 0.10 + (urgency / 100) * 0.30; // 10% to 40% off
    const deadlinePrice = normalValue * (1 - discount);
    
    opportunities.push({
      player,
      normalValue,
      dealPrice: deadlinePrice,
      urgencyMessage: this.getUrgencyMessage(urgency),
      expiresIn: `${24 - hour} hours`
    });
  }
  
  return { hour, urgency, opportunitiesAvailable: opportunities };
}
```

---

## 7. Training & Player Development

### 7.1 Training System

```typescript
interface TrainingSession {
  type: 'technical' | 'physical' | 'tactical' | 'mental';
  intensity: 'low' | 'medium' | 'high';
  duration: number; // Days
  players: Player[];
  cost: number;
}

const TRAINING_EFFECTS = {
  technical: {
    attributes: ['dri', 'pas', 'sho'],
    improvement: 0.5, // Points per week
    injury_risk: 0.05 // 5% risk
  },
  physical: {
    attributes: ['pac', 'phy'],
    improvement: 0.7,
    injury_risk: 0.10 // 10% risk (more intense)
  },
  tactical: {
    attributes: ['pas', 'def'],
    improvement: 0.4,
    injury_risk: 0.03
  },
  mental: {
    attributes: ['consistency', 'big_match_player'], // Hidden attributes
    improvement: 1.0,
    injury_risk: 0.01
  }
};

function applyTrainingSession(
  player: Player,
  training: TrainingSession
): TrainingResult {
  const effect = TRAINING_EFFECTS[training.type];
  
  // Age factor (young players improve faster)
  let ageFactor = 1.0;
  if (player.age < 24) {
    ageFactor = 1.5; // +50% for youngsters
  } else if (player.age > 29) {
    ageFactor = 0.5; // -50% for veterans
  }
  
  // Calculate improvement
  const baseImprovement = effect.improvement * 
    (training.duration / 7) * 
    ageFactor;
  
  // Intensity modifier
  const intensityMultiplier = {
    low: 0.7,
    medium: 1.0,
    high: 1.3
  }[training.intensity];
  
  const totalImprovement = baseImprovement * intensityMultiplier;
  
  // Apply to relevant attributes
  const improvements = {};
  for (const attr of effect.attributes) {
    if (player[attr] < player.potential) { // Can't exceed potential
      const gain = Math.random() * totalImprovement; // Some randomness
      improvements[attr] = Math.min(gain, player.potential - player[attr]);
      player[attr] += improvements[attr];
    }
  }
  
  // Injury risk
  const injuryRoll = Math.random();
  const injuryProbability = effect.injury_risk * intensityMultiplier;
  
  if (injuryRoll < injuryProbability) {
    return {
      improvements,
      injury: {
        severity: 'minor',
        daysOut: Math.floor(Math.random() * 14) + 7 // 7-21 days
      }
    };
  }
  
  return { improvements, injury: null };
}
```

### 7.2 Youth Academy System

```typescript
interface YouthPlayer {
  potential: number;      // 70-95 (hidden from user initially)
  currentRating: number;  // 55-70 (starts low)
  age: number;           // 16-19
  position: Position;
  developmentSpeed: number; // 0-100 (how fast they improve)
}

function generateYouthPlayer(academyLevel: number): YouthPlayer {
  // Better academies produce better prospects
  const potentialBase = 70 + (academyLevel * 2); // Level 1-10 academy
  const potentialVariance = Math.random() * 10 - 5;
  const potential = Math.round(
    Math.max(70, Math.min(95, potentialBase + potentialVariance))
  );
  
  // Starting rating always low
  const currentRating = 55 + Math.floor(Math.random() * 16); // 55-70
  
  return {
    potential,
    currentRating,
    age: 16 + Math.floor(Math.random() * 4), // 16-19
    position: randomPosition(),
    developmentSpeed: 40 + Math.random() * 60, // 40-100
    name: generateBrazilianName()
  };
}

function developYouthPlayer(
  player: YouthPlayer,
  weeks: number
): YouthDevelopment {
  const weeklyImprovement = 
    (player.developmentSpeed / 100) * 
    (player.potential - player.currentRating) / 
    200; // Takes ~200 weeks to reach potential at 100 speed
  
  const totalImprovement = weeklyImprovement * weeks;
  const newRating = Math.min(
    player.currentRating + totalImprovement,
    player.potential
  );
  
  // Breakthrough moment (potential revealed)
  if (newRating >= 70 && player.currentRating < 70) {
    return {
      newRating,
      breakthrough: true,
      message: `🌟 ${player.name} has made a breakthrough! He's showing signs of becoming a ${newRating >= 85 ? 'superstar' : 'top player'}!`
    };
  }
  
  return { newRating, breakthrough: false };
}
```

---

## 8. Points & Rewards Economy

### 8.1 Point Earning Structure

```typescript
const POINT_REWARDS = {
  // Daily activities
  daily_login: 10,
  daily_login_streak_7: 100,
  daily_login_streak_30: 1000,
  
  // Match results (difficulty-based)
  match_win_easy: 50,
  match_win_medium: 75,
  match_win_hard: 100,
  match_win_very_hard: 150,
  match_draw: 25,
  
  // Performance bonuses
  clean_sheet: 25,
  hat_trick: 50,
  comeback_win: 50,     // Win after trailing
  dominant_win: 40,     // Win by 3+ goals
  
  // Streaks
  win_streak_3: 100,
  win_streak_5: 250,
  win_streak_10: 1000,
  unbeaten_run_10: 500,
  
  // Season milestones
  season_complete: 1000,
  top_4_finish: 1500,
  top_half_finish: 1000,
  promotion: 2500,
  league_title: 5000,
  unbeaten_season: 10000,
  
  // Cup competitions
  cup_quarter_final: 300,
  cup_semi_final: 700,
  cup_final: 1500,
  cup_winner: 3000,
  
  // Player development
  youth_graduate_debut: 100,
  youth_to_80_rating: 300,
  player_reach_90_rating: 500,
  
  // Transfer market
  profit_transfer: (profit) => Math.floor(profit / 100000), // 1 point per R$100K profit
  bargain_signing: 150,
  
  // Social
  invite_friend: 100,
  friend_joins_via_referral: 500,
  challenge_friend_win: 50,
  
  // Fan engagement
  fan_mood_euphoric: 200,
  stadium_expansion_complete: 300,
  fan_vote_participation: 20,
  
  // Achievements
  first_season: 500,
  five_seasons: 2000,
  ten_seasons: 5000
};

function calculateMatchPoints(
  result: MatchResult,
  difficulty: Difficulty,
  bonuses: MatchBonus[]
): number {
  let points = 0;
  
  // Base points
  if (result === 'W') {
    points += POINT_REWARDS[`match_win_${difficulty}`];
  } else if (result === 'D') {
    points += POINT_REWARDS.match_draw;
  }
  
  // Bonuses
  for (const bonus of bonuses) {
    points += POINT_REWARDS[bonus] || 0;
  }
  
  // Multipliers for special conditions
  if (result.isRivalMatch) points *= 1.5;
  if (result.isFinalMatch) points *= 2.0;
  
  return Math.round(points);
}
```

### 8.2 Token Conversion Economy

```typescript
const TOKEN_ECONOMY = {
  points_per_voucher: 10000,
  voucher_to_fan_token: 1,
  
  // Average earning rates
  casual_player_points_per_hour: 150,     // ~67 hours to voucher
  regular_player_points_per_hour: 250,    // ~40 hours to voucher
  hardcore_player_points_per_hour: 400,   // ~25 hours to voucher
  
  // Premium boost
  premium_multiplier: 2.0 // Premium earns 2x points
};

function estimateTimeToToken(
  playerType: 'casual' | 'regular' | 'hardcore',
  isPremium: boolean
): string {
  const baseRate = TOKEN_ECONOMY[`${playerType}_player_points_per_hour`];
  const effectiveRate = isPremium ? baseRate * 2 : baseRate;
  const hoursNeeded = TOKEN_ECONOMY.points_per_voucher / effectiveRate;
  
  if (hoursNeeded < 20) {
    return `~${Math.round(hoursNeeded)} hours of gameplay`;
  } else if (hoursNeeded < 168) {
    return `~${Math.round(hoursNeeded / 24)} days of casual play`;
  } else {
    return `~${Math.round(hoursNeeded / 168)} weeks of casual play`;
  }
}

// Example outputs:
// Casual free: ~67 hours = ~10 days of 1hr/day play
// Regular free: ~40 hours = ~6 days of 1hr/day play  
// Hardcore free: ~25 hours = ~4 days of 1hr/day play
// Casual premium: ~33 hours = ~5 days
// Hardcore premium: ~12 hours = ~2 days
```

### 8.3 Anti-Abuse Mechanisms

```typescript
const ANTI_ABUSE = {
  // Daily caps
  daily_max_points: 2000,      // Prevents grinding same match
  daily_max_matches: 50,       // Reasonable play limit
  
  // Cooldowns
  same_opponent_cooldown: 3600, // 1 hour between same matches
  referral_cooldown: 86400,     // 1 day between referrals
  
  // Fraud detection
  suspicious_patterns: [
    'match_win_rate_over_95_percent', // Impossibly high win rate
    'identical_match_results',        // Playing same match repeatedly
    'rapid_account_creation',         // Multiple accounts from same IP
    'immediate_voucher_redemption'    // Bots redeeming instantly
  ],
  
  // Rate limiting
  actions_per_minute: 30,
  points_per_minute_max: 100
};

function checkForAbuse(user: User, action: Action): AbuseCheckResult {
  // Check daily caps
  if (user.todayPoints >= ANTI_ABUSE.daily_max_points) {
    return { allowed: false, reason: 'daily_cap_reached' };
  }
  
  // Check suspicious patterns
  if (user.winRate > 0.95 && user.matchesPlayed > 100) {
    return { allowed: true, flagForReview: true, reason: 'suspicious_win_rate' };
  }
  
  // Check rapid actions
  const actionsLastMinute = user.getActionsInWindow(60);
  if (actionsLastMinute.length > ANTI_ABUSE.actions_per_minute) {
    return { allowed: false, reason: 'rate_limit_exceeded' };
  }
  
  return { allowed: true };
}
```

---

## 9. Morale & Fitness Systems

### 9.1 Player Morale

```typescript
interface MoraleFactors {
  baseLevel: number;          // 0-100 (default 75)
  recentResults: number;      // ±20 from last 5 matches
  playingTime: number;        // ±15 based on minutes played
  teamMood: number;           // ±10 from overall team atmosphere
  contractSituation: number;  // ±15 (contract expiring soon = unhappy)
  relationship: number;       // ±10 (with manager/teammates)
  personalLife: number;       // ±5 (random events)
}

function calculatePlayerMorale(
  player: Player,
  context: GameContext
): number {
  let morale = 75; // Baseline
  
  // Recent team results
  const winPercentage = context.lastFiveResults.filter(r => r === 'W').length / 5;
  morale += (winPercentage - 0.5) * 40; // ±20 points
  
  // Playing time
  const expectedMinutes = player.isStarter ? 360 : 90; // Per 5 matches
  const actualMinutes = player.minutesLastFive;
  const minutesRatio = actualMinutes / expectedMinutes;
  if (minutesRatio < 0.5) {
    morale -= 15; // Unhappy with lack of playing time
  } else if (minutesRatio > 1.2) {
    morale -= 5; // Overplayed and tired
  }
  
  // Team atmosphere (fan mood influences players)
  const teamMoodModifier = (context.fanMood - 50) / 5; // ±10 points
  morale += teamMoodModifier;
  
  // Contract situation
  if (player.contractYearsLeft < 1) {
    morale -= 15; // Worried about future
  }
  if (player.recentContractOffer && !player.recentContractOffer.accepted) {
    morale -= 10; // Rejected offer
  }
  
  // Random personal events
  const randomEvent = Math.random();
  if (randomEvent < 0.05) {
    morale += 10; // Good personal news
  } else if (randomEvent > 0.95) {
    morale -= 10; // Personal issues
  }
  
  // Cap at 0-100
  return Math.max(0, Math.min(100, Math.round(morale)));
}

function getMoraleDescription(morale: number): string {
  if (morale >= 90) return '😄 Euphoric - Playing with incredible confidence';
  if (morale >= 75) return '🙂 Happy - Positive and motivated';
  if (morale >= 60) return '😐 Content - Stable mood';
  if (morale >= 45) return '😕 Concerned - Showing signs of frustration';
  if (morale >= 30) return '😠 Unhappy - Wants changes';
  return '😡 Miserable - Desperate to leave';
}
```

### 9.2 Fitness & Stamina

```typescript
interface FitnessSystem {
  fitness: number;          // 0-100 (current stamina)
  sharpness: number;        // 0-100 (match readiness)
  fatigueRate: number;      // How quickly they tire
  recoveryRate: number;     // How quickly they recover
  injuryRisk: number;       // Current injury probability
}

function simulateMatchFatigue(
  player: Player,
  minutesPlayed: number,
  matchIntensity: number
): FitnessUpdate {
  // Base fatigue
  const baseFatigue = (minutesPlayed / 90) * 15; // 15 points for full match
  
  // Intensity modifier
  const intensityModifier = matchIntensity / 100; // 0-1
  const totalFatigue = baseFatigue * (1 + intensityModifier);
  
  // Age affects recovery
  const ageModifier = player.age < 30 ? 1.0 : 1 + ((player.age - 29) * 0.1);
  const adjustedFatigue = totalFatigue * ageModifier;
  
  // Physical attribute helps
  const physicalBonus = (player.phy - 75) / 100; // ±25% based on PHY stat
  const finalFatigue = adjustedFatigue * (1 - physicalBonus);
  
  const newFitness = Math.max(0, player.fitness - finalFatigue);
  
  // Injury risk increases when unfit
  let injuryRisk = 0.02; // 2% base risk
  if (newFitness < 30) {
    injuryRisk = 0.15; // 15% risk when exhausted
  } else if (newFitness < 60) {
    injuryRisk = 0.05; // 5% risk when tired
  }
  
  return {
    newFitness: Math.round(newFitness),
    fatigueAmount: Math.round(finalFatigue),
    injuryRisk,
    shouldRest: newFitness < 70
  };
}

function recoverFitness(
  player: Player,
  daysRested: number,
  recoveryQuality: 'poor' | 'normal' | 'excellent'
): number {
  const baseRecovery = {
    poor: 8,      // 8 points per day
    normal: 12,   // 12 points per day
    excellent: 18 // 18 points per day (medical staff, facilities)
  }[recoveryQuality];
  
  // Young players recover faster
  const ageFactor = player.age < 30 ? 1.2 : 1.0 - ((player.age - 29) * 0.05);
  
  const totalRecovery = baseRecovery * daysRested * ageFactor;
  const newFitness = Math.min(100, player.fitness + totalRecovery);
  
  return Math.round(newFitness);
}
```

### 9.3 Injury System

```typescript
interface Injury {
  type: 'minor' | 'moderate' | 'serious' | 'critical';
  bodyPart: string;
  daysOut: number;
  recurringRisk: number; // Risk of same injury returning
}

const INJURY_TYPES = {
  minor: {
    daysOut: [3, 14],
    probability: 0.70,
    examples: ['muscle strain', 'bruised foot', 'minor knock']
  },
  moderate: {
    daysOut: [14, 42],
    probability: 0.20,
    examples: ['hamstring tear', 'ankle sprain', 'groin injury']
  },
  serious: {
    daysOut: [42, 90],
    probability: 0.08,
    examples: ['fractured bone', 'ligament damage', 'severe muscle tear']
  },
  critical: {
    daysOut: [90, 270],
    probability: 0.02,
    examples: ['ACL tear', 'major surgery', 'career-threatening']
  }
};

function generateInjury(
  player: Player,
  circumstances: InjuryContext
): Injury {
  // Determine severity
  const roll = Math.random();
  let severity: InjuryType;
  
  if (roll < 0.70) severity = 'minor';
  else if (roll < 0.90) severity = 'moderate';
  else if (roll < 0.98) severity = 'serious';
  else severity = 'critical';
  
  // Adjust based on circumstances
  if (circumstances.overworked) {
    // More likely to be serious when overworked
    if (severity === 'minor' && Math.random() < 0.3) severity = 'moderate';
  }
  
  if (player.injury_prone > 70) {
    // Injury-prone players get worse injuries
    const severityIndex = ['minor', 'moderate', 'serious', 'critical'].indexOf(severity);
    if (Math.random() < 0.3 && severityIndex < 3) {
      severity = ['minor', 'moderate', 'serious', 'critical'][severityIndex + 1];
    }
  }
  
  const injuryType = INJURY_TYPES[severity];
  const daysOut = Math.floor(
    Math.random() * (injuryType.daysOut[1] - injuryType.daysOut[0]) + 
    injuryType.daysOut[0]
  );
  
  return {
    type: severity,
    bodyPart: randomBodyPart(),
    daysOut,
    recurringRisk: severity === 'serious' ? 0.20 : 0.10,
    description: generateInjuryNarrative(player, severity, injuryType.examples)
  };
}
```

---

## 10. PVP Competitive Balance

### 10.1 Matchmaking System

```typescript
interface MatchmakingCriteria {
  teamStrengthRating: number;     // 60-99 (average squad rating)
  managerLevel: number;            // 1-50 (XP-based)
  currentRanking: number;          // ELO rating
  recentForm: number;              // Last 10 PVP results
}

function findPVPOpponent(
  player: User,
  queue: User[]
): MatchmakingResult {
  const playerCriteria = calculateCriteria(player);
  
  // Score each potential opponent
  const scoredOpponents = queue.map(opponent => {
    const opponentCriteria = calculateCriteria(opponent);
    
    // Calculate difference scores (lower = better match)
    const strengthDiff = Math.abs(
      playerCriteria.teamStrengthRating - opponentCriteria.teamStrengthRating
    );
    const levelDiff = Math.abs(
      playerCriteria.managerLevel - opponentCriteria.managerLevel
    );
    const rankingDiff = Math.abs(
      playerCriteria.currentRanking - opponentCriteria.currentRanking
    );
    
    // Weighted score (lower is better)
    const matchScore = 
      strengthDiff * 2.0 +    // Team strength most important
      levelDiff * 1.0 +       // Manager level moderately important
      rankingDiff * 0.5;      // Ranking less important (will even out)
    
    return { opponent, matchScore, criteria: opponentCriteria };
  });
  
  // Sort by best match
  scoredOpponents.sort((a, b) => a.matchScore - b.matchScore);
  
  // Apply constraints
  const validMatches = scoredOpponents.filter(m => {
    const strengthGap = Math.abs(
      playerCriteria.teamStrengthRating - m.criteria.teamStrengthRating
    );
    const levelGap = Math.abs(
      playerCriteria.managerLevel - m.criteria.managerLevel
    );
    
    return (
      strengthGap <= 5 &&     // Max 5 rating points difference
      levelGap <= 10 &&       // Max 10 manager levels difference
      !player.hasPlayedRecently(m.opponent) // No rematches within 1 hour
    );
  });
  
  if (validMatches.length === 0) {
    return { found: false, waitTime: 30 }; // Wait 30 seconds
  }
  
  return { found: true, opponent: validMatches[0].opponent };
}
```

### 10.2 ELO Rating System

```typescript
const ELO_CONSTANTS = {
  K_FACTOR: 32,              // How much rating changes per match
  NEW_PLAYER_K: 50,          // Higher volatility for new players
  MASTER_TIER_K: 24,         // Lower volatility for masters
  DEFAULT_RATING: 1200,
  RATING_FLOORS: {
    bronze: 0,
    silver: 1000,
    gold: 1400,
    platinum: 1800,
    diamond: 2200,
    master: 2600
  }
};

function calculateELOChange(
  playerRating: number,
  opponentRating: number,
  result: 'win' | 'draw' | 'loss',
  matchesPlayed: number
): ELOUpdate {
  // Determine K-factor
  let K = ELO_CONSTANTS.K_FACTOR;
  if (matchesPlayed < 30) {
    K = ELO_CONSTANTS.NEW_PLAYER_K; // New players adjust faster
  } else if (playerRating > 2600) {
    K = ELO_CONSTANTS.MASTER_TIER_K; // Masters more stable
  }
  
  // Expected score calculation
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  
  // Actual score
  const actualScore = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
  
  // Rating change
  const ratingChange = Math.round(K * (actualScore - expectedScore));
  
  const newRating = playerRating + ratingChange;
  const tier = calculateTier(newRating);
  
  return {
    oldRating: playerRating,
    newRating,
    change: ratingChange,
    expectedWinProbability: expectedScore * 100,
    tier
  };
}

function calculateTier(rating: number): string {
  if (rating >= 2600) return 'master';
  if (rating >= 2200) return 'diamond';
  if (rating >= 1800) return 'platinum';
  if (rating >= 1400) return 'gold';
  if (rating >= 1000) return 'silver';
  return 'bronze';
}
```

### 10.3 Seasonal Rewards

```typescript
const SEASONAL_REWARDS = {
  duration_weeks: 4,
  
  rewards_by_tier: {
    master: {
      socios_points: 5000,
      exclusive_badge: 'master_s1',
      fan_token_bonus: 1,
      title: 'Season 1 Master'
    },
    diamond: {
      socios_points: 3000,
      exclusive_badge: 'diamond_s1',
      fan_token_bonus: 0.5,
      title: 'Diamond Manager'
    },
    platinum: {
      socios_points: 2000,
      exclusive_badge: 'platinum_s1',
      special_kit: true
    },
    gold: {
      socios_points: 1000,
      exclusive_badge: 'gold_s1'
    },
    silver: {
      socios_points: 500,
      participation_badge: true
    },
    bronze: {
      socios_points: 250,
      participation_badge: true
    }
  },
  
  top_percentage_rewards: {
    top_1_percent: {
      bonus_points: 10000,
      leaderboard_trophy: 'season_champion'
    },
    top_5_percent: {
      bonus_points: 5000,
      leaderboard_trophy: 'elite_manager'
    },
    top_10_percent: {
      bonus_points: 2500
    }
  }
};

function calculateSeasonEndRewards(
  user: User,
  finalRating: number,
  totalMatches: number
): SeasonRewards {
  const tier = calculateTier(finalRating);
  const baseRewards = SEASONAL_REWARDS.rewards_by_tier[tier];
  
  // Participation requirement
  if (totalMatches < 20) {
    return {
      eligible: false,
      reason: 'Minimum 20 matches required'
    };
  }
  
  // Calculate percentile
  const percentile = calculatePercentile(user, finalRating);
  let bonusRewards = {};
  
  if (percentile <= 1) {
    bonusRewards = SEASONAL_REWARDS.top_percentage_rewards.top_1_percent;
  } else if (percentile <= 5) {
    bonusRewards = SEASONAL_REWARDS.top_percentage_rewards.top_5_percent;
  } else if (percentile <= 10) {
    bonusRewards = SEASONAL_REWARDS.top_percentage_rewards.top_10_percent;
  }
  
  return {
    eligible: true,
    ...baseRewards,
    ...bonusRewards,
    finalRating,
    tier,
    percentile
  };
}
```

---

## Appendix: Quick Reference Tables

### A. Player Rating Benchmarks

| Overall | Quality | Example Players | Transfer Value (R$) |
|---------|---------|----------------|---------------------|
| 60-64 | Poor | Youth prospect | 100K - 500K |
| 65-69 | Below Average | Serie B starter | 500K - 1M |
| 70-74 | Average | Brasileirão squad player | 1M - 3M |
| 75-79 | Good | Brasileirão starter | 3M - 8M |
| 80-84 | Very Good | Top Brasileirão player | 8M - 20M |
| 85-89 | Excellent | Brazilian NT candidate | 20M - 50M |
| 90-94 | World Class | International star | 50M - 100M |
| 95-99 | Legendary | Neymar, Vinicius Jr. | 100M+ |

### B. Formation Cheat Sheet

| Formation | Best For | Counters | Weak Against |
|-----------|----------|----------|--------------|
| 4-3-3 | High press, wing play | 4-4-2, 5-3-2 | 3-5-2, 4-2-3-1 |
| 4-4-2 | Balance, simplicity | 4-3-3 | 3-5-2 |
| 3-5-2 | Possession, midfield control | 4-3-3, 4-4-2 | 4-3-3 (wide) |
| 5-3-2 | Defense, counter-attack | 4-3-3 | 4-2-3-1 |
| 4-2-3-1 | Flexibility, creativity | 4-3-3, 5-3-2 | 3-5-2 |

### C. Point Earning Quick Reference

| Activity | Points | Time | Points/Hour |
|----------|--------|------|-------------|
| Match win (medium) | 75 | 3 min | 1500 |
| Daily login | 10 | 10 sec | - |
| Win streak (3) | 100 | - | - |
| Season complete | 1000 | ~5 hours | - |
| Friend referral | 600 | - | - |
| **Average (casual)** | - | - | **150** |
| **Average (regular)** | - | - | **250** |
| **Average (hardcore)** | - | - | **400** |

### D. Development Timeline

| Player Age | Training Effect | Market Value | Notes |
|------------|----------------|--------------|-------|
| 16-20 | +150% | Low | Rapid growth period |
| 21-23 | +120% | Increasing | Peak development |
| 24-28 | Maintain | Peak | Prime years |
| 29-31 | -50% | Declining | Still quality |
| 32-34 | -100% | Low | Aging, experience |
| 35+ | Cannot improve | Very low | Veterans |

---

**END OF TECHNICAL SPECIFICATION**

*This document should be used by developers and game designers as the authoritative reference for implementing all game systems and mechanics.*
