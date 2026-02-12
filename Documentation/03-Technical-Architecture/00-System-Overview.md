# System Overview

---
tags: #technical #architecture #system #infrastructure
status: complete
priority: critical
phase: mvp
last_updated: 2026-01-18
---

## Overview

Fala Mestre! is built on a modern, serverless architecture optimized for rapid development, cost efficiency, and scalability. The system is designed around a conversational AI core with real-time game state management.

> [!important] Architecture Philosophy
> "Keep it simple, ship fast, scale later."

---

## High-Level Architecture

```
+------------------------------------------------------------------+
|                         CLIENT LAYER                              |
|  +------------------------------------------------------------+  |
|  |  Next.js 14 (App Router) + React 18 + TypeScript           |  |
|  |  Tailwind CSS + shadcn/ui + Rive Animations                |  |
|  |  PWA Support (Installable) | Mobile-First Responsive       |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
                              |
                              | HTTPS / WSS
                              v
+------------------------------------------------------------------+
|                          API LAYER                                |
|  +------------------------------------------------------------+  |
|  |  Next.js API Routes (Vercel Serverless Functions)          |  |
|  |                                                             |  |
|  |  /api/auth/*        - Authentication flows                 |  |
|  |  /api/game/*        - Game actions & state                 |  |
|  |  /api/conversation  - AI chat interactions                 |  |
|  |  /api/rewards/*     - Points & voucher management          |  |
|  |  /api/analytics/*   - Event tracking                       |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
                              |
            +-----------------+-----------------+
            |                 |                 |
            v                 v                 v
+----------------+  +------------------+  +------------------+
|   AI SERVICE   |  |    DATABASE      |  |    ANALYTICS     |
|  +----------+  |  |  +------------+  |  |  +------------+  |
|  | OpenRouter|  |  |  | Supabase  |  |  |  | Mixpanel   |  |
|  | (Claude)  |  |  |  | PostgreSQL|  |  |  | LiveRamp   |  |
|  +----------+  |  |  +------------+  |  |  +------------+  |
|                |  |  | Auth       |  |  |                  |
|  Tier 1: Haiku |  |  | Storage    |  |  | User Clustering |
|  Tier 2: Sonnet|  |  | Realtime   |  |  | CDP Integration |
+----------------+  +------------------+  +------------------+
```

---

## Core Components

### 1. Client Application

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Next.js 14 | Full-stack React with SSR |
| Language | TypeScript | Type safety |
| Styling | Tailwind CSS | Utility-first CSS |
| Components | shadcn/ui | Pre-built accessible components |
| Animations | Rive | Interactive vector animations |
| State | Zustand | Lightweight state management |
| Forms | React Hook Form + Zod | Validation |

### 2. API Layer

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/login` | POST | User authentication |
| `/api/auth/register` | POST | New user creation |
| `/api/game/state` | GET | Fetch current game state |
| `/api/game/action` | POST | Execute game action |
| `/api/conversation` | POST | Send message to AI |
| `/api/rewards/balance` | GET | Get points balance |
| `/api/rewards/claim` | POST | Claim voucher |

### 3. AI Service

| Tier | Model | Use Case | Latency |
|------|-------|----------|---------|
| 1 | Claude Haiku | Intent detection, quick responses | <500ms |
| 2 | Claude Sonnet | Match simulation, negotiations | <2s |
| 3 | Claude Sonnet+ | User clustering, complex analysis | <5s |

### 4. Database (Supabase)

| Table | Purpose |
|-------|---------|
| `users` | User accounts and profiles |
| `game_states` | Current game state per user |
| `players` | Player database (all teams) |
| `matches` | Match history and results |
| `conversations` | Chat message history |
| `rewards` | Points and voucher tracking |
| `analytics_events` | User behavior events |

### 5. Analytics Pipeline

```
User Action
    |
    v
+-------------------+
| Event Capture     | <- Mixpanel SDK
+-------------------+
    |
    v
+-------------------+
| Behavioral        | <- Daily batch process
| Clustering        |    Claude Sonnet
+-------------------+
    |
    v
+-------------------+
| CDP Sync          | <- LiveRamp integration
| (User Segments)   |
+-------------------+
    |
    v
+-------------------+
| Ad Platforms      | <- Facebook, Google, TikTok
| Audience Sync     |
+-------------------+
```

---

## Data Flow

### Conversation Flow

```
1. User sends message
   |
   v
2. Frontend captures input
   |
   v
3. POST /api/conversation
   {
     message: "quero jogar",
     gameState: { ... },
     sessionId: "abc123"
   }
   |
   v
4. API Route processes:
   a. Validate request
   b. Fetch user game state from DB
   c. Determine AI tier needed
   d. Call OpenRouter API
   e. Parse AI response
   f. Update game state if needed
   g. Log conversation
   h. Track analytics event
   |
   v
5. Response returned
   {
     message: "Vamos la! Proximo...",
     gameState: { ... },
     actions: ["play", "cancel"],
     cards: [{ type: "match_preview" }]
   }
   |
   v
6. Frontend updates UI
```

### Match Simulation Flow

```
1. User initiates match
   |
   v
2. Load team states (user + opponent)
   |
   v
3. Calculate team strengths
   - Player ratings
   - Formation modifiers
   - Morale/fitness
   - Tactical matchups
   |
   v
4. Generate match outcome (game logic)
   - Score calculation
   - Event generation (goals, cards)
   - Player ratings
   |
   v
5. AI generates narrative (Claude Sonnet)
   - Dramatic commentary
   - Key moment descriptions
   - Post-match analysis
   |
   v
6. Update game state
   - Season progress
   - Player stats
   - Points earned
   |
   v
7. Return result to client
```

---

## Security Architecture

### Authentication

```typescript
// Supabase Auth Flow
const authFlow = {
  // Primary methods
  email_password: true,
  magic_link: true,
  
  // Social providers
  google: true,
  apple: true,
  
  // Session management
  jwt_expiry: '7d',
  refresh_token: true,
  
  // Security
  rate_limiting: '100/hour',
  password_requirements: {
    min_length: 8,
    require_uppercase: false,
    require_special: false
  }
};
```

### Row Level Security (RLS)

```sql
-- Users can only access their own data
CREATE POLICY "Users read own data" ON game_states
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own data" ON game_states
  FOR UPDATE USING (auth.uid() = user_id);

-- Read-only access to shared data
CREATE POLICY "Anyone can read players" ON players
  FOR SELECT USING (true);
```

### API Security

| Protection | Implementation |
|------------|----------------|
| Authentication | Supabase JWT verification |
| Rate Limiting | Vercel Edge Config (100 req/min) |
| Input Validation | Zod schemas on all endpoints |
| CORS | Strict origin whitelist |
| XSS Prevention | React auto-escaping + CSP headers |
| SQL Injection | Parameterized queries (Supabase) |

---

## Scalability Considerations

### Current Capacity (MVP)

| Resource | Limit | Notes |
|----------|-------|-------|
| Concurrent users | 1,000 | Vercel serverless |
| API requests/sec | 100 | Rate limited |
| Database connections | 50 | Supabase pooling |
| AI requests/min | 60 | OpenRouter tier |

### Scaling Path

```
Phase 1 (MVP): 0-10K users
├── Vercel Hobby/Pro
├── Supabase Free/Pro
├── OpenRouter Pay-as-you-go
└── Estimated cost: $100-500/month

Phase 2 (Growth): 10K-50K users
├── Vercel Enterprise
├── Supabase Pro with replicas
├── OpenRouter Enterprise
├── Redis caching (Vercel KV)
└── Estimated cost: $2,000-5,000/month

Phase 3 (Scale): 50K-200K users
├── Custom infrastructure consideration
├── Database read replicas
├── CDN optimization
├── AI response caching
└── Estimated cost: $10,000-20,000/month
```

---

## Monitoring & Observability

### Logging

```typescript
// Structured logging format
const logEntry = {
  timestamp: new Date().toISOString(),
  level: 'info' | 'warn' | 'error',
  service: 'api' | 'ai' | 'db',
  action: 'conversation' | 'match' | 'transfer',
  userId: 'uuid',
  duration: 234, // ms
  metadata: { ... }
};
```

### Metrics

| Metric | Tool | Alert Threshold |
|--------|------|-----------------|
| API latency p95 | Vercel Analytics | >2000ms |
| Error rate | Sentry | >1% |
| AI response time | Custom | >5000ms |
| Database queries/sec | Supabase | >80% capacity |
| Active users | Mixpanel | N/A (tracking) |

### Health Checks

```
GET /api/health
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "ai_service": "ok",
    "cache": "ok"
  },
  "version": "1.0.0",
  "timestamp": "2026-01-18T12:00:00Z"
}
```

---

## Disaster Recovery

### Backup Strategy

| Data | Frequency | Retention | Method |
|------|-----------|-----------|--------|
| Database | Daily | 30 days | Supabase automatic |
| User uploads | Real-time | Indefinite | Supabase Storage |
| Conversation logs | Weekly | 90 days | Export to S3 |
| Analytics | Daily | 1 year | Mixpanel retention |

### Recovery Procedures

1. **Database corruption**: Restore from Supabase point-in-time backup
2. **AI service outage**: Fallback to template responses
3. **Vercel outage**: Static fallback page on Cloudflare
4. **Complete failure**: Manual restore from backups (RTO: 4 hours)

---

## Environment Configuration

### Environment Variables

```env
# Application
NEXT_PUBLIC_APP_URL=https://falamestre.ai
NODE_ENV=production

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# AI
OPENROUTER_API_KEY=xxx

# Analytics
NEXT_PUBLIC_MIXPANEL_TOKEN=xxx
LIVERAMP_API_KEY=xxx

# Payments (Future)
STRIPE_SECRET_KEY=xxx
STRIPE_WEBHOOK_SECRET=xxx
```

### Deployment Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| Development | localhost:3000 | Local development |
| Preview | *.vercel.app | PR previews |
| Staging | staging.falamestre.ai | Pre-production testing |
| Production | falamestre.ai | Live application |

---

## Related Documents

- [[01-Tech-Stack]] - Detailed technology choices
- [[02-Database-Schema]] - Full database design
- [[03-API-Design]] - API contracts
- [[04-AI-LLM-Strategy]] - AI architecture
- [[05-Caching-Performance]] - Performance optimization

---

*"Make it work, make it right, make it fast." - Kent Beck*
