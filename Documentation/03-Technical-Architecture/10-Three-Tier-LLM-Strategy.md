# LLM Tier Strategy

---
tags: #technical #ai #llm #optimization #gml-4.7
status: complete
priority: critical
phase: mvp
last_updated: 2026-01-20
---

## Overview

FalaMestre! uses z.ai GML-4.7 through OpenRouter for all AI functions with a tiered strategy to optimize cost, latency, and quality. Each tier serves a specific purpose with different prompt engineering, caching strategies, and latency targets.

> [!note] The original design had a third tier that profiled user behaviour. It was removed: Fala Mestre! is a standalone game and does not profile players.

> [!important] Core Principle
> **Route to the appropriate tier based on use case: match narration (no cache), conversation (semantic cache).**

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

## LLM Routing Logic

```typescript
async function routeLLMRequest(
  purpose: 'match' | 'conversation',
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

Match narration is never cached, so overall savings depend on the chat/narration mix.

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
    tier2_chat: number
  },
  
  // Cache performance
  cache_hits: {
    semantic: number
  },
  cache_hit_rate: number,
  
  // Latency tracking (p50, p95, p99)
  latency_by_tier: {
    tier1_p50: number,  // Target: <500ms
    tier2_p95: number   // Target: <1.5s
  },
  
  // Quality metrics
  response_quality: {
    tier1_narrative_engagement: number,  // User ratings 1-5
    tier2_helpfulness: number   // User ratings 1-5
  }
};
```

---

## Related Documents

- [[01-Tech-Stack]] - Overall technology choices
- [[02-Database-Schema]] - Data storage
- [[04-AI-LLM-Strategy]] - AI architecture

---

*"Intelligence is knowing which model to use for which job."*
