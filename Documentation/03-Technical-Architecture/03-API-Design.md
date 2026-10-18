# API Design

---
tags: #technical #api #endpoints #rest #contracts
status: complete
priority: critical
phase: mvp
last_updated: 2026-01-18
---

## Overview

The API is built on Next.js API Routes, providing a serverless REST API. All endpoints follow consistent patterns for requests, responses, and error handling.

> [!note] API Philosophy
> Simple, predictable, and well-documented.

> [!note] Implemented routes
> This page records the original API design. The routes the app actually serves live under `app/src/app/api/`. Fala Mestre! is a standalone game; the API has no crypto or ad-platform endpoints.

---

## Base Configuration

### Base URL

```
Production: https://falamestre.ai/api
Staging:    https://staging.falamestre.ai/api
Local:      http://localhost:3000/api
```

### Authentication

All authenticated endpoints require a Bearer token:

```http
Authorization: Bearer <supabase_jwt_token>
```

### Response Format

All responses follow a consistent structure:

```typescript
// Success Response
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-01-18T12:00:00Z",
    "requestId": "req_abc123"
  }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid team selection",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2026-01-18T12:00:00Z",
    "requestId": "req_abc123"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Action not allowed |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `AI_ERROR` | 503 | AI service unavailable |

---

## Authentication Endpoints

### POST /api/auth/register

Create a new user account.

**Request:**
```typescript
{
  email: string;
  password: string;
  username?: string;
  favoriteTeam?: string;
  referralCode?: string;
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    user: {
      id: string;
      email: string;
      username: string;
    },
    session: {
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
    }
  }
}
```

### POST /api/auth/login

Authenticate existing user.

**Request:**
```typescript
{
  email: string;
  password: string;
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    user: { ... },
    session: { ... }
  }
}
```

### POST /api/auth/logout

End current session.

**Response:**
```typescript
{
  success: true,
  data: {
    message: "Logged out successfully"
  }
}
```

### POST /api/auth/refresh

Refresh access token.

**Request:**
```typescript
{
  refreshToken: string;
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    accessToken: string;
    expiresAt: number;
  }
}
```

---

## Game Endpoints

### GET /api/game/state

Get current game state for authenticated user.

**Response:**
```typescript
{
  success: true,
  data: {
    gameState: {
      team: "Leões do Norte",
      season: 1,
      week: 12,
      leaguePosition: 5,
      leaguePoints: 22,
      budget: 15000000,
      
      squad: Player[],
      formation: "4-3-3",
      tactics: {
        mentality: "balanced",
        pressing: "medium"
      },
      
      teamMorale: 78,
      fanMood: 72,
      
      nextMatch: {
        opponent: "Leões do Norte",
        isHome: true,
        competition: "Liga Mestre",
        week: 13
      },
      
      lastMatchResult: {
        opponent: "Falcões de Aço",
        score: "2-1",
        result: "win",
        pointsEarned: 100
      }
    }
  }
}
```

### POST /api/game/action

Execute a game action.

**Request:**
```typescript
{
  action: "play_match" | "change_formation" | "substitute" | "train" | "scout";
  params: {
    // Action-specific parameters
  }
}
```

**Action: play_match**
```typescript
{
  action: "play_match",
  params: {
    matchId?: string;  // Optional, uses next scheduled match
    tactics?: {
      formation?: string;
      mentality?: string;
    }
  }
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    match: {
      id: string;
      homeTeam: string;
      awayTeam: string;
      homeScore: number;
      awayScore: number;
      events: MatchEvent[];
      stats: MatchStats;
      playerRatings: Record<string, number>;
    },
    rewards: {
      points: number;
      bonuses: string[];
    },
    updatedState: GameState;
  }
}
```

**Action: change_formation**
```typescript
{
  action: "change_formation",
  params: {
    formation: "4-3-3" | "4-4-2" | "3-5-2" | "5-3-2" | "4-2-3-1";
    lineup?: string[];  // Player IDs in position order
  }
}
```

**Action: substitute**
```typescript
{
  action: "substitute",
  params: {
    playerOut: string;  // Player ID
    playerIn: string;   // Player ID
  }
}
```

### GET /api/game/standings

Get league standings.

**Query Parameters:**
- `league`: string (default: current league)
- `season`: number (default: current season)

**Response:**
```typescript
{
  success: true,
  data: {
    league: "Liga Mestre A",
    season: 1,
    standings: [
      {
        position: 1,
      team: "Dragões do Cerrado",
        played: 12,
        won: 8,
        drawn: 2,
        lost: 2,
        goalsFor: 22,
        goalsAgainst: 10,
        goalDifference: 12,
        points: 26,
        form: ["W", "W", "D", "W", "L"]
      },
      // ... more teams
    ]
  }
}
```

---

## Conversation Endpoint

### POST /api/conversation

Send a message and receive AI response.

**Request:**
```typescript
{
  message: string;
  sessionId?: string;
  context?: {
    currentScreen?: string;
    recentActions?: string[];
  }
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    response: {
      message: string;
      cards: Card[];
      actions: Action[];
      intent: string;
    },
    sessionId: string,
    gameStateUpdated: boolean,
    updatedState?: Partial<GameState>
  }
}
```

**Card Types:**
```typescript
type Card = 
  | { type: "formation"; data: FormationCardData }
  | { type: "match_result"; data: MatchResultCardData }
  | { type: "player"; data: PlayerCardData }
  | { type: "transfer"; data: TransferCardData }
  | { type: "standings"; data: StandingsCardData }
  | { type: "progress"; data: ProgressCardData };
```

**Action Types:**
```typescript
interface Action {
  id: string;
  label: string;
  type: "primary" | "secondary" | "danger";
  action: string;
  params?: Record<string, any>;
}
```

---

## Transfer Market Endpoints

### GET /api/transfers/search

Search for available players.

**Query Parameters:**
- `position`: GK | DEF | MID | FWD
- `minRating`: number
- `maxRating`: number
- `maxPrice`: number
- `team`: string
- `page`: number (default: 1)
- `limit`: number (default: 20)

**Response:**
```typescript
{
  success: true,
  data: {
    players: [
      {
        id: string;
        name: string;
        team: string;
        position: string;
        age: number;
        overall: number;
        value: number;
        attributes: PlayerAttributes;
      }
    ],
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    }
  }
}
```

### POST /api/transfers/offer

Make a transfer offer.

**Request:**
```typescript
{
  playerId: string;
  offerAmount: number;
  wageOffer?: number;
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    result: "accepted" | "rejected" | "counter",
    counterOffer?: number;
    message: string;
    negotiation: {
      id: string;
      status: string;
      history: NegotiationMessage[];
    }
  }
}
```

### POST /api/transfers/respond

Respond to a counter-offer.

**Request:**
```typescript
{
  negotiationId: string;
  response: "accept" | "counter" | "withdraw";
  newOffer?: number;
}
```

### POST /api/transfers/sell

List a player for sale.

**Request:**
```typescript
{
  playerId: string;
  askingPrice: number;
}
```

---

## Rewards Endpoints

### GET /api/rewards/balance

Get current in-game points balance.

**Response:**
```typescript
{
  success: true,
  data: {
    points: number;
    
    recentRewards: [
      {
        id: string;
        type: string;
        amount: number;
        source: string;
        createdAt: string;
      }
    ]
  }
}
```

### GET /api/rewards/history

Get reward history.

**Query Parameters:**
- `type`: points | achievement
- `page`: number
- `limit`: number

**Response:**
```typescript
{
  success: true,
  data: {
    rewards: Reward[],
    pagination: { ... }
  }
}
```

---

## Analytics Endpoints

### POST /api/analytics/track

Track a user event.

**Request:**
```typescript
{
  event: string;
  properties?: Record<string, any>;
  timestamp?: string;
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    tracked: true;
  }
}
```

### GET /api/analytics/stats

Get user statistics (for profile).

**Response:**
```typescript
{
  success: true,
  data: {
    stats: {
      totalMatches: number;
      wins: number;
      draws: number;
      losses: number;
      winRate: number;
      
      goalsScored: number;
      goalsConceded: number;
      cleanSheets: number;
      
      totalPointsEarned: number;
      
      bestWin: {
        opponent: string;
        score: string;
        date: string;
      };
      
      topScorer: {
        name: string;
        goals: number;
      };
      
      longestWinStreak: number;
      currentStreak: number;
    }
  }
}
```

---

## Health & System

### GET /api/health

System health check.

**Response:**
```typescript
{
  success: true,
  data: {
    status: "healthy" | "degraded" | "unhealthy";
    version: string;
    checks: {
      database: "ok" | "error";
      aiService: "ok" | "error";
      cache: "ok" | "error";
    },
    timestamp: string;
  }
}
```

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/*` | 10 | 1 minute |
| `/api/conversation` | 30 | 1 minute |
| `/api/game/*` | 60 | 1 minute |
| `/api/transfers/*` | 30 | 1 minute |
| `/api/analytics/track` | 100 | 1 minute |

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 1705579200
```

---

## API Versioning

Current version: **v1** (implicit)

Future versioning strategy:
```
/api/v2/game/state
```

---

## Related Documents

- [[00-System-Overview]] - Architecture overview
- [[02-Database-Schema]] - Data structures
- [[04-AI-LLM-Strategy]] - AI integration
- [[03-Conversational-Interface]] - UI integration

---

*"A good API is like a well-written sentence: simple, clear, and complete."*
