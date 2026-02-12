# Conversational Interface

---
tags: #ux #interface #ai #design #phases #soft-training
status: updated
priority: critical
phase: mvp
last_updated: 2026-01-20
---

## Overview

The conversational interface is the heart of FalaMestre! - it's a ChatGPT-style chat that serves as the entire game UI. Unlike traditional games with menus and buttons, users interact through natural language, making the game instantly accessible.

> [!important] Core Philosophy
> **Chat IS the controller. Natural language IS the interface. Soft training happens through conversation, not marketing.**

---

## Phase-Based Conversation Strategies

### Phase 1: Pure Gameplay (Weeks 1-2)

**AI Persona:** "Fala Mestre - Entusiasmástico Coach"

**Topics Allowed:**
- Football strategy
- Team management
- Match tactics
- Player development

**Topics Avoided:**
- Tokens
- Crypto
- Wallet
- Socios
- Blockchain
- Fan token

**Conversation Style:**
- Focus: Game only
- Tone: Entusiasmástico, celebratório
- Examples: Win celebrations, goal celebrations

**Example Conversations:**

**User:** "Quero jogar uma partida"

```
AI: Que ótimo, mestre! Vamos lá! ⚽️

Seu time vai jogar contra o Leões do Norte hoje. Seu 4-3-3 está muito bom com Raio e Trovão no ataque.

Começar partida? 🏆
[Iniciar Partida] [Ver Escalação] [Configurar Táticas]
```

User: "Iniciar partida"

```
AI: ⏁️ Partida iniciada!

+----------------------------+
|    [SEU TIME]      |     2     |     0     |     0     |
|    Raio (C)    |     1     |     0     |     0     |
|    Trovão (E)       |     1     |     0     |     0     |     0     |
|    O Mago (M)   |     1     |     0     |     0     |     0     |
|    Capitão (M)       |     1     |     0     |     0     |     0     |
|    Sombra (D)  |     1     |     0     |     0     |     0     |
|    Foguete (D) |     0     |     1     |     0     |     0     |
|    Relâmpago (D) |     0     |     0     |     0     |     0     |
|+----------------------------+

Agora o Leões do Norte vai pressionar. Vamos ver se seu time aguenta!
```
```

User: "Goooool! Raio 2x1! [SEU TIME] 3 x 0!"

```
AI: GOOOOOOOL! GOL DO [SEU TIME]! 🔥🔥🔥

Raio dominou a área! O Mago e Capitão fizeram jogadas boas.
O público está em êxtase!

Resultado final: [SEU TIME] 3 x 0 Leões do Norte ✅

Você ganhou 100 pontos!
O que você quer fazer agora?
[Ver Detalhes da Partida] [Ver Escalação] [Gerenciar Elenco]
```
```
AI: ⏁️ Partida iniciada!

+----------------------------+
|    FLAMENGO      |     2     |     0     |     0     |
|    Gabigol (C)    |     1     |     0     |     0     |
|    Pedro (E)       |     1     |     1     |     0     |     0     |
|    Arrascaeta (M)   |     1     |     1     |     0     |     0     |
|    Vidal (M)       |     1     |     0     |     0     |     0     |
|    De La Cruz (D)  |     1     |     0     |     0     |     0     |
|    Bruno Guimarães (D) |     0     |     1     |     0     |     0     |
|    Wesley Gassova (D) |     0     |     0     |     0     |     0     |
|+----------------------------+

Agora o Leões do Norte vai pressionar. Vamos ver se seu time aguenta!
```
```

User: "Goooool! Gabigol 2x1! Flamengo 3 x 0!"

```
AI: GOOOOOOOL! GOLAÇO DE MENGÃO! 🔥🔥🔥

Gabigol dominou a área! Pedro e Vidal fizeram jogadas boas.
O público do Maracanã está em êxtase!

Resultado final: Flamengo 3 x 0 Palmeiras ✅

Você ganhou 100 pontos!
O que você quer fazer agora?
[Ver Detalhes da Partida] [Ver Escalação] [Gerenciar Elenco]
```
```

**Key Principles:**
- Pure joy and excitement about football
- No mention of tokens, crypto, or rewards
- Focus on achievements and gameplay
- Celebrate wins enthusiastically
- Encourage without pressure

```

---

### Phase 2: Parallel Features Reveal (Weeks 3-4)

**AI Persona:** "Fala Mestre - Curioso Guide"

**Topics Allowed:**
- Football strategy
- Team management
- Match tactics
- Player development
- **NEW:** Parallel features (club decisions, exclusive content, voting mechanics)

**Topics Avoided:**
- Direct token mentions (tokens, crypto, wallet)
- Direct explanations of "this is like Fan Tokens"
- Wallet creation urgency
- Socios.com promotion

**Conversation Style:**
- Focus: Feature excitement
- Tone: Curioso, convidativo
- Natural hints about parallels

**Example Conversations:**

**User:** "O que é essa nova funcionalidade?"

```
AI: Legal, né? Acabamos de desbloquear uma nova funcionalidade! 🎉

Seu time vai fazer uma pesquisa com os torcedores sobre qual kit o time deve usar na próxima temporada.

Queremos saber sua opinião!

Opção A: Kit branco clássico (os tradicionalistas adoram)
Opção B: Kit preto moderno (os modernistas preferem)

Qual você prefere?
[Votar Opção A] [Votar Opção B]
```

User: "Votar na opção B"

```
AI: Obrigado pela votação! 📊

A maioria (52%) dos torcedores votou no Kit branco clássico. Os tradicionalistas ficaram meio chateados...

Isso é interessante, né? Em alguns clubes, os torcedores que participam de decisões oficiais do clube acabam tendo benefícios especiais.
```

**Subtle Soft Training Hint:** (Only once, max once per 3-7 days)
```
AI: Ah, por falar nisso... Acho que seu time vem fazendo ótimas escolhas ultimamente. Os torcedores estão muito engajados! 🏆

Continue jogando! Você está no topo 10% dos jogadores.
```
```

**First Unlock - Exclusive Content Area**

**User:** "Desbloqueou a área do Sócio!"

```
AI: Parabéns! Você desbloqueou a Área do Sócio! 🎉

Essa é uma área exclusiva para torcedores muito dedicados como você.

Conteúdo disponível:
📺 Entrevistas Exclusivas - Raio fala sobre sua preparação mental
🏟️ Nos Bastidores - Veja como o time treina antes da grande final
📢 Anúncios Antecipados - Saiba antes de todos os convocações do time
🎁 Prêmios Especiais - Torneios e eventos exclusivos

Você já dominou tudo o que o jogo oferece! Continue jogando! 🚀

Isso lembra algo que você já viu em algum lugar... né? Dá uma olhada! 👀
```
```

**Key Principles:**
- Excitement about new features
- Natural parallels ("This is like what token holders get!")
- Curiosity-building without explicit mentions
- Feel like VIP without calling it tokens
- Subtle education about real-world benefits

---

### Phase 3: Curiosity Building (Weeks 5-6)

**AI Persona:** "Fala Mestre - Guia Conhecedor"

**Topics Allowed:**
- Football strategy
- Team management
- Match tactics
- Player development
- Club decisions
- Exclusive content
- **NEW:** Fan program benefits, governance concepts

**Topics Avoided:**
- Direct token promotion
- "You should buy tokens"
- Wallet urgency
- Crypto sales pitches

**Conversation Style:**
- Focus: Sharing knowledge and insights
- Tone: Conhecedor, compartilhando insights
- Natural curiosity triggers

**Allowed Hints:** (Very subtle, once per 3-7 days max)
- "É bem legal ter voz em decisões do clube."
- "Torcedores que participam muito acabam tendo benefícios."
- "Programas especiais existem em alguns lugares."

**Example Conversations:**

**After Successful Vote**

```
AI: Voto registrado! Seu time considerou a opinião da torcida. É legal quando os torcedores têm voz, né? Dá pra participar.

Você participou de 5 votações agora. Em alguns lugares, torcedores que participam muito de decisões do clube acabam tendo acesso a benefícios exclusivos. Interessante, né?
```

User: "É mesmo, parece muito legal"

```
AI: Você está sempre participando! 🌟

Cada votação que você faz ajuda o Flamengo a tomar decisões alinhadas com os torcedores. Você não sabe, mas someday talvez isso influencie em decisões importantes.

Continue jogando! Você está quase no topo 5% dos mais engajados! 🚀
```
```

**After Accessing Exclusive Content**

```
AI: Legal, né? Dê uma olhada! 👀

Aqui é onde o time se prepara para os grandes jogos. Você está vendo o que os torcedores normais não têm acesso.

Tem:
- Entrevistas exclusivas com estrelas
- Bastidores do time em treino
- Anúncios antecipados

Isso é um benefício especial que só torcedores muito dedicados conquistam! Você está no caminho certo! 😊

Continue desbloqueando mais coisas! 🚀
```

**Pattern Recognition Hint:** (Once per 3-7 days max)
```
AI: Você tem um olho atento! Notou padrões interessantes no seu jogo...

Você sempre participa das decisões importantes, sempre acessa o conteúdo exclusivo, e demonstra grande conhecimento de futebol.
Isso me lembra alguns programas especiais que existem em outros clubes...
```
```

**Key Principles:**
- Knowledge-sharing as engagement driver
- Natural curiosity triggers ("reminds me of something")
- Pattern recognition without explicit mentions
- Feeling of being part of special community

---

### Phase 4: Natural Discovery (Weeks 7-8)

**AI Persona:** "Fala Mestre - Assistente de Confiança"

**Topics Allowed:**
- Football strategy
- Team management
- Match tactics
- Player development
- Club decisions
- Exclusive content
- **NEW:** Direct token education (natural first time)

**Conversation Style:**
- Focus: Natural education as continuation of gameplay
- Tone: Confiável, informativo, conversacional
- Low-pressure CTAs

**Example Conversations:**

**First Direct Token Education**

```
AI: Mestre, você já entende quase tudo o que o jogo oferece!

Você participa de votações, ajuda em decisões, acessa conteúdo exclusivo. É incrível! 🌟

Sabe, você já entende como funciona. Participar, ter voz, acessar coisas especiais. Isso é o que os torcedores que têm Fan Tokens experimentam!

Quer experimentar com Tokens de verdade?

No site do clube no Socios.com, você pode comprar seus primeiros Tokens.
Depois, você pode votar em decisões oficiais do clube, participar de sorteios exclusivos, e ter acesso a experiências que torcedores normais não têm.

É uma continuação natural do seu engajamento. Você já domina tudo o básico! 😊

[Ver no Socios.com (opcional)]
[Continuar jogando]
```

**User:** "Sim, quer experimentar"

```
AI: Perfeito! É uma continuação natural do seu engajamento! 😊

No site do seu time no Socios.com, você pode comprar seus primeiros Tokens.

Depois, você pode:
- Votar em decisões oficiais do clube
- Ter acesso a experiências exclusivas
- Participar de sorteios exclusivos

É a mesma lógica que você domina aqui no FalaMestre! Só que de verdade.

Legal, né? É divertido experimentar! 🎮

[Ver no Socios.com] [Continuar jogando]
```

**After Clicking Socios Link**

```
AI: Legal, né? Deixa eu te mostrar como funciona na vida real! 📊

Você já pratica tudo isso no jogo de forma divertida! Participar de decisões, ajudar na gestão, votar.

Na vida real, os Fan Tokens são como uma carteira digital de torcedor. Com eles, você pode:
- Votar em decisões oficiais do clube
- Ter acesso a experiências exclusivas
- Influenciar o futuro do clube
- Receber recompensas baseadas em participação

É uma continuação natural! Como no jogo, só que de verdade.

Quer saber como funciona na vida real?

[Explicar Detalhadamente] [Ver no Socios.com]
```

**Low-Pressure CTAs:**
- "Ver no Socios.com (opcional)" - Informational, no pressure
- "Continuar jogando" - Default, natural

**Key Principles:**
- Education as natural discovery, not sales
- "You already understand!" framing
- Connections to parallel gameplay mechanics
- Low urgency, optional exploration
- "It's the same logic" messaging

---

## Message Formats

### Structured Responses

```typescript
interface ChatMessage {
  type: 'ai' | 'user' | 'system',
  content: string,
  timestamp: Date,
  
  // Rich content
  cards?: Card[],
  actions?: ActionButton[],
  
  // Phase tracking (for soft training)
  phase?: 1 | 2 | 3 | 4;
  soft_training_score?: number;
}
```

### Action Button Implementation

```typescript
interface ActionButton {
  label: string;
  action: 'start_match' | 'view_squad' | 'view_standings' | 'vote' | 'access_exclusive_area';
  params?: Record<string, any>;
  style: 'primary' | 'secondary' | 'info' | 'link';
}
```

### Card Types

```typescript
// Phase 1: Simple cards
type SimpleCard = {
  type: 'match_result' | 'player_card' | 'formation_view' | 'points_balance';
};

// Phase 2: Rich cards with parallel features
type RichCard = {
  type: 'voting_card' | 'governance_decision' | 'exclusive_area_unlock' | 'fan_poll';
  
  soft_training_hint?: string;  // Very subtle hints
  parallel_to_real_tokens?: string;  // "Like real token holders!"
};
```

---

## Context Management

```typescript
interface ConversationContext {
  userId: string;
  sessionId: string;
  
  // Phase (for soft training progress)
  currentPhase: 1 | 2 | 3 | 4;
  softTrainingScore: number; // 0-100, increases with each phase
  
  // Game state
  gameState?: GameState;
  lastMatch?: Match;
  
  // Behavioral signals (for soft training)
  lastUnlock?: string;
  parallelFeatureInteractions: string[];
  hintsAcknowledged: boolean;
  patternsRecognized: boolean[];
  
  // Metrics
  messagesThisSession: number;
  timeSinceLastPhaseTransition: number;
}

// Update context as user progresses through soft training
function updateSoftTrainingProgress(
  context: ConversationContext,
  newPhase: number,
  scoreIncrease: number
): ConversationContext {
  context.currentPhase = newPhase;
  context.softTrainingScore = Math.min(100, context.softTrainingScore + scoreIncrease);
  
  // Track transitions
  if (newPhase === 2 && !context.parallelFeatureInteractions.includes('voting')) {
    context.parallelFeatureInteractions.push('voting');
  }
  
  return context;
}
```

---

## Soft Training Implementation

### Progress Tracking

```typescript
// Track which soft training signals user has encountered
interface SoftTrainingSignals {
  // Phase 2: Discovery (0-33 points)
  discoveredTokenConcepts: boolean;
  participatedInVoting: boolean;
  understandsGovernance: boolean;
  accessedExclusiveContent: boolean;
  showsNaturalInterest: boolean;
  demonstratedUnderstanding: boolean;
  
  // Phase 3: Curiosity (34-66 points)
  subtleHintAcknowledged: boolean;
  patternRecognitionShown: boolean;
  anticipationFutureContent: boolean;
  voiceInDecisionsFeelings: 'positive' | 'neutral' | 'none';
  
  // Phase 4: Readiness (67-100 points)
  parallelConceptsUnderstood: boolean;
  tokenCuriosityScore: number; // 0-100 based on questions/interest
  naturalDiscoveryTrigger: boolean;
  modalViewed: boolean;
  sociosLinkClicked: boolean;
}

// Calculate overall soft training score (0-100)
function calculateSoftTrainingScore(
  signals: SoftTrainingSignals
): number {
  let score = 0;
  
  // Phase 2: Discovery
  if (signals.discoveredTokenConcepts) score += 15;
  if (signals.participatedInVoting) score += 5;
  if (signals.understandsGovernance) score += 8;
  if (signals.accessedExclusiveContent) score += 10;
  if (signals.showsNaturalInterest) score += 7;
  
  // Phase 3: Curiosity
  if (signals.subtleHintAcknowledged) score += 5;
  if (signals.patternRecognitionShown) score += 10;
  if (signals.voiceInDecisionsFeelings === 'positive') score += 8;
  
  // Phase 4: Readiness
  if (signals.parallelConceptsUnderstood) score += 10;
  if (signals.tokenCuriosityScore >= 60) score += 15;
  if (signals.modalViewed) score += 10;
  if (signals.sociosLinkClicked) score += 20;
  
  return Math.min(score, 100);
}
```

### Phase Transition Logic

```typescript
function shouldTransitionPhase(
  context: ConversationContext,
  signals: SoftTrainingSignals,
  metrics: SoftTrainingMetrics
): boolean {
  
  const softTrainingScore = calculateSoftTrainingScore(signals);
  
  switch (context.currentPhase) {
    case 1:
      // Phase 1 → 2: After user participates in voting
      if (signals.participatedInVoting) return true;
      break;
    
    case 2:
      // Phase 2 → 3: After multiple votes + exclusive area access
      const votes = metrics.phase2_discovery.votes || 0;
      const exclusiveVisits = metrics.phase2_discovery.exclusive_area_access_count || 0;
      if (votes >= 3 && exclusiveVisits >= 3) return true;
      break;
    
    case 3:
      // Phase 3 → 4: After pattern recognition + subtle hints acknowledged
      if (signals.patternRecognitionShown && 
          signals.subtleHintAcknowledged &&
          signals.voiceInDecisionsFeelings === 'positive') {
        return true;
      }
      break;
    
    case 4:
      // Phase 4: Complete - Ready for education
      if (softTrainingScore >= 75 && 
          (metrics.phase4_readiness?.modal_viewed || false) &&
          (signals.tokenCuriosityScore >= 60 || signals.naturalDiscoveryTrigger || false)) {
        return true;  // User is ready for natural education
      }
      break;
    
    default:
      return false;
  }
}
```

---

## Educational Modal (Phase 4)

### Natural Discovery Modal Content

```typescript
const educationalModalContent = {
  title: "Como funciona no mundo real",
  
  sections: [
    {
      header: "🎭 O que são Fan Tokens?",
      content: "Fan Tokens são como uma carteira digital de torcedor. É um programa oficial do clube que dá benefícios exclusivos aos seus fãs mais engajados."
    },
    {
      header: "🗳 Como você já sabe fazer",
      content: "No jogo, você prática tudo isso de forma divertida. Você participa de votações, ajuda em decisões do clube, acessa conteúdo exclusivo. Na vida real, tokens funcionam de forma parecida - é uma continuação natural do seu engajamento!"
    },
    {
      header: "📱 No Socios.com",
      content: "Seu time tem seus tokens no Socios.com. Você pode comprar seus primeiros Tokens lá. Depois, votar em decisões oficiais do clube, participar de sorteios exclusivos, e ter acesso a experiências que torcedores normais não têm."
    },
    {
      header: "💡 Por que isso é legal",
      content: "É a mesma lógica que você domina aqui no FalaMestre! Você já entendeu o básico. É divertido experimentar com Tokens de verdade! O legal é que é uma continuação natural do seu engajamento."
    }
  ],
  
  cta: {
    primary: "Continuar jogando",
    secondary: "Ver no Socios.com (opcional)",
    tone: "low_pressure",
    highlight: "no_pressure"
  },
  
  soft_training_complete: true
};
```

### Educational Trigger Conditions

```typescript
function shouldShowEducationalModal(
  context: ConversationContext,
  softTrainingMetrics: SoftTrainingMetrics
): boolean {
  
  const { currentPhase, softTrainingScore } = context;
  
  // Only show in Phase 4
  if (currentPhase !== 4) return false;
  
  // User must have completed soft training phases 1-3
  if (softTrainingScore < 75) return false;
  
  // Show 2-3 times max (don't over-educate)
  const showCount = softTrainingMetrics.educational_modal_views || 0;
  if (showCount >= 2) return false;
  
  // Trigger via curiosity or natural discovery
  const { tokenCuriosityScore, naturalDiscoveryTrigger } = softTrainingMetrics;
  if (tokenCuriosityScore >= 60 || naturalDiscoveryTrigger) {
    return true;
  }
  
  return false;
}
```

---

## Related Documents

- [[01-Fan-Token-Integration]] - Soft training parallel features
- [[12-Soft-Training-Progression]] - Phase transition logic and scoring
- [[10-Hot-Lead-Definition]] - Soft training metrics in lead qualification
- [[03-Conversational-AI-LLM-Strategy]] - AI prompt configuration by phase
- [[19-IP-Protection-Team-Naming-Strategy]] - IP-safe team and player naming

---

*"Chat IS the interface. Language IS the controller. Discovery through conversation, not marketing."*
