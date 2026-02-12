# Soft Training Progression

---
tags: #business #education #tokens #progression #phases
status: complete
priority: critical
phase: mvp
last_updated: 2026-01-20
---

## Overview

Soft training for fan tokens works through gradual, phased content reveals that mirror real token holder experiences. Users discover token concepts naturally through gameplay, not through overt marketing or "educational moments." This creates curiosity, builds familiarity, and makes eventual conversion feel organic.

> [!important] Regulatory-Compliant Core Principle
> **Discovery first, education second. Let users become curious about tokens through parallel gameplay features. All crypto messaging, wallet connection, and token conversion is handled by Socios.com to maintain regulatory compliance.**

---

## Regulatory-Compliant Architecture

### The "Grey Zone" Strategy

**Fala Mestre! (Game Side - Compliant):**
- ✅ "Earn points for good predictions"
- ✅ "Points unlock rewards"
- ✅ "Join the fan community"
- ✅ "Compete on leaderboards"
- ❌ **NO mention of:** crypto, tokens, blockchain, wallet, conversion

**Socios.com (Crypto Side - Compliant):**
- ✅ "Connect your wallet"
- ✅ "Convert points to tokens"
- ✅ "Fan token rewards"
- ✅ **Full regulatory compliance** (they have the licenses)

**The Bridge (Remarketing - Compliant):**
- Fala Mestre! → Socios.com (email, push, ads)
- Socios.com → Fala Mestre! (if needed)
- **No direct crypto promotion in game**

### Why This Matters

**Traditional crypto user acquisition in Brazil:**
- ❌ Heavily restricted by crypto regulations
- ❌ Expensive ($50-200 CAC per user)
- ❌ Compliance risk for platforms

**Fala Mestre! approach:**
- ✅ **Regulatory-compliant** (game side stays in "grey zone")
- ✅ **Ultra-low cost** (<$1 CAC)
- ✅ **Socios.com controls** all crypto messaging
- ✅ **Real-time tracking** of user journey

---

## Phase-Based Progression Strategy

### Phase 1: Pure Gameplay (Weeks 1-2)

**Objective:** Establish game as fun, engaging football management WITHOUT any token mentions.

**User Experience:**
- "This is just a fun football game, like Elifoot but with chat"
- No concept of tokens exists yet
- Focus on: Winning matches, building squad, tactical decisions

**AI Behavior:**
```typescript
const phase1AI = {
  persona: "Fala Mestre - Enthusiastic Coach",
  
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
    tone: "enthusiastic, celebratory",
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

**Features Available:**
- ✅ Team selection (all 20 Serie A teams)
- ✅ Squad management
- ✅ Match simulation with AI narration
- ✅ Formation and tactics
- ✅ Basic transfers
- ✅ League standings
- ✅ Player development

**Features Locked:**
- ❌ Club voting
- ❌ Governance decisions
- ❌ Exclusive content areas
- ❌ Any token-related features

**Behavioral Tracking:**
- Focus on: Gaming patterns, tactical preferences, team loyalty
- NOT tracking: Token interest, crypto awareness

**Regulatory Note:** This phase is 100% compliant. No crypto mentions whatsoever.

---

### Phase 2: Parallel Features Reveal (Weeks 3-4)

**Objective:** Introduce features that "parallel" real token benefits WITHOUT calling them tokens.

**User Experience:**
- "Oh, this new voting feature is cool! It feels like how real fans participate in club decisions"
- "That exclusive content area is awesome! Feels like a VIP section"
- Still no explicit mention of tokens

**AI Behavior:**
```typescript
const phase2AI = {
  persona: "Fala Mestre - Curious Coach",
  
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
    tone: "curious, inviting",
    examples: [
      {
        trigger: "first_unlock_voting",
        response: "Mestre! Nova funcionalidade desbloqueada! Seu time vai fazer uma pesquisa com os torcedores. Queremos saber sua opinião!",
        engagement_hook: "discovery_excitement",
        soft_training_hint: null
      },
      {
        trigger: "first_unlock_exclusive_area",
        response: "Parabéns! Você desbloqueou a Área do Sócio! Aqui tem conteúdo exclusivo que só torcedores dedicados podem acessar. Dá uma olhada?",
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
      "Torcedores que são muito dedicados ganham benefícios especiais."
    ]
  }
};
```

**Features Unlocked:**
- ✅ Club voting (kit selection, player of month)
- ✅ Exclusive content area (basic tier)
- ✅ Fan polls

**Parallel Mapping (Internal Documentation Only - Not Visible to Users):**
```typescript
const parallelMapping = {
  club_voting: {
    feature: "Club Decisions - Voting",
    real_world_parallel: "Fan Token voting on official club polls",
    soft_training_goal: "Understand voting mechanics without knowing it's tokens"
  },
  
  exclusive_content: {
    feature: "Exclusive Content Area",
    real_world_parallel: "Token holder exclusive access (interviews, behind-the-scenes, early announcements)",
    soft_training_goal: "Experience exclusive content benefits without knowing it's tokens"
  },
  
  fan_polls: {
    feature: "Fan Polls",
    real_world_parallel: "Fan sentiment surveys that influence club decisions",
    soft_training_goal: "Participate in club culture without knowing it's tokens"
  }
};
```

---

### Phase 3: Curiosity Building (Weeks 5-6)

**Objective:** Users have experienced parallel features, AI starts dropping VERY subtle hints about "tokens" as the next thing.

**User Experience:**
- "I've been voting on club decisions for weeks. This is really engaging"
- "The exclusive area is great. I wonder what's in the higher tiers?"
- AI occasionally mentions: "This is similar to how things work in some special programs..."

**AI Behavior:**
```typescript
const phase3AI = {
  persona: "Fala Mestre - Knowledgeable Guide",
  
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

**Features Unlocked:**
- ✅ Governance decisions (resource allocation)
- ✅ Higher-tier exclusive content
- ✅ Fan polls (more frequent)

---

### Phase 4: Natural Discovery (Weeks 7-8)

**Objective:** AI naturally introduces token concepts as part of gameplay evolution. Users discover "this is how tokens work" through understanding, not being told.

**User Experience:**
- "Oh, I get it now! The voting, exclusive content, governance decisions - it's all about being a dedicated fan who has influence!"
- AI says: "You've mastered all these club features. Now let me tell you something interesting..."
- First direct, educational mention of tokens

**AI Behavior:**
```typescript
const phase4AI = {
  persona: "Fala Mestre - Trusted Advisor",
  
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
        "Sabe, você já entendeu como funciona. Participar, ter voz, acessar coisas especiais. Isso é o que os torcedores que têm Fan Tokens experimentam!",
        
        // Educational but natural
        "Fan Tokens são como uma carteira digital de torcedor. Com elas, você pode votar em decisões oficiais do clube, ter acesso a experiências exclusivas, e até influenciar o futuro do seu time.",
        
        // Low-pressure CTA
        "Quer saber como funciona na vida real? É bem interessante. Posso te mostrar.",
        
        call_to_action: {
          type: "informative",
          urgency: "low",
          label: "Informar-se"
        }
      },
      {
        trigger: "user_expresses_interest_after_intro",
        response: "Legal! Você está curioso. A ideia é simples: tokens são como uma moeda especial do torcedor. No jogo, você pratica tudo isso de forma divertida. Na vida real, funciona de forma parecida.",
        
        educational_content: {
          parallel: "A votação que você fez no jogo é parecida com votações de tokens no Socios.com.",
          voting: "As decisões do clube que você ajuda no jogo influenciam o clube na vida real com tokens.",
          exclusive: "A área exclusiva que você acessa aqui é como o que token holders recebem - acesso a coisas que torcedores normais não têm.",
          conclusion: "Você já entendeu o básico! É como uma continuação natural do seu engajamento."
        },
        
        call_to_action: {
          type: "exploratory",
          urgency: "low",
          label: "Continuar jogando"
        }
      },
      {
        trigger: "user_wants_to_try_tokens",
        response: "Perfeito! Quer tentar com Tokens de verdade? Seu time tem seus tokens no Socios.com. É o mesmo processo que você aprendeu aqui no jogo, só que de verdade! 😊",
        
        educational_content: {
          first_steps: "No site do seu time no Socios.com, você pode comprar seus primeiros Tokens.",
          benefits: "Depois, você pode votar, ter acesso a experiências exclusivas, e participar da vida do clube de verdade!",
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

**Educational Modal Content:**
```typescript
const educationalModal = {
  title: "Como funciona no mundo real",
  
  sections: [
    {
      header: "🎭 O que são Fan Tokens?",
      content: "Fan Tokens são como uma carteira digital de torcedor. É um programa oficial do clube que dá benefícios exclusivos aos torcedores mais engajados."
    },
    {
      header: "🗳 Como você já sabe fazer",
      content: "No jogo, você pratica tudo isso de forma divertida! Você vota em decisões, ajuda a definir estratégias, e acessa conteúdo especial. No mundo real, tokens funcionam de forma parecida - é uma continuação natural do seu engajamento."
    },
    {
      header: "📱 No Socios.com",
      content: "Seu time tem seus tokens no Socios.com. Você pode comprar seus primeiros tokens lá. Depois, vota em decisões oficiais do clube, participa de sorteios exclusivos, e tem acesso a experiências que torcedores normais não têm."
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

## Soft Training Metrics

### Phase Progression Tracking

```typescript
interface SoftTrainingMetrics {
  userId: string;
  
  currentPhase: 1 | 2 | 3 | 4;
  
  // Phase 1: Pure Gameplay
  phase1_engagement: {
    sessions_played: number;
    matches_completed: number;
    tactical_decisions_made: number;
    win_rate: number;
  };
  
  // Phase 2: Parallel Features
  phase2_discovery: {
    first_vote_participation: boolean;
    exclusive_area_access_count: number;
    time_in_exclusive_area: number;
    fan_polls_participated: number;
    natural_curiosity_expressed: boolean;
  };
  
  // Phase 3: Curiosity Building
  phase3_curiosity: {
    subtle_hint_acknowledgment: boolean;
    pattern_recognition_shown: boolean;
    anticipation_future_content: boolean;
    voice_in_decisions_feelings: 'positive' | 'neutral' | 'none';
  };
  
  // Phase 4: Natural Discovery
  phase4_readiness: {
    parallel_concepts_understood: boolean;
    token_curiosity_score: number; // 0-100 based on questions/interest
    natural_discovery_trigger: boolean;
    modal_viewed: boolean;
    socios_link_clicked: boolean;
  };
  
  // Overall Soft Training Score
  soft_training_completion_score: number; // 0-100
  ready_for_conversion: boolean;
}
```

### Scoring Logic

```typescript
function calculateSoftTrainingScore(
  phase1Data: Phase1Engagement,
  phase2Data: Phase2Discovery,
  phase3Data: Phase3Curiosity,
  phase4Data: Phase4Readiness
): number {
  
  // Phase 1: Foundation (20%)
  const phase1Score = phase1Data.sessions_played >= 10 ? 20 : 
                           phase1Data.sessions_played >= 5 ? 15 : 10;
  
  // Phase 2: Discovery (25%)
  let phase2Score = 0;
  if (phase2Data.first_vote_participation) phase2Score += 5;
  if (phase2Data.exclusive_area_access_count >= 3) phase2Score += 10;
  if (phase2Data.natural_curiosity_expressed) phase2Score += 10;
  
  // Phase 3: Curiosity (30%)
  let phase3Score = 0;
  if (phase3Data.subtle_hint_acknowledgment) phase3Score += 5;
  if (phase3Data.pattern_recognition_shown) phase3Score += 10;
  if (phase3Data.voice_in_decisions_feelings === 'positive') phase3Score += 15;
  
  // Phase 4: Readiness (25%)
  let phase4Score = 0;
  if (phase4Data.parallel_concepts_understood) phase4Score += 10;
  if (phase4Data.token_curiosity_score >= 60) phase4Score += 10;
  if (phase4Data.modal_viewed) phase4Score += 5;
  
  const totalScore = phase1Score + phase2Score + phase3Score + phase4Score;
  
  // Normalize to 0-100
  return Math.min(totalScore, 100);
}

function determineConversionReadiness(
  softTrainingScore: number,
  behavioralCluster: BehavioralCluster
): {
  ready: boolean,
  confidence: string
} {
  const minimumScore = 75; // 75/100 soft training score required
  
  if (softTrainingScore >= minimumScore && 
      (behavioralCluster.purchase_intent >= 60 || 
       behavioralCluster.crypto_awareness >= 50)) {
    return {
      ready: true,
      confidence: "high"
    };
  } else if (softTrainingScore >= minimumScore) {
    return {
      ready: true,
      confidence: "medium"
    };
  } else {
    return {
      ready: false,
      confidence: "low"
    };
  }
}
```

---

## Phase Transition Logic

```typescript
interface PhaseTransition {
  currentPhase: number;
  transitionTo: number;
  trigger: PhaseTransitionTrigger;
  
  // User must meet criteria BEFORE transitioning
  requirements: {
    sessions_in_phase: number;
    features_unlocked: string[];
    behavioral_signals: string[];
  };
}

const phaseTransitions = {
  phase1_to_2: {
    currentPhase: 1,
    transitionTo: 2,
    triggers: [
      "complete_5_matches",
      "reach_league_position_8",
      "play_at_least_10_hours_total"
    ],
    requirements: {
      sessions_in_phase: 10,
      features_unlocked: [],
      behavioral_signals: ["demonstrated_game_engagement"]
    },
    unlockMessage: "Novo recurso desbloqueado! Decisões do Clube."
  },
  
  phase2_to_3: {
    currentPhase: 2,
    transitionTo: 3,
    triggers: [
      "participate_in_3_votes",
      "access_exclusive_area_3_times",
      "session_total_15_hours"
    ],
    requirements: {
      sessions_in_phase: 15,
      features_unlocked: ["club_voting", "exclusive_area_tier1"],
      behavioral_signals: ["shown_interest_in_parallel_features", "natural_curiosity_expressed"]
    },
    unlockMessage: "Novo conteúdo desbloqueado! Área do Sócio agora disponível."
  },
  
  phase3_to_4: {
    currentPhase: 3,
    transitionTo: 4,
    triggers: [
      "subtle_hints_acknowledged",
      "pattern_recognition_shown",
      "voice_in_decisions_positive",
      "session_total_20_hours"
    ],
    requirements: {
      sessions_in_phase: 20,
      features_unlocked: ["governance_decisions", "exclusive_area_tier2", "fan_polls"],
      behavioral_signals: ["demonstrated_understanding_of_engagement_benefits"]
    },
    unlockMessage: "Você domina tudo o que o jogo oferece!"
  }
};

function checkPhaseTransition(
  userId: string,
  metrics: SoftTrainingMetrics
): PhaseTransition | null {
  // Check if user meets criteria for next phase
  const { currentPhase, phase1_engagement, phase2_discovery, 
           phase3_curiosity, phase4_readiness } = metrics;
  
  if (currentPhase === 1) {
    if (phase1_engagement.sessions_played >= 10) {
      return phaseTransitions.phase1_to_2;
    }
  }
  
  if (currentPhase === 2) {
    const votes = phase2_discovery.first_vote_participation ? 1 : 0;
    const exclusiveAreaVisits = phase2_discovery.exclusive_area_access_count || 0;
    
    if (votes >= 3 && exclusiveAreaVisits >= 3) {
      return phaseTransitions.phase2_to_3;
    }
  }
  
  if (currentPhase === 3) {
    if (phase3_curiosity.subtle_hint_acknowledgment &&
        phase3_curiosity.pattern_recognition_shown &&
        phase3_curiosity.voice_in_decisions_feelings === 'positive') {
      return phaseTransitions.phase3_to_4;
    }
  }
  
  return null;
}
```

---

## A/B Testing Strategy

### Experiment Variables

```typescript
const abTests = {
  test1: {
    name: "Hint Frequency",
    variants: {
      control: {
        hint_frequency: "once_per_7_days",
        user_group: 50%
      },
      variant_a: {
        hint_frequency: "once_per_3_days",
        user_group: 25%
      },
      variant_b: {
        hint_frequency: "once_per_5_days",
        user_group: 25%
      }
    },
    metric: "soft_training_completion_rate",
    hypothesis: "More frequent hints maintain curiosity without feeling marketed to"
  },
  
  test2: {
    name: "Education Timing",
    variants: {
      control: {
        education_trigger: "after_10_hours_in_phase3",
        user_group: 50%
      },
      variant_a: {
        education_trigger: "after_soft_training_score_reaches_80",
        user_group: 25%
      },
      variant_b: {
        education_trigger: "after_user_expresses_curiosity",
        user_group: 25%
      }
    },
    metric: "conversion_to_socios",
    hypothesis: "Curiosity-driven conversion higher than time-based conversion"
  },
  
  test3: {
    name: "Parallel Feature Reveal",
    variants: {
      control: {
        reveal_sequence: "voting -> exclusive_area -> governance -> education",
        user_group: 50%
      },
      variant_a: {
        reveal_sequence: "exclusive_area -> voting -> governance -> education",
        user_group: 25%
      },
      variant_b: {
        reveal_sequence: "simultaneous_all",
        user_group: 25%
      }
    },
    metric: "engagement_with_parallel_features",
    hypothesis: "All features visible may increase discovery but could overwhelm"
  }
};
```

---

## Success Metrics

### Phase Completion Rates (Expected for 10K Users)

```yaml
Phase Completion (End of Month 1):
  phase_1_complete: 95% (9,500 users)
  phase_2_complete: 70% (7,000 users)
  phase_3_complete: 45% (4,500 users)
  phase_4_complete: 20% (2,000 users)

Soft Training Distribution:
  fully_trained: 25% (2,500 users)
  partially_trained: 50% (5,000 users)
  not_trained: 25% (2,500 users)

Conversion Funnel:
  phase_4_users: 2,000
    -> natural_discovery: 80% (1,600 users)
    -> expresses_curiosity: 60% (1,200 users)
    -> clicks_socios_link: 30% (600 users)
    -> purchases_token: 10% (600 users)
    -> 40% conversion to real token holders!
```

### Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Phase 1 D7 Retention | 50% | Session analytics |
| Phase 2 Feature Engagement | 70% of users access parallel features | Feature usage analytics |
| Phase 3 Curiosity Score | Average 60+ | Behavioral clustering |
| Phase 4 Education Completion | 80% view modal | Modal view analytics |
| Socios Link Click Rate | 30% of Phase 4 users | Click tracking |
| Token Purchase Conversion | 40% of link clickers | Socios attribution |
| Overall Soft Training Score | Average 75+ | Aggregated metric |

---

---

## Regulatory-Compliant Handoff

### The Critical Transition (After Phase 4)

**Important:** After users complete Phase 4 and show interest in tokens, Fala Mestre! does NOT handle crypto conversion.

**Instead, the handoff to Socios.com:**

```
Fala Mestre! (Game) → Socios.com (Crypto)
```

**Step 1: Identify Power Users**
- Fala Mestre! tracks behavior only (matches, points, engagement)
- No crypto-related metrics
- Cluster: "Power User" = 2000+ points, 30+ days active

**Step 2: Trigger Socios.com API**
```typescript
const sociosAPI = {
  notifyPowerUser: async (userId, points) => {
    // Send to Socios.com webhook
    // They handle email, compliance, crypto messaging
    return { success: true };
  }
};
```

**Step 3: Socios.com Sends Email**
- **Socios.com controls** all crypto messaging
- **Compliant email** with wallet connection
- **Educational content** about tokens
- **Landing page** with full crypto details

**Step 4: User Converts on Socios.com**
- Wallet connection
- Token purchase
- Full regulatory compliance maintained

### Why This Architecture Works

**Regulatory Compliance:**
- Fala Mestre! stays in "grey zone" (game only)
- Socios.com handles all crypto compliance (they have licenses)
- No crypto messaging in game = no regulatory risk

**User Experience:**
- Natural discovery through gameplay
- No pressure or sales tactics
- Curiosity-driven conversion
- Seamless handoff to Socios.com

**Business Metrics:**
- Ultra-low CAC (<$1 vs $50-200 traditional)
- High conversion rates (25-30% of Power Users)
- Real-time tracking via API
- Scalable to 70M+ Brazilian football fans

### Compliance Checklist

**FalaMestre! (Game) - MUST NOT:**
- ❌ Mention "crypto," "token," "blockchain," "wallet"
- ❌ Show token prices or values
- ❌ Explain conversion mechanics
- ❌ Link directly to Socios.com crypto pages
- ❌ Use crypto terminology in UI

**FalaMestre! (Game) - CAN:**
- ✅ "Earn points"
- ✅ "Special rewards"
- ✅ "Join community"
- ✅ "Top fans get priority"
- ✅ Trigger Socios.com email (API call)

**Socios.com (Crypto) - RESPONSIBLE FOR:**
- ✅ All crypto education
- ✅ Wallet connection
- ✅ Token conversion
- ✅ Regulatory compliance
- ✅ Email content to users

---

*"Training without teaching. Discovery without marketing. That's soft training."*
