# AI/LLM Strategy

---
tags: #technical #ai #llm #claude #openrouter #prompts
status: complete
priority: critical
phase: mvp
last_updated: 2026-01-18
---

## Overview

Fala Mestre! uses a tiered AI architecture to balance cost, latency, and quality. The system routes requests to appropriate models based on complexity and user value.

> [!important] Core Principle
> Use the cheapest model that delivers acceptable quality for each task.

---

## Model Architecture

### Tiered System

```
                        +-------------------+
                        |   User Request    |
                        +-------------------+
                                 |
                                 v
                        +-------------------+
                        |  Intent Classifier|
                        |    (Haiku)        |
                        +-------------------+
                                 |
              +------------------+------------------+
              |                  |                  |
              v                  v                  v
     +----------------+  +----------------+  +----------------+
     |   TIER 1       |  |   TIER 2       |  |   TIER 3       |
     |   Haiku        |  |   Sonnet       |  |   Sonnet+      |
     |   (85%)        |  |   (12%)        |  |   (3%)         |
     +----------------+  +----------------+  +----------------+
     | Quick replies  |  | Match sims     |  | User clustering|
     | Intent detect  |  | Negotiations   |  | Complex analysis|
     | Confirmations  |  | Tactical advice|  | Fraud detection|
     +----------------+  +----------------+  +----------------+
```

### Model Specifications

| Tier | Model | Latency Target | Cost/1K Requests | Use Cases |
|------|-------|----------------|------------------|-----------|
| 1 | Claude 3.5 Haiku | <500ms | $0.15 | Intent detection, quick responses |
| 2 | Claude 3.5 Sonnet | <2000ms | $1.50 | Match narratives, negotiations |
| 3 | Claude 3.5 Sonnet (extended) | <5000ms | $5.00 | Clustering, deep analysis |

---

## Routing Logic

### Intent-Based Routing

```typescript
enum ModelTier {
  HAIKU = 'tier_1',
  SONNET = 'tier_2',
  SONNET_EXTENDED = 'tier_3'
}

function selectModelTier(intent: string, context: RequestContext): ModelTier {
  // Tier 1: Simple, frequent operations
  const tier1Intents = [
    'greeting',
    'help',
    'navigation',
    'confirm',
    'cancel',
    'show_squad',
    'show_standings',
    'show_balance'
  ];
  
  // Tier 2: Complex, interactive operations
  const tier2Intents = [
    'play_match',
    'transfer_search',
    'transfer_negotiate',
    'tactical_advice',
    'training_recommend',
    'season_preview'
  ];
  
  // Tier 3: Analytical, batch operations
  const tier3Intents = [
    'user_clustering',
    'fraud_detection',
    'personalized_onboarding',
    'season_analysis'
  ];
  
  if (tier1Intents.includes(intent)) return ModelTier.HAIKU;
  if (tier2Intents.includes(intent)) return ModelTier.SONNET;
  if (tier3Intents.includes(intent)) return ModelTier.SONNET_EXTENDED;
  
  // Default to Tier 2 for unknown intents
  return ModelTier.SONNET;
}
```

### Quality Escalation

```typescript
async function executeWithEscalation(
  prompt: string,
  tier: ModelTier
): Promise<AIResponse> {
  try {
    const response = await callModel(tier, prompt);
    
    // Quality check
    if (isResponsePoor(response)) {
      // Escalate to higher tier
      const nextTier = escalateTier(tier);
      if (nextTier) {
        return callModel(nextTier, prompt);
      }
    }
    
    return response;
  } catch (error) {
    // Fallback chain
    return handleModelFailure(error, prompt, tier);
  }
}
```

---

## Prompt Engineering

### System Prompts

**Base System Prompt (All Tiers):**

```typescript
const baseSystemPrompt = `
You are the AI engine for "Fala Mestre!", a Brazilian football management game.

IDENTITY:
- You are a passionate, knowledgeable football assistant
- You speak Brazilian Portuguese naturally
- You understand Brazilian football culture deeply
- You're enthusiastic but not over-the-top

COMMUNICATION STYLE:
- Keep responses concise (2-4 sentences for simple queries)
- Use emojis sparingly but effectively (⚽🔥🏆💪)
- Never use more than 2 emojis per response
- Sound like a friend, not a robot
- Match the user's energy level

GAME RULES:
- Player ratings range from 60-99
- Match results are based on team strength + tactics + randomness (15-20%)
- Currency is Brazilian Reais (R$)
- Points system: wins earn 50-150 points

RESPONSE FORMAT:
- Always provide clear next actions
- Use cards for structured data (squads, results, players)
- Keep narrative engaging but brief
`;
```

**Match Simulation Prompt (Tier 2):**

```typescript
const matchSimulationPrompt = `
${baseSystemPrompt}

TASK: Generate an engaging match narrative.

MATCH CONTEXT:
- Home: {homeTeam} (Strength: {homeStrength})
- Away: {awayTeam} (Strength: {awayStrength})
- Competition: {competition}
- Final Score: {homeScore}-{awayScore} (pre-calculated)

REQUIREMENTS:
1. Generate 5-8 key moments throughout the 90 minutes
2. Goals must occur at realistic times (not all in injury time)
3. Include near-misses, good saves, tactical moments
4. Build tension and drama appropriately
5. Mention specific players by name
6. Brazilian commentary style (passionate!)

OUTPUT FORMAT:
{
  "commentary": "Full narrative text",
  "keyMoments": [
    { "minute": 23, "type": "goal", "team": "home", "player": "Raio", "description": "..." }
  ],
  "manOfTheMatch": "Player Name"
}
`;
```

**Transfer Negotiation Prompt (Tier 2):**

```typescript
const negotiationPrompt = `
${baseSystemPrompt}

TASK: Roleplay as the selling club's representative.

NEGOTIATION CONTEXT:
- Player: {playerName} ({position}, {overall} overall)
- Player Value: R$ {marketValue}
- Selling Club: {sellingClub}
- Buyer Offer: R$ {offerAmount}
- Club Financial State: {financialState}

NEGOTIATION RULES:
- Accept if offer >= 90% of value
- Counter-offer if offer is 50-90% of value
- Reject if offer < 50% of value
- Consider club financial need
- Consider player's desire to move

PERSONALITY TYPES:
- Tough: "That's insulting. We want at least R$ X."
- Fair: "We can work with that. How about R$ X?"
- Friendly: "We'd love to do business! Can you stretch to R$ X?"

Use personality: {negotiatorPersonality}

OUTPUT:
{
  "response": "accepted" | "counter" | "rejected",
  "counterOffer": number | null,
  "message": "Dialogue in Portuguese",
  "playerReaction": "Player's reaction to the move"
}
`;
```

**User Clustering Prompt (Tier 3):**

```typescript
const clusteringPrompt = `
${baseSystemPrompt}

TASK: Analyze user behavior and assign to marketing clusters.

USER DATA:
${JSON.stringify(userData, null, 2)}

CLUSTER DEFINITIONS:

1. CASUAL_FAN
   - Plays <5 sessions/week
   - Short sessions (<10 min)
   - Skips narrative often
   - Price-sensitive
   
2. TACTICAL_MASTER
   - Changes formations frequently
   - Reads all tactical info
   - Long sessions
   - Values depth over speed
   
3. SOCIAL_COMPETITOR
   - High tournament participation
   - Shares achievements
   - Cares about rankings
   - Responsive to challenges
   
4. COLLECTOR
   - High transfer activity
   - Squad variety focus
   - Achievement hunter
   - Completionist tendencies
   
5. STORY_ENTHUSIAST
   - Never skips narrative
   - Long read times
   - Engages with all content
   - Values immersion

ANALYZE:
1. Primary cluster assignment
2. Secondary cluster (if any)
3. Cluster confidence (0-1)
4. Key behavioral signals
5. Churn risk (0-1)
6. Conversion probability (0-1)
7. Estimated LTV

OUTPUT:
{
  "primaryCluster": "string",
  "secondaryCluster": "string | null",
  "confidence": number,
  "signals": ["signal1", "signal2"],
  "churnRisk": number,
  "conversionProbability": number,
  "estimatedLTV": number,
  "recommendations": ["action1", "action2"]
}
`;
```

---

## OpenRouter Integration

### Configuration

```typescript
const openRouterConfig = {
  baseUrl: 'https://openrouter.ai/api/v1',
  
  models: {
    haiku: 'anthropic/claude-3.5-haiku',
    sonnet: 'anthropic/claude-3.5-sonnet',
    sonnetExtended: 'anthropic/claude-3.5-sonnet'
  },
  
  defaultParams: {
    temperature: 0.7,
    max_tokens: 1000,
    top_p: 0.9
  },
  
  tierParams: {
    tier_1: {
      model: 'anthropic/claude-3.5-haiku',
      max_tokens: 500,
      temperature: 0.5
    },
    tier_2: {
      model: 'anthropic/claude-3.5-sonnet',
      max_tokens: 1500,
      temperature: 0.7
    },
    tier_3: {
      model: 'anthropic/claude-3.5-sonnet',
      max_tokens: 3000,
      temperature: 0.6,
      // Extended thinking for complex analysis
    }
  }
};
```

### API Call Implementation

```typescript
async function callOpenRouter(
  tier: ModelTier,
  systemPrompt: string,
  userMessage: string
): Promise<AIResponse> {
  const config = openRouterConfig.tierParams[tier];
  
  const response = await fetch(`${openRouterConfig.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://falamestre.ai',
      'X-Title': 'Fala Mestre!'
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: config.max_tokens,
      temperature: config.temperature,
      top_p: openRouterConfig.defaultParams.top_p
    })
  });
  
  if (!response.ok) {
    throw new AIServiceError(response.status, await response.text());
  }
  
  const data = await response.json();
  
  return {
    content: data.choices[0].message.content,
    model: data.model,
    usage: data.usage,
    latency: Date.now() - startTime
  };
}
```

---

## Fallback Strategy

### Fallback Chain

```
Primary: OpenRouter (Claude)
    |
    v (if fails)
Fallback 1: Direct Anthropic API
    |
    v (if fails)
Fallback 2: OpenAI GPT-4
    |
    v (if all fail)
Fallback 3: Template Responses
```

### Template Responses

For when all AI services are unavailable:

```typescript
const fallbackTemplates = {
  greeting: [
    "Fala, mister! Pronto pra mais um jogo?",
    "E aí! O que vamos fazer hoje?"
  ],
  
  match_start: [
    "Bora! Vou simular a partida...",
    "Preparado? Vamos ver como o time se sai!"
  ],
  
  error: [
    "Opa, deu um probleminha aqui. Tenta de novo?",
    "Eita, algo não funcionou. Um momento..."
  ]
};

function getTemplateResponse(intent: string): string {
  const templates = fallbackTemplates[intent] || fallbackTemplates.error;
  return templates[Math.floor(Math.random() * templates.length)];
}
```

---

## Caching Strategy

### Response Caching

```typescript
interface CacheConfig {
  // Cache similar prompts
  similarityThreshold: 0.95;
  
  // TTL by response type
  ttl: {
    standings: 3600,      // 1 hour (updates after matches)
    player_info: 86400,   // 24 hours (static data)
    match_narrative: 0,   // Never cache (unique each time)
    tactical_advice: 1800 // 30 minutes
  };
}

async function getCachedOrGenerate(
  cacheKey: string,
  ttl: number,
  generateFn: () => Promise<string>
): Promise<string> {
  // Check cache
  const cached = await kv.get(cacheKey);
  if (cached) return cached;
  
  // Generate fresh
  const response = await generateFn();
  
  // Cache if appropriate
  if (ttl > 0) {
    await kv.set(cacheKey, response, { ex: ttl });
  }
  
  return response;
}
```

### Semantic Caching

```typescript
function generateSemanticCacheKey(
  intent: string,
  gameState: Partial<GameState>
): string {
  // Normalize to reduce cache misses
  const normalized = {
    intent,
    team: gameState.team,
    week: gameState.week,
    formation: gameState.formation
  };
  
  return `ai:${hashObject(normalized)}`;
}
```

---

## Cost Optimization

### Monthly Cost Projections

| Users | Tier 1 (85%) | Tier 2 (12%) | Tier 3 (3%) | Total |
|-------|--------------|--------------|-------------|-------|
| 1,000 | $13 | $18 | $15 | ~$50 |
| 10,000 | $130 | $180 | $150 | ~$500 |
| 50,000 | $650 | $900 | $750 | ~$2,500 |
| 100,000 | $1,300 | $1,800 | $1,500 | ~$5,000 |

*Assumes 300 requests/user/month*

### Optimization Techniques

1. **Prompt Compression**: Minimize system prompt tokens
2. **Response Length Limits**: Cap max_tokens appropriately
3. **Caching**: 40-60% cache hit rate target
4. **Batching**: Batch Tier 3 operations (clustering)
5. **Off-Peak Processing**: Run analysis during low-traffic hours

---

## Monitoring & Quality

### Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Tier 1 Latency (p95) | <500ms | >800ms |
| Tier 2 Latency (p95) | <2000ms | >3000ms |
| Error Rate | <1% | >2% |
| Cache Hit Rate | >50% | <30% |
| Monthly Cost/User | <$0.50 | >$1.00 |

### Quality Scoring

```typescript
interface QualityMetrics {
  // Automated checks
  responseLength: boolean;    // Not too short/long
  hasRequiredFields: boolean; // JSON valid
  languageCorrect: boolean;   // Portuguese detected
  
  // User signals
  userContinued: boolean;     // Didn't abandon
  userSatisfied: boolean;     // Positive next action
  
  // Composite score
  qualityScore: number;       // 0-100
}
```

---

## Future: Fine-Tuned Model

### Phase 2: Distillation Strategy

```
Phase 1 (Current):
- Use Claude via OpenRouter
- Collect high-quality logs
- Build training dataset

Phase 2 (50K+ users):
- Fine-tune Llama 3 8B
- Deploy on Nebius AI
- 10x cost reduction
- Owned intellectual property
```

### Training Data Collection

```typescript
interface TrainingExample {
  systemPrompt: string;
  userMessage: string;
  aiResponse: string;
  
  // Quality signals
  userContinued: boolean;
  intentMatched: boolean;
  manualRating?: number;
  
  // Metadata
  tier: ModelTier;
  timestamp: string;
}
```

---

## Related Documents

- [[00-System-Overview]] - Architecture overview
- [[01-Tech-Stack]] - Technology stack
- [[05-Caching-Performance]] - Caching details
- [[02-Analytics-Clustering]] - Clustering implementation

---

*"AI should feel like magic, not machinery."*
