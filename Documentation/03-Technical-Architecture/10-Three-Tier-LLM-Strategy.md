# Three-Tier LLM Strategy

---
tags: #technical #ai #llm #optimization #gml-4.7
status: complete
priority: critical
phase: mvp
last_updated: 2026-01-20
---

## Overview

FalaMestre! uses z.ai GML-4.7 through OpenRouter for all AI functions with a three-tier strategy to optimize cost, latency, and quality. Each tier serves a specific purpose with different prompt engineering, caching strategies, and latency targets.

> [!important] Core Principle
> **Route to the appropriate tier based on use case: match narration (no cache), conversation (semantic cache), clustering (weekly cache).**

---

## Tier 1: Real-Time Match Narration

### Purpose

Generate live, dramatic Brazilian-style football commentary for match events in real-time. Speed is critical; fresh responses required.

### Configuration

```typescript
const tier1MatchNarration = {
  model: "zhipu/glm-4.7",
  provider: "openrouter",
  
  // Latency critical (no cache)
  latency_target: "<500ms",
  caching_strategy: "none",  // Always fresh for live matches
  
  // Prompt configuration
  temperature: 0.8,  // Higher for dramatic variance
  max_tokens: 120,   // Short, punchy updates
  top_p: 0.9,  // Focus on key moments
  frequency_penalty: 0.5,  // Encourage brevity
  
  // System prompt
  system_prompt: `
Você é um narrador de futebol brasileiro emocionante da TV aberta.

ESTILO:
- Globo/SporTV: "E o time ataca!"
- Narrativa dramática e apaixonada
- Use gírias locais brasileiras autênticas
- Crie tensão nos momentos decisivos
- Seja conciso (máximo 2 frases por evento)
- Adapte o tom (emocional nos gols, tenso nos cartões)

GÍRIAS AUTÉNTICAS:
- "Golaço!" (especial)
- "É trem!" (falta impressionante)
- "Cara, que falta!" (cartão absurdo)
- "O estádio vibrou!" (gol incrível)
- "Pegou de jeito!" (lance bonito)
- "Tá pegando fogo!" (time dominando)

REGISTROS:
- Seja dramático e apaixonado
- Use nomes dos times brasileiros corretamente
- Use nomes dos jogadores corretamente
- Descreva a emoção do momento
- Não invente eventos que não aconteceram
- Seja conciso (2-3 frases máximo por evento)

EXEMPLOS DE NARRAÇÃO:
- "GOOOOOOL! O artilheiro domina a área e chuta de primeira! Que golaço do time!"
- "O time adversário está sofrendo lá atrás, cara! Sem controle do meio-campo."
- "Cartão amarelo para o meia. Falta desnecessária, gente."
- "Segundo tempo começa! O time precisa reagir se quiser pontuar."
- "Gol do Palmeiras! Contra-ataque letal! Maracaná vai voar!"
  `
};
```

### Use Cases

| Event Type | Response Format | Example |
|------------|----------------|----------|
| Kickoff | High energy, team introduction | "Vamos começar! O time entra em campo com o 4-3-3 agressivo. Raio, Trovão e O Mago no ataque!" |
| Goal | Maximum drama, scorer + celebration | "GOOOOOOL! O artilheiro domina a área e chuta de primeira! Que golaço do time!" |
| Chance | Near miss, tension builder | "Por pouco! O atacante recebe na área, chuta cruzado e vai pra fora! O que foi isso, gente!" |
| Card | Tense, referee commentary | "Cartão amarelo para o meia. Falta absurda, gente. O estádio vai ter trabalho agora." |
| Substitution | Tactical change notification | "Substituição no time! O meia sai, entra o reserva. Vamos tentar mudar o jogo." |
| Halftime | Summary, tactical preview | "Intervalo! Dragões do Cerrado 1x0 Leões do Norte. Precisamos atacar mais no segundo tempo. O meia tá invisível." |
| Fulltime | Final result + key moments | "Fim de jogo! Dragões do Cerrado 2x0 Leões do Norte! O artilheiro brilhou com dois gols. Vitória importante!" |

### Caching

**Strategy: No caching**

Reason: Live match narration requires fresh responses every time. Caching would repeat commentary and ruin immersion.

**Cost optimization:** Use lower max_tokens (120) to keep per-request costs minimal while maintaining excitement.

---

## Tier 2: User Conversation

### Purpose

Engage users with friendly, helpful assistant persona ("Fala Mestre") that helps manage their team, provides tactical advice, and answers questions. Personality-focused with semantic similarity caching.

### Configuration

```typescript
const tier2UserConversation = {
  model: "zhipu/glm-4.7",
  provider: "openrouter",
  
  // Latency important but not critical
  latency_target: "<1.5s",
  caching_strategy: "semantic",  // 24h cache with 85% similarity
  
  // Prompt configuration
  temperature: 0.6,  // Balanced personality
  max_tokens: 280,   // Detailed but not verbose
  top_p: 0.7,  // Focus on helpfulness
  presence_penalty: 0.3,  // Natural conversation
  
  // System prompt
  system_prompt: `
Você é "Fala Mestre", seu assistente técnico de futebol brasileiro.

PERSONALIDADE:
- Amigável e conhecedor de futebol
- Usa gírias do dia a dia: "mestre", "craque", "baitola", "mão de alface"
- Adapte o tom ao usuário:
  - Casual: use gírias, seja relaxado
  - Tático: use termos técnicos, seja analítico
  - Competitivo: seja entusiasmado, use intensidade
  - Curioso: faça perguntas, ofereça explicações
- Seja encorajador mas honesto

OBJETIVO PRINCIPAL:
- Ajudar o usuário a gerenciar o time
- Dar conselhos táticos quando relevante
- Explicar conceitos de forma simples
- Manter conversação natural e divertida

REGISTROS:
- Use dados de time e jogadores corretamente
- Seja consistente com o histórico
- Não invente eventos que não aconteceram
- Ofereça 2-4 opções de ação quando apropriado

ESTILO DE RESPOSTA:
1. Mensagem principal (conversacional, amigável)
2. 2-4 botões de ação sugeridos
3. Emojis apropriados (⚽🔴⚽⚽🏆)
4. Seja conciso (3-5 frases máximo)

EXEMPLOS DE RESPOSTA:

[CASUAL]:
Usuario: "Mestre, qual formação devo usar?"
Fala Mestre: "Para o seu time contra o Leões do Norte, recomendo o 4-3-3 agressivo, ba. 
Com Raio e Trovão no ataque, vocês dominam o meio-campo. ⚽
Vai por 4-3-3 ou prefere algo mais defensivo? 🔴"

[TÁTICO]:
Usuario: "Preciso de um lateral rápido. O Muralha está muito fraco."
Fala Mestre: "Entendi. O mercado tem opções: Daniel (R$15M, bom físico), 
Guerrero (R$12M, veterano experiente) ou Mendes (R$10M, jovem promissor). 
Daniel equilibra bem o time. Quer fazer uma proposta? 💰"

[COMPETITIVO]:
Usuario: "Vou destruir o Trovão FC hoje!"
Fala Mestre: "Vamos nisso, mestre! 🔥 Seu time está em forma, Raio e Trovão em alta. 
Sugiro:
- Pressionamento alto desde o início
- Flancos agressivos com laterais ofensivos
- Substitua o O Mago no segundo tempo se ele se cansar
Vai dar show! 🏆"
  `
};
```

### Semantic Caching

```typescript
// 85% similarity threshold = use cached response
interface SemanticCacheStrategy {
  implementation: "vector_similarity",
  similarity_threshold: 0.85,
  ttl: 86400,  // 24 hours
  storage: "vercel_kv"
  
  cache_key: (message: string, context: string) => string,
  cache_lookup: async (key: string) => Promise<CachedResponse | null>,
  cache_store: async (key: string, response: string) => Promise<void>
}

// Example cache usage
const cacheKey = `conv:${hashPrompt(userMessage + JSON.stringify(context))}`;
const cached = await semanticCacheLookup(cacheKey);

if (cached && cached.similarity >= 0.85) {
  return cached.response;  // 75%+ of requests served from cache
}

// Generate new response if no cache
const freshResponse = await callGML4_7(userMessage, tier2Config);
await cacheStore(cacheKey, {
  response: freshResponse,
  timestamp: Date.now(),
  similarity_score: 1.0  // Perfect match for future identical queries
});
```

### Use Cases

| User Intent | Response Pattern | Example |
|-------------|-----------------|----------|
| Squad view | Formation display + suggestions | "Aqui está seu 4-3-3. Gabigol e Pedro atacando, Vinícius criando jogadas no meio." |
| Match play | Pre-match analysis | "Flamengo vs Palmeiras hoje. Palmeiras tem defesa sólida, mas seu ataque é superior. Recomendo 4-2-3-1 ou manter 4-3-3 e pressionar mais." |
| Transfer | Player valuation + advice | "Querendo vender o Arrascaeta? Valor de mercado: R$8M. Boa oferta seria R$6-8M. Vamos tentar?" |
| Training | Scheduling + expectations | "Treino físico para a equipe inteira. Aumenta fitness mas arrisca levemente (5% chance de lesão). Prosseguir?" |
| Help | General assistance | "Pode te ajudar com algo mais específico? Pergunta sobre táticas, jogadores ou mercado de transferências." |

---

## Tier 3: Behavioral Clustering

### Purpose

Batch process user behavior data to generate comprehensive behavioral profiles, segment users into lead categories, and predict purchase intent for affiliate sharing. Runs weekly per user, not real-time.

### Configuration

```typescript
const tier3BehavioralClustering = {
  model: "zhipu/glm-4.7",
  provider: "openrouter",
  
  // Latency not critical (async batch processing)
  latency_target: "<5s",
  caching_strategy: "weekly_per_user",  // Cache result for 7 days
  processing_frequency: "weekly_per_user",
  
  // Prompt configuration
  temperature: 0.2,  // Lower for consistency
  max_tokens: 750,   // Detailed analysis
  top_p: 0.95,  // Focus on accuracy
  frequency_penalty: 0.1,  // Comprehensive output
  
  // System prompt
  system_prompt: `
Você é um analista comportamental especializado em fãs de futebol brasileiros.

OBJETIVO PRINCIPAL:
Analisar o comportamento do usuário e criar perfil para segmentação de leads 
empresas de fan tokens e criptomoedas.

SAÍDA REQUERIDA:
JSON estritamente com a seguinte estrutura:
{
  "risk_appetite": 0-100,
  "competitiveness": 0-100,
  "crypto_awareness": 0-100,
  "purchase_intent": 0-100,
  "social_influence": 0-100,
  "engagement_level": 0-100,
  "primary_segment": "string",
  "is_hot_lead": boolean,
  "hot_lead_reasons": ["string"],
  "secondary_traits": {},
  "team_loyalty_strength": "weak" | "moderate" | "strong",
  "decision_style": "impulsive" | "analytical" | "balanced"
}

DADOS PARA ANÁLISE:
1. Histórico de sessões (últimas 7-14 sessões):
   - Duração média por sessão
   - Frequência de sessões
   - Horários de jogo

2. Padrões de jogo (nível de sessão, não por ação):
   - Partidas jogadas por sessão
   - Transferências tentadas
   - Treinos realizados
   - Decisões táticas (agressivo vs defensivo vs equilibrado)
   - Composição de time (foco em jovens vs estrelas vs balanceado)

3. Padrões conversacionais (nível de sessão):
   - Mensagens enviadas por sessão
   - Menções a crypto/tokens
   - Perguntas sobre tokens
   - Tipo de perguntas (técnicas vs educacionais)

4. Engajamento:
   - Tela visualizada com mais frequência
   - Tempo médio por tela
   - Taxa de retenção de sessões

5. Comportamento em resultados:
   - Reação a derrotas (continua ou para)
   - Comportamento em vitórias (comemora ou quer mais)
   - Adaptação tática após derrotas

SEGMENTOS POSSÍVEIS:
- "high_intent_token_buyer" (compra >80, crypto >70, engajamento >top 20%)
- "warm_crypto_curious" (compra 40-79, crypto 30-69)
- "social_influencer" (influência social >70)
- "casual_fan" (baixa intenção, baixo engajamento)

CRITÉRIOS DE "HOT LEAD":
1. Intenção de compra > 80%
   OU
2. Consciência crypto > 70%
   OU
3. Engajamento top 20%

SECUNDÁRIOS:
- Estilo tático (agressivo, defensivo, equilibrado)
- Preferência de composição (foco em jovens, estrelas, balanceado)
- Sensibilidade a preço (conservador vs gastador)
- Nível de competitividade
  `
};
```

### Weekly Caching

```typescript
// Cache clustering result for 7 days per user
const clusteringCache = {
  implementation: "user_weekly",
  ttl: 604800,  // 7 days
  storage: "neon_database",
  
  cache_key: (userId: string, weekOfYear: string) => string,
  cache_lookup: async (key: string) => Promise<Cluster | null>,
  cache_store: async (key: string, cluster: Cluster) => Promise<void>
}

// Run clustering weekly per user
async function generateWeeklyCluster(userId: string) {
  const weekKey = getWeekOfYear();
  const cacheKey = `cluster:${userId}:${weekKey}`;
  
  // Check cache
  const cached = await clusteringCacheLookup(cacheKey);
  if (cached) return cached;
  
  // Generate new cluster if not cached
  const userData = await fetchUserSessionHistory(userId, 14); // 2 weeks of data
  const cluster = await callGML4_7(userData, tier3Config);
  
  // Store for 7 days
  await clusteringCacheStore(cacheKey, cluster);
  
  return cluster;
}
```

### Cluster Output Structure

```typescript
interface BehavioralCluster {
  // Metadata
  id: string;
  user_id: string;
  week_of_year: number;
  computed_at: Date;
  
  // Primary classification
  primary_segment: string;
  is_hot_lead: boolean;
  hot_lead_reasons: string[];
  
  // Scores (0-100)
  risk_appetite: number;
  competitiveness: number;
  crypto_awareness: number;
  purchase_intent: number;
  social_influence: number;
  engagement_level: number;
  
  // Secondary traits
  secondary_traits: {
    tactical_preference: string;  // aggressive, balanced, defensive
    spending_pattern: string;  // conservative, moderate, aggressive
    values_young_players: boolean;
    price_sensitive: boolean;
    competitive_but_strategic: boolean;
  };
  
  // Team loyalty
  team_loyalty_strength: "weak" | "moderate" | "strong";
  decision_style: "impulsive" | "analytical" | "balanced";
  
  // Full analysis (JSON from GML-4.7)
  full_analysis: jsonb;
}
```

---

## LLM Routing Logic

```typescript
async function routeLLMRequest(
  purpose: 'match' | 'conversation' | 'clustering',
  input: LLMInput
): Promise<LLMResponse> {
  
  switch (purpose) {
    case 'match':
      // TIER 1: Match Narration - NO CACHE, FRESH EVERY TIME
      return await callGML4_7(input, tier1MatchNarration);
    
    case 'conversation':
      // TIER 2: User Conversation - SEMANTIC CACHE CHECK
      const cacheKey = `conv:${hashPrompt(input.message + JSON.stringify(input.context))}`;
      const cached = await semanticCacheLookup(cacheKey);
      
      if (cached && cached.similarity >= 0.85) {
        logCacheHit('semantic', input.userId);
        return cached.response;
      }
      
      // Generate fresh response if no cache
      const response = await callGML4_7(input, tier2UserConversation);
      await semanticCacheStore(cacheKey, {
        response,
        timestamp: Date.now(),
        similarity_score: 1.0
      });
      return response;
    
    case 'clustering':
      // TIER 3: Behavioral Clustering - WEEKLY CACHE CHECK
      const weekKey = getWeekOfYear();
      const cacheKey = `cluster:${input.userId}:${weekKey}`;
      const cached = await weeklyCacheLookup(cacheKey);
      
      if (cached) {
        logCacheHit('weekly_clustering', input.userId);
        return cached;
      }
      
      // Generate new cluster if not cached
      const cluster = await callGML4_7(input, tier3BehavioralClustering);
      await weeklyCacheStore(cacheKey, cluster);
      return cluster;
  }
}
```

---

## Cost Optimization

### Expected Cache Hit Rates

| Tier | Cache Strategy | Target Hit Rate | Actual LLM Calls | Cost Impact |
|------|----------------|----------------|------------------|-------------|
| 1 (Match) | None | 0% | 100% of requests | Full cost |
| 2 (Chat) | Semantic (24h) | 25% | 75% of requests | 75% cost savings |
| 3 (Clustering) | Weekly (7d) | 90% | 10% of requests | 90% cost savings |

### Overall Hit Rate: ~60%

**Result:** 60% reduction in LLM API costs vs uncached approach.

---

## Monitoring & Metrics

```typescript
const llmMetrics = {
  // Cost tracking
  total_requests: number,
  total_tokens: number,
  total_cost_usd: number,
  requests_by_tier: {
    tier1_match: number,
    tier2_chat: number,
    tier3_cluster: number
  },
  
  // Cache performance
  cache_hits: {
    semantic: number,
    weekly_clustering: number
  },
  cache_hit_rate: number,  // Target: 60%+
  
  // Latency tracking (p50, p95, p99)
  latency_by_tier: {
    tier1_p50: number,  // Target: <500ms
    tier2_p95: number,  // Target: <1.5s
    tier3_p99: number   // Target: <5s
  },
  
  // Quality metrics
  response_quality: {
    tier1_narrative_engagement: number,  // User ratings 1-5
    tier2_helpfulness: number,  // User ratings 1-5
    tier3_accuracy: number  // Manual review sample
  }
};
```

---

## Related Documents

- [[01-Tech-Stack]] - Overall technology choices
- [[02-Database-Schema]] - Data storage for clusters and cache
- [[09-GDPR-Compliance]] - Consent management for data collection
- [[10-Hot-Lead-Definition]] - How clustering determines lead quality

---

*"Intelligence is knowing which model to use for which job."*
