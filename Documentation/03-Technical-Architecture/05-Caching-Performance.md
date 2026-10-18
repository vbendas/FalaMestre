# Caching & Performance

---
tags: #technical #caching #performance #optimization #redis
status: complete
priority: high
phase: mvp
last_updated: 2026-01-18
---

## Overview

Performance is critical for a conversational game - every millisecond of latency breaks the illusion of a natural conversation. This document outlines our multi-layer caching strategy and performance optimization techniques.

> [!important] Performance Target
> 95th percentile response time under 2 seconds for all user interactions.

---

## Performance Targets

| Metric | Target | Critical | Acceptable |
|--------|--------|----------|------------|
| AI Response (p50) | <1000ms | <1500ms | <2000ms |
| AI Response (p95) | <2000ms | <3000ms | <4000ms |
| API Response (p50) | <200ms | <300ms | <500ms |
| Page Load (FCP) | <1.5s | <2.5s | <3.5s |
| Time to Interactive | <3.0s | <4.0s | <5.0s |

---

## Caching Architecture

### Multi-Layer Cache

```
+------------------+
|    Browser       | <- Service Worker, Local Storage
+------------------+
         |
         v
+------------------+
|   CDN Edge       | <- Vercel Edge Cache (static assets)
+------------------+
         |
         v
+------------------+
|   Vercel KV      | <- Redis (API responses, AI cache)
+------------------+
         |
         v
+------------------+
|   Database       | <- PostgreSQL query cache
+------------------+
```

### Cache Layers Explained

| Layer | Technology | TTL | Content |
|-------|------------|-----|---------|
| Browser | Service Worker | 1 hour | Static assets, UI |
| Browser | localStorage | Session | Game state snapshot |
| Edge | Vercel CDN | 1 year | JS, CSS, images |
| Application | Vercel KV | Varies | API responses, AI |
| Database | PgBouncer | Query-based | Frequent queries |

---

## Vercel KV (Redis) Strategy

### Cache Key Patterns

```typescript
// Key naming convention: {type}:{identifier}:{variant}

const cacheKeys = {
  // User-specific
  gameState: (userId: string) => `gs:${userId}`,
  userProfile: (userId: string) => `up:${userId}`,
  
  // AI responses
  aiResponse: (promptHash: string) => `ai:${promptHash}`,
  matchNarrative: (matchId: string) => `mn:${matchId}`,
  
  // Shared data
  standings: (league: string, week: number) => `st:${league}:${week}`,
  playerData: (playerId: string) => `pl:${playerId}`,
  teamSquad: (team: string) => `sq:${team}`,
  
  // Rate limiting
  rateLimit: (userId: string, endpoint: string) => `rl:${userId}:${endpoint}`
};
```

### TTL Configuration

```typescript
const cacheTTL = {
  // Short-lived (frequently changing)
  gameState: 300,           // 5 minutes
  rateLimit: 60,            // 1 minute
  
  // Medium-lived
  aiResponse: 1800,         // 30 minutes
  standings: 3600,          // 1 hour
  
  // Long-lived (rarely changing)
  playerData: 86400,        // 24 hours
  teamSquad: 86400,         // 24 hours
  staticContent: 604800,    // 7 days
  
  // Never cache
  matchNarrative: 0         // Always unique
};
```

### Cache Operations

```typescript
import { kv } from '@vercel/kv';

class CacheService {
  // Get with fallback
  async getOrSet<T>(
    key: string,
    fallback: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    // Try cache first
    const cached = await kv.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    // Generate fresh value
    const value = await fallback();
    
    // Cache for future
    if (ttl > 0) {
      await kv.set(key, value, { ex: ttl });
    }
    
    return value;
  }
  
  // Invalidate related keys
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await kv.keys(pattern);
    if (keys.length > 0) {
      await kv.del(...keys);
    }
  }
  
  // Cache-aside for game state
  async getGameState(userId: string): Promise<GameState> {
    const key = cacheKeys.gameState(userId);
    
    return this.getOrSet(
      key,
      async () => {
        const { data } = await supabase
          .from('game_states')
          .select('*')
          .eq('user_id', userId)
          .single();
        return data;
      },
      cacheTTL.gameState
    );
  }
  
  // Write-through for game state updates
  async updateGameState(userId: string, state: GameState): Promise<void> {
    // Update database
    await supabase
      .from('game_states')
      .upsert(state);
    
    // Update cache
    const key = cacheKeys.gameState(userId);
    await kv.set(key, state, { ex: cacheTTL.gameState });
  }
}
```

---

## AI Response Caching

### Semantic Cache Keys

```typescript
function generateAICacheKey(
  intent: string,
  normalizedContext: object
): string {
  // Create deterministic hash from intent + key context
  const contextString = JSON.stringify(normalizedContext, Object.keys(normalizedContext).sort());
  const hash = crypto.createHash('sha256')
    .update(intent + contextString)
    .digest('hex')
    .substring(0, 16);
  
  return `ai:${intent}:${hash}`;
}

// Example usage
const cacheKey = generateAICacheKey('show_standings', {
  league: 'Liga Mestre',
  week: 12
});
// Result: ai:show_standings:a1b2c3d4e5f6g7h8
```

### Cacheable vs Non-Cacheable

| Response Type | Cacheable | Reason |
|---------------|-----------|--------|
| Standings | Yes | Same for all users |
| Player info | Yes | Static data |
| Tactical advice | Partial | Context-dependent |
| Match narrative | No | Must be unique |
| Transfer negotiation | No | Interactive |
| Greeting | No | Should feel fresh |

### Cache Warmup

```typescript
// Pre-warm common caches on deploy
async function warmupCaches(): Promise<void> {
  // Warm standings for all leagues
  const leagues = ['Liga Mestre A', 'Liga Mestre B'];
  for (const league of leagues) {
    await generateStandings(league);
  }
  
  // Warm popular team squads
  const popularTeams = ['Leões do Norte', 'Falcões de Aço', 'Trovão FC', 'Maré Alta'];
  for (const team of popularTeams) {
    await getTeamSquad(team);
  }
  
  // Warm player database (top 100)
  await getTopPlayers(100);
}
```

---

## Database Optimization

### Query Optimization

```sql
-- Use covering indexes for common queries
CREATE INDEX idx_game_states_user_summary ON game_states (
  user_id,
  team,
  season,
  week,
  league_position
);

-- Partial index for active games
CREATE INDEX idx_active_games ON game_states (user_id)
WHERE updated_at > NOW() - INTERVAL '7 days';

-- Use materialized view for standings (refresh hourly)
CREATE MATERIALIZED VIEW league_standings AS
SELECT 
  team,
  league,
  season,
  SUM(CASE WHEN result = 'W' THEN 1 ELSE 0 END) as wins,
  SUM(CASE WHEN result = 'D' THEN 1 ELSE 0 END) as draws,
  SUM(CASE WHEN result = 'L' THEN 1 ELSE 0 END) as losses,
  SUM(goals_for) as goals_for,
  SUM(goals_against) as goals_against,
  SUM(CASE WHEN result = 'W' THEN 3 WHEN result = 'D' THEN 1 ELSE 0 END) as points
FROM match_results
GROUP BY team, league, season;

-- Refresh standings
REFRESH MATERIALIZED VIEW CONCURRENTLY league_standings;
```

### Connection Pooling

```typescript
// Supabase handles pooling, but configure appropriately
const supabaseConfig = {
  db: {
    poolMin: 2,
    poolMax: 10,
    idleTimeoutMillis: 30000
  }
};
```

---

## Frontend Performance

### Code Splitting

```typescript
// next.config.js
module.exports = {
  // Enable SWC minification
  swcMinify: true,
  
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000 // 1 year
  },
  
  // Bundle analyzer (dev only)
  webpack: (config, { isServer }) => {
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(new BundleAnalyzerPlugin());
    }
    return config;
  }
};
```

### Lazy Loading

```typescript
// Lazy load heavy components
const FormationCard = dynamic(() => import('@/components/FormationCard'), {
  loading: () => <FormationSkeleton />,
  ssr: false
});

const RiveAnimation = dynamic(() => import('@/components/RiveAnimation'), {
  loading: () => <AnimationPlaceholder />,
  ssr: false
});
```

### Optimistic Updates

```typescript
// Update UI immediately, sync with server
async function playMatch() {
  // 1. Optimistic UI update
  setGameState(prev => ({
    ...prev,
    isSimulating: true
  }));
  
  // 2. API call
  const result = await api.game.playMatch();
  
  // 3. Reconcile with actual result
  setGameState(prev => ({
    ...prev,
    isSimulating: false,
    lastMatch: result.match,
    week: prev.week + 1,
    points: prev.points + result.pointsEarned
  }));
}
```

### Service Worker

```typescript
// sw.js - Cache static assets
const CACHE_NAME = 'falamestre-v1';
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Network-first for API, cache-first for assets
  if (event.request.url.includes('/api/')) {
    event.respondWith(networkFirst(event.request));
  } else {
    event.respondWith(cacheFirst(event.request));
  }
});
```

---

## Monitoring & Alerts

### Performance Metrics

```typescript
// Track key metrics
function trackPerformance(operation: string, startTime: number) {
  const duration = Date.now() - startTime;
  
  // Log to first-party analytics
  logEvent('performance_metric', {
    operation,
    duration,
    percentile: getPercentile(duration, operation)
  });
  
  // Alert on slow operations
  if (duration > THRESHOLDS[operation]?.critical) {
    alertOps(`Slow ${operation}: ${duration}ms`);
  }
}

const THRESHOLDS = {
  ai_response: { warning: 2000, critical: 4000 },
  api_response: { warning: 300, critical: 500 },
  db_query: { warning: 100, critical: 200 }
};
```

### Cache Hit Rate Dashboard

```typescript
// Track cache effectiveness
class CacheMetrics {
  private hits = 0;
  private misses = 0;
  
  recordHit(key: string) {
    this.hits++;
    logEvent('cache_hit', { key_prefix: key.split(':')[0] });
  }
  
  recordMiss(key: string) {
    this.misses++;
    logEvent('cache_miss', { key_prefix: key.split(':')[0] });
  }
  
  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }
}
```

---

## Performance Checklist

### Before Launch

- [ ] Enable Vercel Edge caching
- [ ] Configure Redis TTLs
- [ ] Set up database indexes
- [ ] Enable gzip/brotli compression
- [ ] Optimize images (WebP/AVIF)
- [ ] Minify JS/CSS bundles
- [ ] Configure CDN headers
- [ ] Test with slow 3G throttling
- [ ] Run Lighthouse audit (target >90)

### Ongoing Monitoring

- [ ] Weekly cache hit rate review
- [ ] Monthly p95 latency analysis
- [ ] Query performance review
- [ ] Bundle size tracking
- [ ] Core Web Vitals monitoring

---

## Related Documents

- [[00-System-Overview]] - Architecture overview
- [[01-Tech-Stack]] - Technology choices
- [[04-AI-LLM-Strategy]] - AI optimization
- [[03-API-Design]] - API performance

---

*"Premature optimization is the root of all evil, but mature optimization is the root of all delight."*
