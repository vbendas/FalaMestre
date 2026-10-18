# Tech Stack

---
tags: #technical #stack #tools #frameworks
status: updated
priority: critical
phase: mvp
last_updated: 2026-01-20
---

## Overview

Our tech stack is optimized for rapid development and cost efficiency. Every choice prioritizes LLM cost optimization while maintaining response quality. Fala Mestre! is a standalone game; it has no crypto or ad-platform integrations.

> [!note] Selection Criteria
> 1. LLM cost efficiency (77% reduction target)
> 2. Developer productivity
> 3. Scalability path

---

## Stack Summary

```typescript
const techStack = {
  frontend: {
    framework: "Next.js 14 (App Router)",
    language: "TypeScript 5",
    styling: "Tailwind CSS 3",
    components: "shadcn/ui",
    state: "Zustand",
    forms: "React Hook Form + Zod",
    deployment: "Vercel",
    pwa: true
  },
  
  backend: {
    runtime: "Next.js API Routes (Serverless)",
    database: "Neon PostgreSQL (Serverless)",
    orm: "Drizzle ORM (Type-safe, zero overhead)",
    auth: "Lucia Auth (Flexible, lightweight)",
    cache: "Vercel KV (Redis-compatible)",
    storage: "Supabase Storage (images, backups)"
  },
  
  ai: {
    gateway: "OpenRouter (primary) / z.ai direct API (fallback)",
    model: "zhipu/glm-4.7",
    tiers: {
      match_narration: "real-time, <500ms latency, temperature 0.8",
      user_conversation: "assistant persona, <1.5s latency, temperature 0.6"
    }
  },
  
  infrastructure: {
    hosting: "Vercel",
    cdn: "Vercel Edge Network",
    dns: "Cloudflare",
    monitoring: "Vercel Analytics + Sentry"
  },
  
  analytics: {
    product: "First-party analytics_events table (no third-party export)"
  }
};
```

---

## Frontend

### Next.js 14

**Why Next.js?**
- Full-stack framework (frontend + API)
- Server-side rendering for SEO
- Excellent developer experience
- Vercel integration (same company)
- App Router for modern patterns

```typescript
// Example: App Router structure
app/
├── layout.tsx          // Root layout
├── page.tsx            // Home page
├── game/
│   ├── page.tsx        // Game interface
│   └── loading.tsx     // Loading state
├── api/
│   ├── conversation/
│   │   └── route.ts    // AI chat endpoint
│   └── game/
│       └── route.ts    // Game actions
└── globals.css
```

### TypeScript 5

**Why TypeScript?**
- Type safety prevents bugs
- Better IDE support
- Self-documenting code
- Team scalability

```typescript
// Example: Type-safe game state
interface GameState {
  user: {
    id: string;
    team: string;
    money: number;
  };
  season: {
    week: number;
    position: number;
    points: number;
  };
  squad: Player[];
}
```

### Tailwind CSS 3

**Why Tailwind?**
- Rapid UI development
- Consistent design system
- Small production bundle
- Mobile-first by default

```tsx
// Example: Tailwind component
<button className="
  bg-red-600 hover:bg-red-700
  text-white font-semibold
  px-6 py-3 rounded-xl
  transition-colors duration-200
  active:scale-95
">
  Jogar Partida
</button>
```

### shadcn/ui

**Why shadcn/ui?**
- Copy-paste components (own the code)
- Accessible by default
- Highly customizable
- Tailwind-based

```tsx
// Example: Using shadcn components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

<Card>
  <CardHeader>Resultado da Partida</CardHeader>
  <CardContent>
    <Button>Ver Detalhes</Button>
  </CardContent>
</Card>
```

### Rive Animations

**Why Rive?**
- Lightweight vector animations
- Interactive state machines
- React integration
- Designer-friendly workflow

```tsx
// Example: Rive formation card
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';

function FormationCard({ formation }: { formation: string }) {
  const { rive, RiveComponent } = useRive({
    src: '/animations/formation.riv',
    stateMachines: 'FormationState',
    autoplay: true,
  });

  const formationInput = useStateMachineInput(rive, 'FormationState', 'formation');
  
  useEffect(() => {
    if (formationInput) {
      formationInput.value = formation;
    }
  }, [formation]);

  return <RiveComponent />;
}
```

### Zustand

**Why Zustand?**
- Minimal boilerplate
- TypeScript-first
- No providers needed
- Tiny bundle size (1KB)

```typescript
// Example: Game state store
import { create } from 'zustand';

interface GameStore {
  gameState: GameState | null;
  isLoading: boolean;
  setGameState: (state: GameState) => void;
  updatePoints: (points: number) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  isLoading: false,
  setGameState: (gameState) => set({ gameState }),
  updatePoints: (points) => set((state) => ({
    gameState: state.gameState 
      ? { ...state.gameState, user: { ...state.gameState.user, money: points }}
      : null
  })),
}));
```

---

## Backend

### Neon + Drizzle ORM

**Why Neon + Drizzle?**
- Serverless PostgreSQL (faster than Supabase)
- Drizzle ORM: Zero runtime overhead, type-safe
- Better cold start times
- Lower cost at scale
- Excellent TypeScript support

```typescript
// Example: Drizzle schema + Neon client
import { pgTable, serial, text, integer, timestamp, jsonb, boolean, uuid } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const db = drizzle(process.env.DATABASE_URL!, { schema });

// Type-safe query example
const getUser = async (userId: string) => {
  return await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
};
```

### Lucia Auth

**Why Lucia?**
- Lightweight authentication
- Flexible for custom needs
- Better than Supabase Auth for this use case

```typescript
// Example: Lucia auth
import { lucia } from 'lucia';
import { neon } from '@lucia/neon';

const auth = lucia(neon(process.env.DATABASE_URL!));

const session = await auth.createSession(userId, {});
```

### Vercel KV (Redis)

**Why Vercel KV?**
- Edge-compatible
- Simple key-value API
- Perfect for caching
- Pay-per-use

```typescript
// Example: Caching AI responses
import { kv } from '@vercel/kv';

const cacheKey = `response:${hashPrompt(prompt)}`;
const cached = await kv.get(cacheKey);

if (cached) return cached;

const response = await generateAIResponse(prompt);
await kv.set(cacheKey, response, { ex: 3600 }); // 1 hour TTL

return response;
```

---

## AI Integration

### OpenRouter

**Why OpenRouter?**
- Single API for multiple models
- Automatic failover
- Usage analytics
- Cost optimization

```typescript
// Example: OpenRouter call
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'anthropic/claude-3.5-sonnet',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    max_tokens: 1000,
    temperature: 0.7
  })
});
```

### z.ai GML-4.7 Integration

**Why GML-4.7?**
- 96.7% cheaper than Claude models
- Fast response times (<500ms for match narration)
- Good quality for Portuguese generation
- Via OpenRouter with z.ai direct fallback

```typescript
// Two-tier GML-4.7 strategy
interface GMLStrategy {
  tier1_match_narration: {
    purpose: "real-time match commentary",
    temperature: 0.8,
    maxTokens: 120,
    latency: "<500ms",
    caching: "none",  // Always fresh for live matches
    systemPrompt: `
Você é um narrador de futebol brasileiro emocionante.
ESTILO: TV aberta (Globo/SporTV) com gírias locais
REGRAS:
- Seja dramático e apaixonado
- Use gírias: "Golaço!", "É trem!", "Cara, que falta!"
- Crie tensão
- Use nomes dos times brasileiros corretamente
- Seja conciso (máximo 2 frases)
    `
  },
  
  tier2_user_conversation: {
    purpose: "assistant interaction with personality",
    temperature: 0.6,
    maxTokens: 280,
    latency: "<1.5s",
    caching: "semantic",  // 24h cache with 85% similarity threshold
    systemPrompt: `
Você é "Fala Mestre", seu assistente técnico de futebol brasileiro.
PERSONALIDADE:
- Amigável e conhecedor de futebol
- Usa gírias do dia a dia: "mestre", "craque", "baitola"
- Adapte o tom ao usuário (casual, tático ou competitivo)
- Seja encorajador mas honesto

OBJETIVO:
- Ajudar o usuário a gerenciar o time
- Dar conselhos táticos quando relevante
- Explicar conceitos de forma simples
- Manter conversação natural e divertida

REGISTROS:
- Use dados de time e jogadores corretamente
- Seja consistente com o histórico
- Não invente eventos que não aconteceram
- Ofereça 2-4 opções de ação quando apropriado
    `
  }
}
```

### Caching Strategy (60-70% Hit Rate Target)

```typescript
const cacheStrategy = {
  // Layer 1: Static Responses (30% hit rate)
  staticResponses: {
    examples: [
      "welcome_messages",
      "team_selection_prompts",
      "help_responses",
      "error_messages",
      "onboarding_flows"
    ],
    ttl: "permanent",
    storage: "codebase"
  },
  
  // Layer 2: Semantic Cache (25% hit rate)
  semanticCache: {
    implementation: "vector_similarity",
    threshold: 0.85,  // 85% similarity = use cached
    ttl: 86400,  // 24 hours
    storage: "vercel_kv"
  },
  
  // Layer 3: Session Cache (15% hit rate)
  sessionCache: {
    implementation: "context_management",
    ttl: 3600,  // 1 hour
    storage: "vercel_kv"
  },
  
  // Layer 4: Popular Sequences (15% hit rate)
  popularSequences: {
    implementation: "template_based",
    ttl: 172800,  // 48 hours
    storage: "vercel_kv"
  }
};
```

---

## Infrastructure

### Vercel

**Why Vercel?**
- Zero-config deployments
- Global edge network
- Built for Next.js
- Preview deployments
- Analytics included

```yaml
# vercel.json
{
  "framework": "nextjs",
  "regions": ["gru1"],  # Sao Paulo
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

### Cloudflare DNS

**Why Cloudflare?**
- Fast DNS propagation
- DDoS protection
- Free SSL
- Page rules for redirects

---

## Analytics

Gameplay events are stored in the app's own PostgreSQL database (`analytics_events`) and are not sent to third-party analytics or ad platforms.

---

## Development Tools

### Package Manager

```bash
# Using pnpm for speed
pnpm install
pnpm dev
pnpm build
```

### Code Quality

| Tool | Purpose |
|------|---------|
| ESLint | Linting |
| Prettier | Formatting |
| TypeScript | Type checking |
| Husky | Git hooks |
| lint-staged | Pre-commit checks |

### Testing

| Type | Tool | Coverage Target |
|------|------|-----------------|
| Unit | Vitest | 70% |
| Integration | Playwright | Critical paths |
| E2E | Playwright | Smoke tests |

```typescript
// Example: Vitest unit test
import { describe, it, expect } from 'vitest';
import { calculateTeamStrength } from './match-engine';

describe('Match Engine', () => {
  it('calculates team strength correctly', () => {
    const squad = mockSquad();
    const strength = calculateTeamStrength(squad);
    expect(strength).toBeGreaterThan(70);
  });
});
```

---

## Version Requirements

| Technology | Minimum Version | Recommended |
|------------|-----------------|-------------|
| Node.js | 18.17 | 20.x LTS |
| pnpm | 8.0 | 8.x |
| TypeScript | 5.0 | 5.3 |
| Next.js | 14.0 | 14.x |
| React | 18.2 | 18.x |

---

## Cost Estimates

### Monthly Costs by Scale

| Service | 1K Users | 10K Users | 50K Users |
|---------|----------|-----------|-----------|
| Vercel | $0 (Hobby) | $20 (Pro) | $150 |
| Supabase | $0 (Free) | $25 (Pro) | $100 |
| OpenRouter | $50 | $500 | $2,500 |
| Vercel KV | $0 | $10 | $50 |
| **Total** | **$50** | **$555** | **$2,800** |

---

## Related Documents

- [[00-System-Overview]] - Architecture overview
- [[02-Database-Schema]] - Database design
- [[03-API-Design]] - API contracts
- [[05-Caching-Performance]] - Optimization

---

*"The best tool is the one that gets out of your way."*
