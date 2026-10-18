# API: Match Decision Endpoint

## Overview

The `/api/match/decide` endpoint handles asynchronous decision turns during matches. It processes a single match segment and returns the results along with the next turn configuration.

## Endpoint

```
POST /api/match/decide
```

## Authentication

Required. Uses Bearer token authentication.

## Rate Limiting

30 requests per minute per user.

## Request

### Headers

```http
Content-Type: application/json
Authorization: Bearer <token>
```

### Body

```typescript
{
  userId: string;              // User ID (must match authenticated user)
  turnNumber: number;          // 0-5 (corresponds to minutes 0, 15, 30, 45, 60, 75)
  decision?: DecisionOption | null;  // User's decision, or null for timeout
  priorState: {
    homeScore: number;         // Current home team score
    awayScore: number;         // Current away team score
    homeMomentum: number;      // -50 to 50
    awayMomentum: number;      // -50 to 50
    tension: number;           // 0 to 100
    formation: string;         // e.g., "4-3-3"
    mentality: "attacking" | "balanced" | "defensive";
    hasRedCard: boolean;       // Whether team has a red card
    squad: Player[];           // Current squad lineup
  }
}
```

### DecisionOption

```typescript
{
  id: string;
  label: string;               // Display label
  description: string;         // Explanation
  icon: string;                // Emoji icon
  action: "change_mentality" | "change_formation" | "substitution" | "keep_setup";
  category: "mentality" | "formation" | "substitution" | "tactical";
  mentality?: "attacking" | "balanced" | "defensive";
  formation?: string;
  substituteOut?: string;      // Player ID
  substituteIn?: string;       // Player ID
}
```

## Response

### Success (200)

```typescript
{
  events: MatchEvent[];        // Events that occurred in this segment
  segmentSummary: string;      // Contextual analysis of the segment
  turnPrompt: string;          // Decision context for the next turn
  nextTurn: DecisionTurn | null;  // Next turn configuration (null if match complete)
  endState: {
    homeScore: number;
    awayScore: number;
    homeMomentum: number;
    awayMomentum: number;
    tension: number;
    formation: string;
    mentality: "attacking" | "balanced" | "defensive";
    hasRedCard: boolean;
    squad: Player[];
  };
  turnResult: TurnResult;      // Applied decision (user or default)
}
```

### DecisionTurn

```typescript
{
  turnNumber: number;
  minute: number;
  label: string;
  options: DecisionOption[];
  defaultOption: DecisionOption;
  timerSeconds: 30;
}
```

### TurnResult

```typescript
{
  turnNumber: number;
  minute: number;
  decision: DecisionOption;
  wasDefault: boolean;         // true if timeout occurred
  mentalityShift?: "attacking" | "balanced" | "defensive";
  formationChange?: string;
  substitution?: {
    out: string;               // Player ID
    in: string;                // Player ID
  };
}
```

## Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | User can only access their own data |
| 404 | `NOT_FOUND` | User not found |
| 429 | `RATE_LIMITED` | Too many requests (30/minute) |
| 500 | `INTERNAL_ERROR` | Server error |
| 503 | `SERVICE_UNAVAILABLE` | Database timeout |

## Context-Aware Defaults

When `decision` is `null` (timeout), the engine applies a context-aware default:

| Priority | Condition | Default Action |
|----------|-----------|----------------|
| 1 | Red card received | Auto-substitute to fill gap |
| 2 | Player fatigue > 50 | Auto-substitute tired player |
| 3 | Losing by 2+ goals | Switch to attacking mentality |
| 4 | Winning by 2+ goals | Switch to defensive mentality |
| 5 | Normal (tied/close) | Keep current setup |

## Example Request

```bash
curl -X POST http://localhost:3000/api/match/decide \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "userId": "user_123",
    "turnNumber": 2,
    "decision": {
      "id": "turn_2_attacking",
      "label": "Subir a marcação",
      "description": "Mudar para mentalidade ofensiva para buscar o empate.",
      "icon": "⚔️",
      "action": "change_mentality",
      "category": "mentality",
      "mentality": "attacking"
    },
    "priorState": {
      "homeScore": 0,
      "awayScore": 1,
      "homeMomentum": -10,
      "awayMomentum": 15,
      "tension": 65,
      "formation": "4-3-3",
      "mentality": "balanced",
      "hasRedCard": false,
      "squad": [...]
    }
  }'
```

## Example Response

```json
{
  "events": [
    {
      "id": "evt_1234567890_abc123",
      "minute": 35,
      "type": "goal",
      "team": "home",
      "player": { "id": "p1", "name": "João Silva", ... },
      "description": "João Silva marca para Dragões do Cerrado",
      "commentary": "⚽ GOOOOL! João Silva marca! Dragões do Cerrado empata!",
      "intensity": "high",
      "highlight": true,
      "momentum": 30
    }
  ],
  "segmentSummary": "Placar atual: 1x1 (30' a 45'). Seu time domina o jogo mas precisa finalizar melhor. João Silva balançou as redes para o Dragões do Cerrado.",
  "turnPrompt": "Intervalo: Dragões do Cerrado 1x1 Leões do Norte. Placar atual: 1x1 (30' a 45'). Jogo empatado em 1x1. Hora de arriscar?",
  "nextTurn": {
    "turnNumber": 3,
    "minute": 45,
    "label": "Intervalo",
    "options": [...],
    "defaultOption": { ... },
    "timerSeconds": 30
  },
  "endState": {
    "homeScore": 1,
    "awayScore": 1,
    "homeMomentum": 20,
    "awayMomentum": 5,
    "tension": 75,
    "formation": "4-3-3",
    "mentality": "attacking",
    "hasRedCard": false,
    "squad": [...]
  },
  "turnResult": {
    "turnNumber": 2,
    "minute": 30,
    "decision": { ... },
    "wasDefault": false,
    "mentalityShift": "attacking"
  }
}
```

## Implementation Details

### Timeout Protection

- Request body parsing: 5 seconds
- Game state fetch: 5 seconds
- Total request timeout: 10 seconds

### Validation

The endpoint validates:
- `userId` is a non-empty string
- `turnNumber` is an integer between 0 and 5
- `priorState` contains all required fields
- `priorState.mentality` is one of: attacking, balanced, defensive
- `priorState.squad` is an array of Player objects

### Security

- Authentication required (Bearer token)
- User can only access their own data
- Rate limiting: 30 requests per minute
- Input validation and sanitization

## Related Documentation

- [Match Simulation](../Documentation/01-Game-Design/03-Match-Simulation.md)
- [Phase 2 Changes](./PHASE2_MATCH_ENGINE.md)
- [API Design](../Documentation/03-Technical-Architecture/03-API-Design.md)
