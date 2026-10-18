# Phase 2: Match Engine Segmentation & API

## Overview

Phase 2 introduces **segment-based match simulation** with asynchronous decision turns. This transforms the match experience from a continuous simulation into an interactive, turn-based management system where players make tactical decisions at key moments.

## Key Changes

### 1. Segment-Based Simulation (`game-engine.ts`)

The match engine now supports running matches in segments between decision turns:

```typescript
// New function: simulateMatchSegment()
export function simulateMatchSegment(
  homeTeam: string,
  awayTeam: string,
  homeSquad: Player[],
  awaySquad: Player[],
  homeMorale: number,
  awayMorale: number,
  fromMinute: number,
  toMinute: number,
  priorState: {
    homeScore: number;
    awayScore: number;
    homeMomentum: number;
    awayMomentum: number;
    tension: number;
  },
  turnResult?: TurnResult,
  week?: number
): {
  events: MatchEvent[];
  endState: {
    homeScore: number;
    awayScore: number;
    homeMomentum: number;
    awayMomentum: number;
    tension: number;
    hasRedCard: boolean;
  };
}
```

**Features:**
- Runs simulation for a specific minute range (e.g., 0-15, 15-30)
- Accepts prior match state to continue from previous segment
- Applies `TurnResult` modifications (formation, mentality, substitutions, **tactical instructions**)
- Tactical instructions: temporary stat modifiers (pac/sho/pas/dri/def/phy) applied to squad copy before team power calculation
- Team/opponent power multipliers adjust final power values
- Risk factor increases both teams' goal probability
- Tracks momentum and tension across segments
- Returns events and updated end state

### 2. Match Segment Engine (`match-segment-engine.ts`)

New orchestration layer that manages full matches as sequences of segments:

#### `runFullMatch()` - PvE Mode

Runs a complete 90-minute match with all 6 decision turns:

```typescript
export function runFullMatch(
  homeTeam: string,
  awayTeam: string,
  homeSquad: Player[],
  awaySquad: Player[],
  homeMorale: number,
  awayMorale: number,
  decisions: (TurnResult | null)[],
  week?: number
): FullMatchResult
```

**Returns:**
- Final score and winner
- All match events
- Segment breakdown with scores at each boundary
- Turn history showing user decisions vs defaults

#### `runMatchSegment()` - PvP Async Mode

Runs a single segment on-demand for async PvP:

```typescript
export function runMatchSegment(
  homeTeam: string,
  awayTeam: string,
  homeSquad: Player[],
  awaySquad: Player[],
  homeMorale: number,
  awayMorale: number,
  turnNumber: number,
  priorState: MatchState,
  turnResult?: TurnResult,
  week?: number
): {
  events: MatchEvent[];
  segmentSummary: string;
  turnPrompt: string;
  nextTurn: DecisionTurn | null;
  endState: MatchState;
}
```

**Features:**
- Each player's match runs independently (no blocking)
- Returns segment summary for UI display
- Generates turn prompt for next decision
- Builds next `DecisionTurn` if not the final segment

### 3. Commentary Generation (`commentary.ts`)

New functions for between-segments analysis:

#### `generateSegmentSummary()`

Produces contextual analysis of what happened in a segment:

```typescript
export function generateSegmentSummary(
  events: MatchEvent[],
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number,
  fromMinute: number,
  toMinute: number
): string
```

**Example Output:**
```
"Placar atual: 1x0 (0' a 15'). Seu time domina o jogo mas precisa finalizar melhor. 
João Silva balançou as redes para o Dragões do Cerrado."
```

**Analysis Includes:**
- Current score and time range
- Dominance analysis (who's controlling the game)
- Goal scorers in the segment
- Discipline issues (cards)

#### `generateTurnPrompt()`

Generates decision context text explaining WHY a tactical decision is needed:

```typescript
export function generateTurnPrompt(
  turnLabel: string,
  homeScore: number,
  awayScore: number,
  homeTeam: string,
  awayTeam: string,
  segmentSummary: string,
  hasRedCard: boolean,
  tiredPlayerName?: string
): string
```

**Example Output:**
```
"Primeiro Tempo: Dragões do Cerrado 1x0 Leões do Norte. Placar atual: 1x0 (0' a 15'). 
Você está ganhando 1x0. Pode segurar ou ampliar?"
```

**Context Includes:**
- Turn label and current score
- Segment summary
- Score situation (winning/losing/tied)
- Red card alerts
- Tired player warnings

### 4. Decision Engine (`decision-engine.ts`)

Context-aware default action resolver:

```typescript
export function resolveDefaultAction(
  homeScore: number,
  awayScore: number,
  homeSquad: Player[],
  hasRedCard: boolean
): DecisionOption
```

**Priority Order:**
1. **Red Card** → Auto-substitute to fill gap
2. **Low Fitness** (fatigue > 50) → Auto-substitute tired player
3. **Losing by 2+** → Switch to attacking mentality
4. **Winning by 2+** → Switch to defensive mentality
5. **Normal** → Keep current setup

### 5. Decision Turn API (`/api/match/decide`)

New endpoint for async decision turn handling:

#### Request

```typescript
POST /api/match/decide

{
  userId: string;
  turnNumber: number;        // 0-5
  decision?: DecisionOption | null;  // null = timeout
  priorState: {
    homeScore: number;
    awayScore: number;
    homeMomentum: number;
    awayMomentum: number;
    tension: number;
    formation: string;
    mentality: 'attacking' | 'balanced' | 'defensive';
    hasRedCard: boolean;
    squad: Player[];
  }
}
```

#### Response

```typescript
{
  events: MatchEvent[];           // Events from this segment
  segmentSummary: string;         // Contextual analysis
  turnPrompt: string;             // Next turn context text
  nextTurn: DecisionTurn | null;  // null if match complete
  endState: {
    homeScore: number;
    awayScore: number;
    homeMomentum: number;
    awayMomentum: number;
    tension: number;
    formation: string;
    mentality: TurnMentality;
    hasRedCard: boolean;
    squad: Player[];
  };
  turnResult: TurnResult;         // Applied decision
}
```

**Features:**
- Authentication required
- Rate limiting: 30 requests/minute
- Timeout protection (5s for DB queries)
- User can only access their own data
- Context-aware defaults on timeout

## Architecture

### Data Flow

```
User Decision → /api/match/decide → runMatchSegment() → simulateMatchSegment()
     ↓                                                              ↓
TurnResult ← createTurnResult()                     Match Events (with tactical effects)
     ↓                                                              ↓
applyTurnResult()                                       generateSegmentSummary()
     ↓                                                              ↓
Updated State + tacticalInstruction                    generateTurnPrompt()
     ↓                                                              ↓
simulateMatchSegment applies:                          Next Segment
  1. Stat modifiers to squad copy
  2. Team power multiplier
  3. Opponent power multiplier
  4. Risk factor to goal probability
     ↓                                                              ↓
Next Segment ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
```

### State Management

Match state is tracked across segments:

```typescript
interface MatchState {
  homeScore: number;
  awayScore: number;
  homeMomentum: number;    // -50 to 50
  awayMomentum: number;    // -50 to 50
  tension: number;         // 0 to 100
  formation: string;       // e.g., "4-3-3"
  mentality: TurnMentality; // "attacking" | "balanced" | "defensive"
  hasRedCard: boolean;
  squad: Player[];         // Current lineup
}
```

### Turn Configuration

6 decision turns at fixed minutes:

| Turn | Minute | Label |
|------|--------|-------|
| 0 | 0' | Início |
| 1 | 15' | Primeiro Tempo |
| 2 | 30' | Meio do Primeiro |
| 3 | 45' | Intervalo |
| 4 | 60' | Segundo Tempo |
| 5 | 75' | Reta Final |

Each turn has a 30-second timer. If no decision is made, the context-aware default is applied.

## Usage Examples

### PvE: Run Full Match

```typescript
import { runFullMatch } from '@/lib/match-segment-engine';

const result = runFullMatch(
  'Dragões do Cerrado',
  'Leões do Norte',
  homeSquad,
  awaySquad,
  75,  // morale
  60,  // morale
  [null, null, null, null, null, null],  // no decisions = all defaults
  12   // week
);

console.log(`Final: ${result.homeScore}x${result.awayScore}`);
console.log(`Winner: ${result.winner}`);
console.log(`Events: ${result.events.length}`);
```

### PvP: Run Single Segment

```typescript
import { runMatchSegment } from '@/lib/match-segment-engine';

const segment = runMatchSegment(
  'Dragões do Cerrado',
  'Leões do Norte',
  homeSquad,
  awaySquad,
  75,
  60,
  2,  // turn number (30')
  priorState,
  turnResult,  // user's decision
  12
);

console.log(segment.segmentSummary);
console.log(segment.turnPrompt);
console.log(`Next turn: ${segment.nextTurn?.label}`);
```

### API Call

```typescript
const response = await fetch('/api/match/decide', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user_123',
    turnNumber: 2,
    decision: {
      id: 'turn_2_attacking',
      label: 'Subir a marcação',
      action: 'change_mentality',
      mentality: 'attacking',
    },
    priorState: {
      homeScore: 0,
      awayScore: 1,
      homeMomentum: -10,
      awayMomentum: 15,
      tension: 65,
      formation: '4-3-3',
      mentality: 'balanced',
      hasRedCard: false,
      squad: [...],
    },
  }),
});

const data = await response.json();
// data.events, data.segmentSummary, data.nextTurn, etc.
```

## Related Documentation

- [Match Simulation](../Documentation/01-Game-Design/03-Match-Simulation.md) - Core simulation mechanics
- [API Design](../Documentation/03-Technical-Architecture/03-API-Design.md) - API contracts
- [Decision Types](../app/src/lib/types.ts) - TypeScript interfaces
