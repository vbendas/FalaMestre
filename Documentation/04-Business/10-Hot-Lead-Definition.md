# Hot Lead Definition

---
tags: #business #leads #scoring #socios #segments #soft-training
status: updated
priority: critical
phase: mvp
last_updated: 2026-01-20
---

## Overview

Hot lead definition combines behavioral engagement with soft training progress. Users who complete Phase 3+ of soft training (curiosity + desire) show higher conversion potential when they naturally discover token concepts. The goal is to identify users who will convert naturally, not through overt marketing.

> [!important] Core Principle
> **Hot leads = users who complete soft training phases AND show interest. Natural curiosity → higher conversion than marketed leads.**

---

## Updated Soft Training Criteria for Hot Leads

### Soft Training Signals (NEW)

```typescript
interface SoftTrainingSignals {
  // Phase 2: Discovery (0-33 points)
  discoveredTokenConcepts: boolean;
  participatedInVoting: boolean;
  understandsGovernance: boolean;
  accessedExclusiveContent: boolean;
  showsNaturalInterest: boolean;
  demonstratedUnderstanding: boolean;
  
  // Phase 3: Curiosity (34-66 points)
  subtleHintAcknowledgment: boolean;
  patternRecognitionShown: boolean;
  anticipationFutureContent: boolean;
  voiceInDecisions: "positive" | "neutral" | "none";
  
  // Phase 4: Readiness (67-100 points)
  parallelConceptsUnderstood: boolean;
  tokenCuriosityScore: number; // 0-100 based on questions/interest
  naturalDiscoveryTrigger: boolean;
  modalViewed: boolean;
  sociosLinkClicked: boolean;
  
  // Overall Soft Training Score
  softTrainingCompletionScore: number; // 0-100
  readyForConversion: boolean;
}
```

### Updated Classification Logic

```typescript
function classifyHotLead_WithSoftTraining(
  userId: string,
  cluster: BehavioralCluster,
  softTrainingMetrics: SoftTrainingMetrics
): HotLeadClassification {
  
  const hotLeadReasons: string[] = [];
  const scores = {
    purchaseIntent: cluster.purchase_intent,
    cryptoAwareness: cluster.crypto_awareness,
    engagement: cluster.engagement_level,
    softTrainingScore: softTrainingMetrics.softTrainingCompletionScore
  };
  
  // SOFT TRAINING SIGNALS (NEW)
  if (softTrainingMetrics.discoveredTokenConcepts ||
      softTrainingMetrics.participatedInVoting && softTrainingMetrics.understandsGovernance ||
      softTrainingMetrics.accessedExclusiveContent) {
    if (softTrainingMetrics.showsNaturalInterest ||
        softTrainingMetrics.demonstratedUnderstanding) {
      hotLeadReasons.push(`Natural token curiosity (${softTrainingMetrics.softTrainingCompletionScore}%)`);
      hotLeadReasons.push(`Parallel feature engagement (${softTrainingMetrics.accessedExclusiveContent ? 100 : 0}%)`);
    }
  }
  
  // Phase 4 Readiness Check
  const phase4ReadinessScore = softTrainingMetrics.parallelConceptsUnderstood ? 20 : 0;
  phase4ReadinessScore += softTrainingMetrics.tokenCuriosityScore >= 60 ? 30 : 0;
  phase4ReadinessScore += softTrainingMetrics.modalViewed ? 20 : 0;
  phase4ReadinessScore += softTrainingMetrics.sociosLinkClicked ? 30 : 0;
  
  const phase4Readiness = phase4ReadinessScore >= 50;
  
  // UPDATED HOT LEAD CRITERIA
  
  // CRITERION 1: Soft Training Complete + Basic Interest
  if (scores.softTrainingScore >= 75 && (cluster.purchase_intent >= 60 || cluster.crypto_awareness >= 50)) {
    hotLeadReasons.push(`Soft training complete (${scores.softTrainingScore}%)`);
    hotLeadReasons.push(`Purchase intent ${cluster.purchase_intent}% (elevated by gameplay)`);
    
    return {
      userId,
      cluster,
      classification: "HOT_LEAD",
      priority: 1,
      isHotLead: true,
      hotLeadReasons,
      recommendedAction: "Soft outreach: 'You seem to understand tokens well through gameplay. Would you be interested in learning more about how real tokens work?'",
      estimatedLTV: "$200-350",
      confidence: Math.max(scores.purchaseIntent, scores.cryptoAwareness, scores.softTrainingScore),
      softTrainingScore: scores.softTrainingScore
    };
  }
  
  // CRITERION 2: Phase 4 Readiness
  if (phase4Readiness &&
      (cluster.purchase_intent >= 50 || cluster.crypto_awareness >= 40)) {
    hotLeadReasons.push(`Phase 4 ready - understands token concepts (${softTrainingMetrics.tokenCuriosityScore}%)`);
    hotLeadReasons.push(`Modal viewed: ${softTrainingMetrics.modalViewed ? "yes" : "no"}`);
    
    return {
      userId,
      cluster,
      classification: "HOT_LEAD",
      priority: 1,
      isHotLead: true,
      hotLeadReasons,
      recommendedAction: "Educational outreach with natural discovery CTAs",
      estimatedLTV: "$150-250",
      confidence: softTrainingMetrics.tokenCuriosityScore,
      softTrainingScore: scores.softTrainingScore
    };
  }
  
  // ORIGINAL CRITERIA (still valid for earlier phases)
  if (scores.purchaseIntent >= 80 || scores.cryptoAwareness >= 70) {
    hotLeadReasons.push(`Direct token interest (${Math.max(scores.purchaseIntent, scores.cryptoAwareness)}%)`);
    
    return {
      userId,
      cluster,
      classification: "HOT_LEAD",
      priority: 1,
      isHotLead: true,
      hotLeadReasons,
      recommendedAction: "Direct outreach with clear explanation",
      estimatedLTV: "$200-350",
      confidence: Math.max(scores.purchaseIntent, scores.cryptoAwareness, scores.engagement)
    };
  }
  
  // Not qualified
  return {
    userId,
    cluster,
    classification: "COLD_LEAD",
    priority: 4,
    isHotLead: false,
    hotLeadReasons: [],
    recommendedAction: "Continue soft training until Phase 3-4 complete",
    estimatedLTV: "$10-50",
    confidence: Math.max(scores.purchaseIntent, scores.cryptoAwareness, scores.engagement) * 0.5
  };
}
```

---

## Lead Quality Distribution (Updated for Soft Training)

```yaml
Expected Distribution (10K users):
  hot_leads: 4.5% (~450 users)
    phase_4_ready: 2.5% (~250 users)
    soft_trained: 1.5% (~150 users)
    early_interest: 0.5% (~50 users)
  
  warm_leads: 13.3% (~1,330 users)
    phase_3_curious: 6.3% (~630 users)
    early_discovery: 4.2% (~420 users)
    pattern_recognizers: 2.8% (~280 users)
  
  cold_leads: 82.2% (~8,220 users)

Quality by Hot Lead Type:
  phase_4_ready_leads:
    - soft_training_score: 85%+
    - parallel_concepts_understood: true
    - token_curiosity: 60+
    - modal_viewed: true
    - estimated_ltv: "$150-250"
    - conversion_probability: "10-15%"
    - recommended_touchpoints: 1-2
  
  early_interest_leads:
    - soft_training_score: 60-75%
    - shows_natural_interest: true
    - parallel_concepts_understood: false
    - estimated_ltv: "$80-150"
    - conversion_probability: "5-10%"
    - recommended_touchpoints: 2-3
  
  Overall:
    - hot_lead_rate: "4.5%"
    - weighted_avg_ltv: "$175-325"
    - overall_conversion_probability: "8-12%"
    - soft_training_average_score: "65+"
```

---

## Updated Outreach Strategy

### Tier 1: Phase 4 Ready Users (Priority 1)

**Timing:** Within 24-48 hours of Phase 4 completion

**Channel:** In-app notification + Email

**Message Template:**
```
Subject: 🎭 Algo novo no FalaMestre!

Olá [Nome],

Você provou ser um dos fãs mais dedicados do seu time! Parabéns por todas as vitórias e decisões importantes.

Como recompensa, desbloqueamos um conteúdo especial para você.

[LINK PARA VER CONTEÚDO]
```

**Follow-up:**
- Day 3: "Você viu o conteúdo especial? Tem coisas interessantes lá!"
- Day 5: Educational moment: "Sabia que no clube do seu time, os Tokens do Socios.com dão benefícios parecidos?"

### Tier 2: Early Interest (Priority 2)

**Timing:** After 7 days of natural interest expression

**Channel:** In-app notification

**Campaign:**
```
Phase 1: Education (Days 1-3)
- "Como funcionam Fan Tokens?" (tutorial em 3 partes)
- "5 coisas que você precisa saber antes de comprar"
- "Benefícios de ser token holder do seu time"

Phase 2: Information (Days 4-7)
- "No site do seu time no Socios.com, você pode comprar seus primeiros Tokens."

[LINK PARA COMPRA COM BÔNUS]
```

### Tier 3: Soft Trained Users (Priority 3)

**Timing:** After 14 days of soft training completion

**Channel:** Push notifications + In-app banners

**Campaign:**
```
Week 1-2: Appreciation + curiosity
- "Você já entendeu quase tudo o que o jogo oferece!"
- "Sabia que os Tokens são como uma continuação natural?"
- "Quer descobrir mais coisas interessantes?"

Week 3-4: Token introduction
- "O clube do seu time tem seus Tokens no Socios.com"
- "Mesma experiência que você domina no jogo"
- "Quer experimentar com Tokens de verdade? É a mesma lógica!"

[LINK PARA OFERTAS]
```

---

## Data Export Format (Updated)

```csv
user_id,primary_segment,is_hot_lead,hot_lead_tier,soft_training_score,purchase_intent,crypto_awareness,engagement_level,team_preference,region,estimated_ltv,recommended_action,affiliate_consent
abc123,HOT_LEAD,1,85,87,92,85,Leões do Norte,SP,200-350,"Soft outreach: understands tokens well",TRUE
def456,HOT_LEAD,2,72,65,85,78,Falcões de Aço,SP,150-250,"Educational outreach with discovery",TRUE
ghi789,HOT_LEAD,1,58,45,85,92,Trovão FC,SP,100-200,"Early interest: natural curiosity",TRUE
```

---

## Success Metrics (Updated)

### Hot Lead Conversion Targets

| Metric | Target | Timeline |
|--------|--------|----------|
| Hot Lead Rate | 4.5% | Ongoing |
| Tier 1 (Phase 4 Ready) Conversion | 10-15% | 30 days |
| Tier 2 (Early Interest) Conversion | 5-10% | 60 days |
| Soft Trained Conversion | 3-8% | 90 days |
| Average LTV | $175-325 | 90 days |
| Soft Training Completion | Average 65% | 90 days |
| Socios Link Click Rate | 30% of modal viewers | 90 days |
| Cost Per Hot Lead | <$1 | 90 days |

### Tracking

```typescript
interface UpdatedHotLeadMetrics {
  total_users: number;
  hot_leads_count: number;
  hot_lead_rate: number;
  
  by_tier: {
    tier1_count: number;
    tier1_converted: number;
    tier2_count: number;
    tier2_converted: number;
    tier3_count: number;
    tier3_converted: number;
  },
  
  by_soft_training_score: {
    average_score: number,
    conversion_by_score_range: {
      "75-85": number,  // 12-15% conversion
      "60-74": number,  // 5-10% conversion
      "50-59": number,  // 3-8% conversion
      "below-50": number,  // 1-5% conversion
    }
  };
  
  conversion_rates: {
    tier1_rate: number,  // Phase 4 ready
    tier2_rate: number,  // Early interest
    tier3_rate: number,  // Soft trained
    overall: number  // Weighted average
  };
  
  revenue: {
    affiliate_revenue: number;
    token_sales_attributed: number;
    ltv_per_tier1: number,  // $200-350
    ltv_per_tier2: number,  // $80-150
    ltv_per_tier3: number,  // $100-200
  },
  
  soft_training_metrics: {
    phase_completion_rate: number,
    average_soft_training_score: number,
    phase_4_readiness_rate: number
  };
  
  costs: {
    lead_generation_cost: number,
    outreach_cost: number,
    data_analytics_cost: number
  }
}
```

---

## Related Documents

- [[01-Fan-Token-Integration]] - Updated with soft training approach
- [[12-Soft-Training-Progression]] - Phase-by-phase strategy
- [[02-Analytics-Clustering]] - Updated to track soft training signals
- [[03-Conversational-Interface]] - AI prompts for each phase
- [[09-GDPR-Compliance]] - Consent management

---

*"Natural curiosity creates higher conversion than marketing. Train, don't sell."*


## Three-Tier Hot Lead Criteria

### Tier 1 Criteria: Purchase Intent > 80%

Users who demonstrate strong intent to purchase fan tokens through explicit behavior and signals.

**Qualification:**
- `purchase_intent_score >= 80` (from behavioral clustering)
- **OR** `crypto_awareness_score >= 70`

**Why 80%+?**
- High conversion probability (20-25% vs 2-5% baseline)
- Short sales cycle (1-2 touchpoints vs 5-7)
- Higher LTV ($150-300 vs $50-100 average)

**Behavioral Signals:**
- Frequently asks about tokens or crypto wallet connection
- Actively searches for "fan token [club name]" in app
- Engages with token-related educational content
- Expresses interest in "real" tokens vs in-game points
- Has connected wallet (even with small balance)

**Example Hot Leads:**
```json
{
  "user_id": "user-123",
  "purchase_intent": 87,
  "crypto_awareness": 92,
  "engagement_level": 85,
  "is_hot_lead": true,
  "hot_lead_reasons": [
    "Alta intenção de compra de token (87%)",
    "Consciência crypto elevada (92%)",
    "Mencionou tokens 12 vezes nas últimas 2 semanas",
    "Perguntou como conectar carteira Fan Token"
  ],
  "recommended_action": "Immediate outreach within 24-48h",
  "estimated_ltv": "$200-350",
  "priority": 1
}
```

---

### Tier 2 Criteria: Crypto Awareness > 70%

Users with good crypto knowledge but lower purchase intent. Good candidates for education and nurture campaigns.

**Qualification:**
- `crypto_awareness_score >= 70`
- AND `purchase_intent_score < 80`
- AND `engagement_level >= 70`

**Why This Tier?**
- Already understand basics (educational cost lower)
- Show sustained interest (not just curiosity)
- Can be converted with education + incentives
- Represents "warm leads" category

**Behavioral Signals:**
- Asks intelligent questions about tokens and blockchain
- Reads crypto educational content when available
- Shows interest in understanding token utility
- Moderate to high engagement with token-related features
- Discusses tokens with others (social proof of knowledge)

**Example Hot Leads:**
```json
{
  "user_id": "user-456",
  "purchase_intent": 65,
  "crypto_awareness": 85,
  "engagement_level": 78,
  "is_hot_lead": true,
  "hot_lead_reasons": [
    "Consciência crypto elevada (85%) mas intenção de compra ainda moderada (65%)",
    "Fez 8 perguntas sobre Fan Tokens nos últimos 10 dias",
    "Leu todos os tutoriais de tokens do app"
  ],
  "recommended_action": "Send educational content + special offer",
  "estimated_ltv": "$80-150",
  "priority": 2
}
```

---

### Tier 3 Criteria: Engagement Top 20%

Highly engaged users with behavioral patterns suggesting purchase potential. Best for remarketing and retention campaigns.

**Qualification:**
- `engagement_level >= 80` (top 20% percentile)
- AND `purchase_intent_score >= 50`
- AND `session_frequency >= "frequent"` (3+ sessions/week)

**Why This Tier?**
- Highly engaged = invested in product
- Top 20% usually correlates with willingness to spend
- Strong retention candidates (not just leads)
- Potential for upsell and cross-sell

**Behavioral Signals:**
- Daily or near-daily app usage
- Long session durations (15+ minutes)
- Achievements and milestones unlocked
- Social sharing of game achievements
- Competes in tournaments and leaderboards
- Consistent play pattern over 30+ days

**Example Hot Leads:**
```json
{
  "user_id": "user-789",
  "purchase_intent": 52,
  "crypto_awareness": 45,
  "engagement_level": 92,
  "is_hot_lead": true,
  "hot_lead_reasons": [
    "Engajamento excepcional (top 8% de usuários)",
    "Sessões diárias consistentes (média 25 min/dia)",
    "Desbloqueou 12 conquistas no último mês",
    "Compartilhou 8 resultados no Instagram",
    "Competitivo em 5 torneios diferentes"
  ],
  "recommended_action": "Nurture with engagement-focused offers + social proof",
  "estimated_ltv": "$100-200",
  "priority": 3
}
```

---

## Classification Logic

### Implementation

```typescript
interface HotLeadClassification {
  userId: string;
  cluster: BehavioralCluster;
  classification: "HOT_LEAD" | "WARM_LEAD" | "COLD_LEAD" | "NOT_QUALIFIED";
  priority: 1 | 2 | 3 | 4;
  isHotLead: boolean;
  hotLeadReasons: string[];
  recommendedAction: string;
  estimatedLTV: string;
  confidence: number; // 0-100
}

function classifyHotLead(
  userId: string,
  cluster: BehavioralCluster
): HotLeadClassification {
  const hotLeadReasons: string[] = [];
  const scores = {
    purchaseIntent: cluster.purchase_intent,
    cryptoAwareness: cluster.crypto_awareness,
    engagement: cluster.engagement_level
  };
  
  // Check Tier 1: Purchase Intent > 80% OR Crypto Awareness > 70%
  if (scores.purchaseIntent >= 80 || scores.cryptoAwareness >= 70) {
    if (scores.purchaseIntent >= 80) {
      hotLeadReasons.push(`Alta intenção de compra (${scores.purchaseIntent}%)`);
    }
    if (scores.cryptoAwareness >= 70) {
      hotLeadReasons.push(`Consciência crypto elevada (${scores.cryptoAwareness}%)`);
    }
    
    return {
      userId,
      cluster,
      classification: "HOT_LEAD",
      priority: 1,
      isHotLead: true,
      hotLeadReasons,
      recommendedAction: "Immediate outreach within 24-48h",
      estimatedLTV: "$150-300",
      confidence: Math.max(scores.purchaseIntent, scores.cryptoAwareness, scores.engagement)
    };
  }
  
  // Check Tier 2: Crypto Awareness > 70% (lower purchase intent)
  if (scores.cryptoAwareness >= 70 && scores.purchaseIntent < 80 && scores.engagement >= 70) {
    hotLeadReasons.push(`Consciência crypto (${scores.cryptoAwareness}%) com engajamento sólido`);
    
    return {
      userId,
      cluster,
      classification: "HOT_LEAD",
      priority: 2,
      isHotLead: true,
      hotLeadReasons,
      recommendedAction: "Send educational content + special offer",
      estimatedLTV: "$80-150",
      confidence: scores.cryptoAwareness
    };
  }
  
  // Check Tier 3: Engagement Top 20%
  if (scores.engagement >= 80 && scores.purchaseIntent >= 50) {
    const engagementPercentile = getEngagementPercentile(userId);
    if (engagementPercentile >= 80) {
      hotLeadReasons.push(`Engajamento excepcional (top ${engagementPercentile}% dos usuários)`);
    }
    
    return {
      userId,
      cluster,
      classification: "HOT_LEAD",
      priority: 3,
      isHotLead: true,
      hotLeadReasons,
      recommendedAction: "Nurture with engagement-focused offers + social proof",
      estimatedLTV: "$100-200",
      confidence: scores.engagement
    };
  }
  
  // Not qualified
  return {
    userId,
    cluster,
    classification: "COLD_LEAD",
    priority: 4,
    isHotLead: false,
    hotLeadReasons: [],
    recommendedAction: "Continue data collection until criteria met",
    estimatedLTV: "$10-50",
    confidence: Math.max(scores.purchaseIntent, scores.cryptoAwareness, scores.engagement) * 0.5
  };
}
```

---

## Lead Quality Distribution (Expected for 10K Users)

```yaml
Expected Distribution:
  hot_leads: 3.2% (~320 users)
    tier_1_purchase_intent: 1.8% (~180 users)
    tier_2_crypto_aware: 1.4% (~140 users)
  
  warm_leads: 12.8% (~1,280 users)
  
  cold_leads: 84% (~8,400 users)

Quality by Tier:
  tier_1_leads:
    - purchase_intent_avg: 87%
    - crypto_awareness_avg: 92%
    - engagement_avg: 85%
    - estimated_ltv: "$200-350"
    - conversion_probability: "20-25%"
    - recommended_touchpoints: 1-2
  
  tier_2_leads:
    - purchase_intent_avg: 65%
    - crypto_awareness_avg: 85%
    - engagement_avg: 78%
    - estimated_ltv: "$80-150"
    - conversion_probability: "5-10%"
    - recommended_touchpoints: 2-4
  
  tier_3_leads:
    - purchase_intent_avg: 52%
    - crypto_awareness_avg: 45%
    - engagement_avg: 92%
    - estimated_ltv: "$100-200"
    - conversion_probability: "3-8%"
    - recommended_touchpoints: 3-5
  
  Overall:
    - hot_lead_rate: "3.2%"
    - weighted_avg_ltv: "$125-233"
    - overall_conversion_probability: "8-12%"
```

---

## Outreach Strategy by Tier

### Tier 1: Immediate Outreach (Priority 1)

**Timing:** Within 24-48 hours of qualifying

**Channel:** SMS (for high urgency) + Email

**Message Template:**
```
Subject: 🎁 Oferta Exclusiva: Fan Tokens para Você, [Nome]!

Você foi identificado como um dos fãs mais engajados do seu time

🏆 20% de desconto em Fan Tokens do seu clube
💰 Oferta válida por 48 horas
🎁 Bônus: R$50 em créditos de jogo

Essa oferta está disponível graças ao seu alto nível de engajamento 
e interesse no FalaMestre!

[LINK PARA COMPRA]
```

**Follow-up:**
- Day 2: Reminder email
- Day 4: Final chance email
- Day 7: Retargeting if no response

### Tier 2: Educational Campaign (Priority 2)

**Timing:** Within 7 days of qualifying

**Channel:** Email + In-app notification

**Campaign:**
```
Phase 1: Education (Days 1-3)
- "Como funcionam Fan Tokens?" (tutorial em 3 partes)
- "5 coisas que você precisa saber antes de comprar"
- "Benefícios de ser token holder do seu time"

Phase 2: Soft Offer (Days 4-7)
- Special welcome bonus
- Tiered spending options
- Social proof of other fans

[LINK PARA COMPRA COM BÔNUS]
```

### Tier 3: Engagement Campaign (Priority 3)

**Timing:** Within 14 days of qualifying

**Channel:** Push notifications + In-app banners

**Campaign:**
```
Week 1-2: Show appreciation
- Highlight achievements: "Você já ganhou X partidas!",
- Exclusive tournaments invitation

Week 3-4: Time-limited offers
- "Você está no top 10%! Aqui está uma oferta especial..."
- Tournament participation rewards

[LINK PARA OFERTAS ESPECIAIS]
```

---

## Data Export Format

### Hot Lead CSV for Partners

```csv
user_id,primary_segment,is_hot_lead,hot_lead_tier,purchase_intent,crypto_awareness,engagement_level,team_preference,region,estimated_ltv,recommended_action,affiliate_consent
abc123,HIGH_INTENT_TOKEN_BUYER,1,87,92,85,Leões do Norte,SP,200-350,"Immediate outreach within 24-48h",TRUE
def456,WARM_CRYPTO_CURIOUS,2,65,85,78,Falcões de Aço,SP,80-150,"Send educational content + special offer",TRUE
ghi789,HIGH_ENGAGEMENT,3,52,45,92,Trovão FC,SP,100-200,"Nurture with engagement-focused offers",TRUE
```

### Privacy Guarantees

- **Anonymization Applied:**
  - User ID: One-way hash (cannot reverse)
  - No PII: Name, email, username removed
  - Location: State level only (not city)
  - Consent verified: Only users with explicit opt-in

- **Data Usage Restrictions:**
  - Purpose: Targeted marketing only
  - Prohibited: Selling data, cross-device tracking
  - Retention: Data deleted after 2 years or consent revocation

---

## Success Metrics

### Hot Lead Conversion Targets

| Metric | Target | Timeline |
|--------|--------|----------|
| Hot Lead Rate | 2.5-4% | Ongoing |
| Tier 1 Conversion | 20-25% | 30 days |
| Tier 2 Conversion | 5-10% | 60 days |
| Tier 3 Conversion | 3-8% | 90 days |
| Average LTV | $125-233 | 90 days |
| Cost Per Hot Lead | <$1 | 90 days |

### Tracking

```typescript
interface HotLeadMetrics {
  total_users: number;
  hot_leads_count: number;
  hot_lead_rate: number;
  
  by_tier: {
    tier1_count: number;
    tier1_converted: number;
    tier2_count: number;
    tier2_converted: number;
    tier3_count: number;
    tier3_converted: number;
  },
  
  conversion_rates: {
    tier1_rate: number,  // Target: 20-25%
    tier2_rate: number,  // Target: 5-10%
    tier3_rate: number,  // Target: 3-8%
  },
  
  revenue: {
    affiliate_revenue: number,
    token_sales_attributed: number,
  ltv_per_tier1: number,  // $200-350
    ltv_per_tier2: number,  // $80-150
    ltv_per_tier3: number,  // $100-200
  },
  
  costs: {
    lead_generation_cost: number,
    outreach_cost: number,
    data_analytics_cost: number
  }
}
```

---

## Related Documents

- [[10-Three-Tier-LLM-Strategy]] - How behavioral clustering works
- [[09-GDPR-Compliance]] - Consent management for data sharing
- [[03-Database-Schema]] - `user_clusters` table structure
- [[02-Analytics-Clustering]] - Full analytics pipeline

---

*"Quality leads come from behavioral data, not guesses."*
