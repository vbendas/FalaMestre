# Fan Token Integration

---
tags: #business #tokens #socios #web3 #rewards #soft-training
status: updated
priority: critical
phase: mvp
last_updated: 2026-01-20
---

## Overview

Fala Mestre! serves as a **regulatory-compliant user acquisition channel** for Socios.com. Players discover token concepts naturally through parallel gameplay features, develop curiosity, and eventually convert to real token holders through Socios.com's compliant messaging.

> [!important] Regulatory-Compliant Architecture
> **Fala Mestre! stays in the "grey zone" (game only). Socios.com handles all crypto messaging, wallet connection, and token conversion. This keeps the game compliant while delivering users to Socios.com.**

---

## The "Grey Zone" Strategy

### Fala Mestre! (Game Side - Compliant)

**What we CAN say:**
- ✅ "Earn points for good predictions"
- ✅ "Points unlock rewards"
- ✅ "Join the fan community"
- ✅ "Compete on leaderboards"
- ✅ "Special rewards available"
- ✅ "Top fans get priority access"

**What we CANNOT say:**
- ❌ "crypto," "token," "blockchain," "wallet"
- ❌ "Convert points to tokens"
- ❌ "Buy tokens on Socios.com"
- ❌ Any direct crypto promotion

### Socios.com (Crypto Side - Compliant)

**What Socios.com handles:**
- ✅ All crypto education
- ✅ Wallet connection
- ✅ Token conversion
- ✅ Regulatory compliance (they have licenses)
- ✅ Email messaging to users
- ✅ Landing page with crypto content

### The Bridge (Remarketing - Compliant)

**Flow:**
1. Fala Mestre! identifies Power User (behavior only)
2. Fala Mestre! triggers Socios.com email via API
3. **Socios.com sends email** (they control crypto messaging)
4. User clicks → Socios.com landing page
5. **Socios.com handles:** Wallet connection, token education, conversion

**Key:** No direct crypto promotion in game. Only "special rewards."

---

## Soft Training Approach

### Core Principles

**Phase 1: Pure Gameplay (Weeks 1-2)**
- No token mentions
- Focus on football fun
- Build engagement with game mechanics
- Goal: "This is just a fun football game, like Elifoot but with chat"

**Phase 2: Parallel Features Reveal (Weeks 3-4)**
- Introduce features that "parallel" real token benefits WITHOUT calling them tokens
- Club voting (kit selection, player of month)
- Governance decisions (resource allocation)
- Exclusive content areas
- AI behavior: "This new voting feature is cool! It feels like how real fans participate in club decisions"
- Goal: "Oh, this new feature is awesome! Feels like a VIP section"
- Still no explicit mention of tokens

**Phase 3: Curiosity Building (Weeks 5-6)**
- Users have experienced parallel features
- AI starts dropping VERY subtle hints about "tokens"
- "This reminds me of a special program that exists in the real world..."
- "You've mastered all these club features. Now let me share an interesting thing..."
- First hints: Very subtle, only once per 3-7 days
- Goal: Build natural curiosity, not marketing

**Phase 4: Natural Discovery (Weeks 7-8)**
- AI naturally introduces token concepts as part of gameplay evolution
- "You already understand everything the game offers. Let me share something interesting..."
- Educational modal: Informative, not sales-focused
- First direct mention of tokens: Soft, informational
- "Fan Tokens são como uma carteira digital de torcedor. Com elas, você pode votar em decisões oficiais do clube, ter acesso a experiências exclusivas, e até influenciar o futuro do seu time. É incrível, né?"
- Low-pressure CTAs: "Quer saber como funciona na vida real? É bem interessante. Posso te mostrar."
- Goal: Natural discovery through understanding, not coercion

### Regulatory-Compliant Handoff

**Critical:** After Phase 4, Fala Mestre! does NOT handle crypto conversion.

**Instead:**
1. Fala Mestre! identifies Power Users (behavior only)
2. Fala Mestre! triggers Socios.com email via API
3. **Socios.com sends email** with crypto messaging (compliant)
4. User clicks → Socios.com landing page
5. **Socios.com handles:** Wallet connection, token education, conversion

**Fala Mestre! never mentions crypto directly.** Only "special rewards."

---

## Parallel Features (Soft Training)

### Feature 1: Club Voting (Mirrors Real Token Voting)

**Purpose:** Let users experience club decision participation without knowing it's about tokens

```typescript
// In-game feature: Club decision voting
interface ClubVoting {
  // User experience: Unlockable gameplay feature
  unlockCondition: "Reach league position 1-3",
  
  // Gameplay
  prompt: {
    ai_dialogue: {
      style: "casual, enthusiastic",
      message: "Mestre, vamos participar das decisões do seu time!",
      tone: "Just like real fans do!"
    }
  },
  
  voteType: {
    season_kit: {
      question: "Qual kit seu time deve usar na próxima temporada?",
      options: [
        { label: "Kit branco clássico", votes: 45, description: "Os tradicionalistas adoram" },
        { label: "Kit preto moderno", votes: 38, description: "Os modernistas preferem" }
      ],
      result: "Kit branco venceu! A torcida está feliz."
    },
    player_of_month: {
      question: "Quem foi o melhor do time no mês?",
      options: [
        { label: "Raio", stats: { goals: 8, assists: 3 } },
        { label: "Trovão", stats: { goals: 5, assists: 7 } }
      ],
      result: "Raio é o Jogador do Mês! Parabéns por participar!"
    }
  },
  
  // Soft education: After voting, AI casually mentions
  ai_followup: {
    timing: "after_vote_result",
    message: "Viu? Votar foi divertido! No mundo real, os torcedores que têm Fan Tokens votam em decisões do clube. É bem legal ter essa voz, né?",
    tone: "casual, informative, not promotional",
    no_call_to_action: true
  },
  
  // Reward: Mirror real token voting benefits
  reward: {
    type: "access_unlock",
    benefit: "Unlocked: Special training camp with 3-star players",
    description: "Access to exclusive content (just like token holders!)",
    call_to_action: null
  }
}
```

### Feature 2: Governance Decisions (Mirrors Real Token Governance)

**Purpose:** Let users experience club governance simulation

```typescript
// In-game feature: Club governance simulation
interface GovernanceDecisions {
  unlockCondition: "Complete first season",
  
  prompt: {
    ai_dialogue: {
      style: "curioso, storytelling",
      message: "O diretor quer sua opinião sobre uma decisão importante do clube...",
    }
  },
  
  decisionType: {
    resource_allocation: {
      context: "Seu time recebeu R$50M de uma venda.",
      question: "Para onde deve ir esse dinheiro?",
      options: [
        { label: "Refinar elenco", impact: "Atrair melhores jogadores", tokens: "token_strengthened" },
        { label: "Reformar estádio", impact: "Melhorar a estrutura", tokens: "token_fan_experience" },
        { label: "Academia de base", impact: "Investir no futuro", tokens: "token_development" },
        { label: "Fundo de emergência", impact: "Preparar para imprevistos", tokens: "token_safety_net" }
      ],
      result: "Decisão tomada! Veja o impacto no próximo jogo."
    },
    
    fan_poll: {
      context: "O clube está considerando mudar o escudo para o centenário.",
      question: "Qual é a sua opinião como torcedor?",
      options: [
        { label: "Manter o escudo atual", votes: 52, description: "Tradicionalistas" },
        { label: "Adotar escudo especial", votes: 48, description: "Modernos" }
      ],
      result: "Voto registrado! O clube leva em consideração a voz dos torcedores."
    }
  },
  
  ai_followup: {
    timing: "after_decision",
    message: "Parabéns por participar! Os Fan Tokens dão direito de voto em decisões importantes. Você acabou de experimentar como funciona, né?"
    tone: "proud, informative",
    subtle_real_world_reference: true
  },
  
  reward: {
    type: "unlock",
    benefit: "Unlocked: Fan poll participation history (just like token holders!)",
    description: "See how your vote influenced club history!"
  }
}
```

### Feature 3: Exclusive Access (Mirrors Real Token Holder Benefits)

**Purpose:** Provide premium content that feels exclusive, without mentioning tokens

```typescript
// In-game feature: Premium content access
interface ExclusiveAccess {
  unlockCondition: "Win 5 consecutive games",
  
  prompt: {
    ai_dialogue: {
      style: "excited, celebratory",
      message: "Mestre, você está em uma sequência incrível! Desbloqueamos uma área especial!",
      tone: "rewarding, unlocking"
    }
  },
  
  contentArea: {
    name: "Área do Sócio",
    description: "Conteúdo exclusivo para torcedores dedicados como você",
    
    content_types: [
      {
        type: "player_interviews",
        title: "Entrevistas Exclusivas",
        content: "Raio fala sobre sua preparação mental",
        tokens_required: 0,
        parallel_to_real_tokens: "Token holders get access to player interviews"
      },
      {
        type: "behind_the_scenes",
        title: "Nos Bastidores",
        content: "Veja como o time treina antes da grande final",
        tokens_required: 0,
        parallel_to_real_tokens: "Token holders get behind-the-scenes access"
      },
      {
        type: "early_squad_announcements",
        title: "Anúncios Antecipados",
        content: "Saiba antes de todos os convocações do time",
        tokens_required: 0,
        parallel_to_real_tokens: "Token holders get early access to announcements"
      }
    ]
  },
  
  ai_followup: {
    timing: "after_unlock",
    message: "Essa área é como um clube VIP. Na vida real, os Fan Tokens dão acesso exclusivo a esse tipo de conteúdo. É legal poder ver as coisas mais de perto, né?",
    tone: "conversational, sharing insight",
    subtle_real_world_reference: true
  },
  
  reward: {
    type: "preference_boost",
    benefit: "+5% team morale for all matches (matches token holder morale boost!)",
    description: "Just like having real tokens makes your team play better!"
  }
}
```

---

## AI Conversation Strategy by Phase

### Phase 1 AI: Football Only

```typescript
const phase1AI = {
  persona: "Fala Mestre - Entusiástico Coach",
  
  topics: {
    allowed: [
      "football_strategy",
      "team_management",
      "match_tactics",
      "player_development"
    ],
    avoided: [
      "tokens",
      "crypto",
      "wallet",
      "socios",
      "blockchain",
      "fan_token"
    ]
  },
  
  conversation_style: {
    focus: "game_only",
    tone: "enthusiástico, celebratory",
    examples: [
      {
        trigger: "user_wins_match",
        response: "Mestre! Que partida! Raio fez um golaço! O estádio vai voar!",
        engagement_hook: "pure_joy"
      },
      {
        trigger: "user_asks_about_features",
        response: "Podemos transferir jogadores, fazer treinos, e participar de torneios! O que você quer fazer hoje?",
        engagement_hook: "curiosity_about_gameplay"
      }
    ]
  },
  
  forbidden_phrases: [
    "token",
    "Fan Token",
    "Socios.com",
    "criptomoeda",
    "carteira",
    "comprar"
  ]
};
```

### Phase 2 AI: Feature Discovery

```typescript
const phase2AI = {
  persona: "Fala Mestre - Curioso Guide",
  
  topics: {
    allowed: [
      "football_strategy",
      "team_management",
      "match_tactics",
      "player_development",
      
      // NEW: Parallel features
      "club_decisions",
      "exclusive_content",
      "voting_mechanics"
    ],
    avoided: [
      "direct_token_mention",
      "crypto_explanation",
      "wallet_connection",
      "socios_promotion"
    ]
  },
  
  conversation_style: {
    focus: "feature_excitement",
    tone: "curioso, convidativo",
    examples: [
      {
        trigger: "first_unlock_voting",
        response: "Mestre! Nova funcionalidade desbloqueada! Seu time vai fazer uma pesquisa com os torcedores. Queremos saber sua opinião!",
        engagement_hook: "discovery_excitement",
        soft_training_hint: null
      },
      {
        trigger: "first_unlock_exclusive_area",
        response: "Parabéns! Você desbloqueou a Área do Sócio! Aqui tem conteúdo exclusivo para torcedores dedicados como você. Dá uma olhada?",
        engagement_hook: "exclusivity_desire",
        soft_training_hint: "Isso lembra algo que você já viu em algum lugar... né?"
      },
      {
        trigger: "user_wins_match_during_unlocked_phase",
        response: "Vitória importante! Você continua jogando muito bem. Com essa sequência, talvez desbloqueie mais coisas na Área do Sócio!",
        engagement_hook: "progress_anticipation"
      }
    ]
  },
  
  forbidden_phrases: [
    "Este é como Fan Tokens",
    "Assim como os detentores de tokens",
    "No Socios.com você pode",
    "Compre tokens para ter acesso"
  ],
  
  subtle_hints: {
    // Allow only VERY subtle mentions
    max_frequency: "once_per_3_days",
    allowed_contexts: [
      "parallel_to_real_world_explanation",
      "fan_engagement_parallels"
    ],
    examples: [
      "É bem legal ter voz em decisões do clube.",
      "Torcedores que participam muito acabam tendo benefícios."
    ]
  }
};
```

### Phase 3 AI: Curiosity Building

```typescript
const phase3AI = {
  persona: "Fala Mestre - Guia Conhecedor",
  
  topics: {
    allowed: [
      "football_strategy",
      "team_management",
      "match_tactics",
      "player_development",
      "club_decisions",
      "exclusive_content",
      
      // NEW: Subtle curiosity building
      "fan_program_benefits",
      "governance_concepts"
    ],
    avoided: [
      "direct_token_promotion",
      "crypto_sales_pitch",
      "wallet_creation_urgency"
    ]
  },
  
  conversation_style: {
    focus: "curiosity_induction",
    tone: "knowledgeable, sharing interesting tidbits",
    examples: [
      {
        trigger: "after_successful_vote",
        response: "Voto registrado! Seu time considerou a opinião da torcida. É legal quando os torcedores têm voz, né? Dá pra participar.",
        engagement_hook: "ownership_feeling",
        curiosity_trigger: true,
        hint_level: "subtle"
      },
      {
        trigger: "after_accessing_exclusive_content",
        response: "Legal! Você é um dos torcedores mais engajados. Alguns clubes têm programas especiais para seus fãs mais dedicados. Talvez um dia você veja algo parecido aqui no FalaMestre!",
        engagement_hook: "anticipation_future_content",
        curiosity_trigger: true,
        hint_level: "subtle"
      },
      {
        trigger: "after_multiple_votes",
        response: "Você participou de 5 votações agora. Em alguns lugares, torcedores que participam muito de decisões do clube acabam tendo acesso a benefícios exclusivos. Interessante, né?",
        engagement_hook: "pattern_recognition",
        curiosity_trigger: true,
        hint_level: "subtle"
      }
    ]
  },
  
  allowed_hints: {
    // Very subtle, only once per 3-7 days
    frequency: "low",
    contexts: [
      "benefits_of_participation",
      "voice_in_decisions",
      "dedicated_fan_recognition"
    ],
    examples: [
      "Torcedores que participam muito acabam tendo benefícios.",
      "Programas especiais existem em alguns lugares.",
      "É legal ter voz nas decisões."
    ]
  }
};
```

### Phase 4 AI: Natural Discovery

```typescript
const phase4AI = {
  persona: "Fala Mestre - Assistente de Confiança",
  
  topics: {
    allowed: [
      "football_strategy",
      "team_management",
      "match_tactics",
      "player_development",
      "club_decisions",
      "exclusive_content",
      
      // NEW: Direct token education
      "fan_token_introduction",
      "wallet_concepts",
      "real_world_token_uses"
    ],
    avoided: [
      "sales_pressure",
      "urgency",
      "fear_of_missing_out"
    ]
  },
  
  conversation_style: {
    focus: "natural_education",
    tone: "trusted, informative, conversational",
    examples: [
      {
        trigger: "user_completes_all_phases",
        response: "Mestre, você já provou tudo que tem no jogo! Você participa de votações, ajuda em decisões do clube, acessa conteúdo exclusivo. É incrível, né?",
        
        // Pause for effect
        "Isso me lembra um programa especial que existe no mundo real...",
        
        // Natural introduction
        "Sabe, você já entende como funciona. Participar, ter voz, acessar coisas especiais. Isso é o que os torcedores que têm Fan Tokens experimentam!",
        
        // Educational but natural
        "Fan Tokens são como uma carteira digital de torcedor. Com elas, você pode votar em decisões oficiais do clube, ter acesso a experiências exclusivas, e até influenciar o futuro do seu time. É incrível, né?",
        
        // Low-pressure CTA
        "Quer saber como funciona na vida real? É bem interessante. Posso te mostrar.",
        
        call_to_action: {
          type: "informational",
          urgency: "low",
          label: "Informar-se",
          optional: true
        }
      },
      {
        trigger: "user_expresses_interest_after_intro",
        response: "Legal! Você está curioso. A ideia é simples: tokens são como uma moeda especial do torcedor. No jogo, você pratica tudo isso de forma divertida. Na vida real, funciona de forma parecida - é uma continuação natural do seu engajamento!",
        
        educational_content: {
          parallel: "A votação que você fez no jogo é parecida com votações de tokens no Socios.com.",
          voting: "As decisões do clube que você ajuda no jogo influenciam o clube na vida real com tokens.",
          exclusive: "A área exclusiva que você acessa aqui é como o que token holders recebem - acesso a coisas que torcedores normais não têm.",
          conclusion: "Você já entendeu o básico! É como uma continuação natural do seu engajamento."
        },
        
        call_to_action: {
          type: "exploratory",
          urgency: "low",
          label: "Continuar jogando",
          optional: true
        }
      },
      {
        trigger: "user_wants_to_try_tokens",
        response: "Perfeito! Quer tentar com Tokens de verdade? Seu time tem seus tokens no Socios.com. É o mesmo processo que você aprendeu aqui no jogo, só que de verdade! 😊",
        
        educational_content: {
          first_steps: "No site do seu time no Socios.com, você pode comprar seus primeiros Tokens.",
          benefits: "Depois, você pode votar em decisões oficiais do clube, participar de sorteios exclusivos, e ter acesso a experiências que torcedores normais não têm.",
          connection: "É a mesma lógica que você domina aqui no FalaMestre!",
          encouragement: "Vale a pena experimentar. Você já sabe o básico!"
        },
        
        call_to_action: {
          type: "informational_link",
          urgency: "low",
          label: "Ver no Socios.com (opcional)",
          optional: true
        }
      }
    ]
  },
  
  // No more forbidden phrases
  forbidden_phrases: []
};
```

---

## Educational Modal Content (Phase 4)

### In-Game Education Modal

```typescript
const educationalModal = {
  title: "Como funciona no mundo real",
  
  sections: [
    {
      header: "🎭 O que são Fan Tokens?",
      content: "Fan Tokens são como uma carteira digital de torcedor. É um programa oficial do clube que dá benefícios exclusivos aos seus fãs mais engajados."
    },
    {
      header: "🗳 Como você já sabe fazer",
      content: "No jogo, você pratica tudo isso de forma divertida. Você participa de votações, ajuda em decisões do clube, acessa conteúdo exclusivo. Na vida real, tokens funcionam de forma parecida - é uma continuação natural do seu engajamento!"
    },
    {
      header: "📱 No Socios.com",
      content: "Seu time tem seus tokens no Socios.com. Você pode comprar seus primeiros Tokens lá. Depois, vota em decisões oficiais do clube, participa de sorteios exclusivos, e tem acesso a experiências especiais que torcedores normais não têm."
    },
    {
      header: "💡 Por que isso é legal",
      content: "É a mesma lógica que você domina aqui no FalaMestre! Você já entendeu o básico, então vai ser fácil participar do programa de verdade. É divertido experimentar como seria torcer com Tokens!"
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

---

## Conversion Metrics

### Phase-Based Conversion Funnel

```
Phase 1: Pure Gameplay (10K users)
   ↓
   95% engage with game
   ↓
   90% reach Phase 2 features
   ↓
   
Phase 2: Parallel Features (9K users)
   ↓
   80% engage with voting/exclusive areas
   ↓
   70% show natural curiosity
   ↓
   
Phase 3: Curiosity Building (6K users)
   ↓
   60% acknowledge pattern recognition
   ↓
   50% express desire to discover more
   ↓
   
Phase 4: Natural Discovery (5K users)
   ↓
   40% view educational modal
   ↓
   30% click Socios.com link (informational)
   ↓
   10% purchase token
   ↓
   1,000 token buyers
   ↓
   40% conversion rate of link clickers
```

### Key Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Phase 1 D7 Retention | 50% | Session analytics |
| Phase 2 Feature Engagement | 70% of users | Feature usage analytics |
| Phase 3 Curiosity Score | Average 60+ | Behavioral clustering |
| Phase 4 Modal View Rate | 40% of Phase 3 users | Modal view analytics |
| Socios Link Click Rate | 30% of modal viewers | Click tracking |
| Token Purchase Conversion | 10% of link clickers | Socios attribution |
| Overall Conversion | 1% of initial users | End-to-funnel |

---

---

## Compliance Checklist

### FalaMestre! (Game) - MUST NOT:
- ❌ Mention "crypto," "token," "blockchain," "wallet"
- ❌ Show token prices or values
- ❌ Explain conversion mechanics
- ❌ Link directly to Socios.com crypto pages
- ❌ Use crypto terminology in UI

### FalaMestre! (Game) - CAN:
- ✅ "Earn points"
- ✅ "Special rewards"
- ✅ "Join community"
- ✅ "Top fans get priority"
- ✅ Trigger Socios.com email (API call)

### Socios.com (Crypto) - RESPONSIBLE FOR:
- ✅ All crypto education
- ✅ Wallet connection
- ✅ Token conversion
- ✅ Regulatory compliance
- ✅ Email content to users

### API Integration (FalaMestre! → Socios.com)

```typescript
// When Power User is identified
const sociosAPI = {
  notifyPowerUser: async (userId, points) => {
    // Send to Socios.com webhook
    const response = await fetch('https://api.socios.com/power-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SOCIOS_API_KEY}`
      },
      body: JSON.stringify({
        userId: userId,
        points: points,
        cluster: 'power_user',
        timestamp: new Date().toISOString()
      })
    });
    
    return response.json();
  }
};
```

### Real-Time Dashboard (For Chilliz)

**Built by:** FalaMestre! team
**Data source:** Real-time tracking + Socios.com webhooks

**Metrics:**
- Power Users: Real-time count
- Email sent: Real-time
- Opens: Real-time (via Socios.com webhook)
- Conversions: Real-time (via Socios.com webhook)

**Dashboard access:** Provided to Chilliz Head of Acquisition

---

## Related Documents

- [[02-Analytics-Clustering]] - Behavioral tracking for phase transitions
- [[03-Conversational-Interface]] - AI prompts for each phase
- [[10-Hot-Lead-Definition]] - Updated soft training metrics in lead scoring
- [[12-Soft-Training-Progression]] - Phase-by-phase transition logic

---

*"Training without teaching. Discovery without marketing. That's soft training."*
