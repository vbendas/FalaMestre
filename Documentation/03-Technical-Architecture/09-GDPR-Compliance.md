# GDPR Compliance Strategy

---
tags: #legal #compliance #gdpr #privacy #data-protection
status: complete
priority: critical
phase: mvp
last_updated: 2026-01-20
---

## Overview

FalaMestre! implements comprehensive GDPR compliance to operate in Brazil and export leads to European markets while maintaining user trust and legal requirements.

> [!important] Core Principle
> **Transparent consent management with granular opt-in controls and data anonymization for third-party sharing.**

---

## GDPR Rights Implementation

### User Rights

| Right | Implementation | UI Location |
|-------|---------------|--------------|
| **Right to Access** | Export all user data at any time | Settings → "Baixar dados" |
| **Right to Rectification** | Request correction of inaccurate data | Settings → "Solicitar correção" |
| **Right to Erasure** | Delete account and all data | Settings → "Excluir conta" |
| **Right to Restrict** | Limit processing of specific data types | Settings → Consent toggles |
| **Right to Portability** | Export data in machine-readable format | Settings → "Exportar dados" |
| **Right to Object** | Opt-out of automated profiling | Settings → "Sair de clustering" |

---

## Consent Management System

### Three-Layer Consent Structure

```typescript
interface UserConsents {
  // Layer 1: Essential (Always required)
  essential: {
    authentication: true,  // Cannot be disabled
    basic_usage: true,  // Cannot be disabled
    cookies_essential: true  // Cannot be disabled
  },
  
  // Layer 2: Behavioral Analysis (Default: OFF, user opts IN)
  behavioral_analysis: {
    enabled: boolean,  // Default: false
    description: "Permitir análise comportamental para recomendações",
    purposes: [
      "Melhorar experiência de jogo",
      "Fornecer recomendações táticas",
      "Sugerir jogadores"
    ],
    data_collected: [
      "Padrões de jogo (sessão-level, não por ação)",
      "Estilo tático (agressivo, defensivo, equilibrado)",
      "Decisões de compra (transferências, treinamentos)",
      "Nível de engajamento"
    ],
    retention: "until_revoked"
  },
  
  // Layer 3: Affiliate Sharing (Default: OFF, explicit opt-in required)
  affiliate_sharing: {
    enabled: boolean,  // Default: false
    description: "Podemos compartilhar seu interesse com empresas de Fan Token?",
    highlight: true,  // UI emphasis
    purposes: [
      "Receber ofertas relevantes de tokens",
      "Ofertas de parceiros de cripto",
      "Promoções exclusivas"
    ],
    data_shared: [
      "Apenas dados anonimizados (sem nome, email)",
      "Segmentação comportamental",
      "Score de intenção de compra",
      "Preferências de time (estado/cidade, não cidade específica)",
      "Prontidão para compra"
    ],
    data_not_shared: [
      "Nome completo",
      "Email",
      "Nome de usuário",
      "Localização precisa",
      "Histórico de conversas",
      "Dados de ações individuais"
    ],
    affiliates: [
      "Socios.com",
      "Empresas de Fan Token de clubes brasileiros",
      "Exchanges de criptomoedas brasileiras",
      "Outras empresas de cripto (com revisão prévia)"
    ],
    retention: "until_revoked",
    explicit_consent_required: true
  },
  
  // Metadata
  consent_timestamps: {
    essential: Date,
    behavioral_analysis: Date | null,
    affiliate_sharing: Date | null
  },
  consent_version: string,  // Track which version user agreed to
  last_updated: Date
}
```

---

## Upfront Opt-In Flow (First Screen After Signup)

```typescript
interface ConsentFlow {
  step1_essential: {
    title: "Dados Essenciais (Obrigatório)",
    description: "Para usar o FalaMestre!, precisamos de:",
    items: [
      {
        label: "Criar sua conta",
        required: true,
        locked: true
      },
      {
        label: "Autenticação segura",
        required: true,
        locked: true
      },
      {
        label: "Uso básico do app",
        required: true,
        locked: true
      }
    ]
  },
  
  step2_behavioral: {
    title: "Melhorar sua Experiência",
    description: "Queremos analisar seu comportamento para dar recomendações melhores",
    items: [
      {
        label: "Permitir análise comportamental",
        required: false,
        default: false,
        highlight: false,
        details: "Usamos seus padrões de jogo para entender melhor suas preferências"
      }
    ]
  },
  
  step3_affiliate: {
    title: "🎁 Ofertas de Fan Tokens",
    description: "Queremos que você tenha acesso às melhores ofertas de tokens do seu time!",
    items: [
      {
        label: "Quero receber ofertas relevantes",
        required: false,
        default: false,
        highlight: true,
        details: "Podemos compartilhar seu interesse (anonimizado) com empresas de fan tokens para ofertas exclusivas",
        privacy_note: "NUNCA compartilhamos seu nome ou email. Apenas segmentos comportamentais."
      }
    ]
  },
  
  step4_summary: {
    can_proceed: boolean,
    required_consents: 1,  // Essential only
    recommended_consents: 3  // All three layers
    button_text: "Continuar e Começar a Jogar"
  }
}
```

### UI Implementation

```tsx
// components/consent/ConsentModal.tsx
"use client";

import { useState } from 'react';

export function ConsentModal() {
  const [consents, setConsents] = useState({
    essential: true,  // Always checked, locked
    behavioral_analysis: false,
    affiliate_sharing: false
  });
  
  const canProceed = consents.essential;
  
  return (
    <Modal>
      <h2>Antes de começar...</h2>
      
      {/* Essential - Locked */}
      <Section>
        <h3>✅ Essencial (Obrigatório)</h3>
        <Checkbox
          checked={true}
          disabled={true}
          label="Dados de conta e uso básico"
        />
      </Section>
      
      {/* Behavioral - Optional */}
      <Section>
        <h3>Recomendações Inteligentes</h3>
        <p className="text-sm">
          Queremos analisar seu comportamento para entender melhor suas preferências
          e dar recomendações personalizadas.
        </p>
        <Checkbox
          checked={consents.behavioral_analysis}
          onChange={(v) => setConsents({...consents, behavioral_analysis: v})}
          label="Permitir análise comportamental"
        />
      </Section>
      
      {/* Affiliate - Optional, Highlighted */}
      <Section highlight={true}>
        <h3>🎁 Ofertas de Fan Tokens</h3>
        <p className="text-sm">
          Receba ofertas relevantes de tokens do seu time e parceiros de cripto!
        </p>
        <Checkbox
          checked={consents.affiliate_sharing}
          onChange={(v) => setConsents({...consents, affiliate_sharing: v})}
          label="Quero receber ofertas"
          highlight={true}
        />
        <p className="text-xs text-gray-500 mt-2">
          ℹ️ Apenas dados anonimizados (sem nome, email). Você pode desativar a qualquer momento.
        </p>
      </Section>
      
      <Button
        disabled={!canProceed}
        onClick={() => saveConsentsAndContinue(consents)}
      >
        Continuar e Começar a Jogar
      </Button>
      
      <Link href="/privacy-policy" className="text-sm">
        Leia nossa política de privacidade
      </Link>
    </Modal>
  );
}
```

---

## Granular Settings Page

### Always Accessible Consent Management

```tsx
// components/settings/ConsentSettings.tsx
"use client";

import { useState, useEffect } from 'react';

export function ConsentSettings() {
  const [consents, setConsents] = useConsents();
  
  return (
    <SettingsPage>
      <h2>Configurações de Privacidade</h2>
      
      {/* Section 1: Data Analysis */}
      <ConsentSection>
        <h3>📊 Análise de Dados</h3>
        <p className="description">
          Useamos seus padrões de jogo (nível de sessão) para entender melhor
          suas preferências e fornecer recomendações.
        </p>
        
        <ConsentToggle
          label="Análise comportamental para clustering"
          description="Usamos seu comportamento para entender melhor"
          checked={consents.behavioral_analysis}
          onChange={(v) => updateConsent('behavioral_analysis', v)}
        />
        <p className="info">
          Desative se não quer que analisemos seus padrões
        </p>
      </ConsentSection>
      
      {/* Section 2: Affiliate Sharing - Highlighted */}
      <ConsentSection highlight={true}>
        <h3>💼 Compartilhamento com Parceiros</h3>
        <p className="description">
          Podemos compartilhar seu interesse com empresas de Fan Token para ofertas exclusivas.
        </p>
        
        <ConsentToggle
          label="Compartilhar com empresas de Fan Token"
          description="Podemos sugerir ofertas relevantes para você"
          checked={consents.affiliate_sharing}
          onChange={(v) => updateConsent('affiliate_sharing', v)}
          highlight={true}
        />
        <p className="info highlight">
          <strong>Só compartilhamos dados anonimizados (sem nome, email)</strong><br/>
          Estado/cidade (não cidade específica)<br/>
          Segmentação comportamental (não histórico de conversa)
        </p>
        
        <AffiliateDetails>
          <h4>Parceiros Atuais:</h4>
          <ul>
            <li>Socios.com (Tokens de clubes brasileiros)</li>
            <li>Empresas de Fan Token</li>
            <li>Exchanges de criptomoedas brasileiras</li>
            <li>Outras empresas (com aprovação prévia)</li>
          </ul>
          <Link href="/affiliate-partners">Ver detalhes de todos os parceiros</Link>
        </AffiliateDetails>
      </ConsentSection>
      
      {/* GDPR Rights */}
      <GDPRActions>
        <h3>🔒 Seus Direitos (GDPR)</h3>
        <p className="description">
          Você tem controle total sobre seus dados conforme o GDPR.
        </p>
        
        <GDPRButton onClick={downloadAllData}>
          📥 Baixar todos os meus dados
        </GDPRButton>
        <GDPRButton onClick={requestDataCorrection}>
          ✏️ Solicitar correção de dados
        </GDPRButton>
        <GDPRButton onClick={deleteAccount} variant="danger">
          🗑️ Excluir conta e todos os dados
        </GDPRButton>
      </GDPRActions>
    </SettingsPage>
  );
}
```

---

## Data Anonymization for Third-Party Sharing

### What Gets Shared vs What Doesn't

```typescript
// Before sharing with affiliates
function anonymizeUserForSharing(
  userId: string,
  user: User,
  cluster: BehavioralCluster
): AnonymizedLead {
  
  // NEVER share PII without explicit consent for each partner
  return {
    // One-way hash (cannot reverse)
    userId: hashWithSalt(userId, process.env.AFFILIATE_SALT),
    
    // NO PII shared
    // email: REMOVED
    // username: REMOVED
    // realName: REMOVED
    // location: REMOVED (only state/city level, not city)
    // ipAddress: REMOVED
    // conversationHistory: REMOVED (only aggregated metrics)
    // individualActions: REMOVED (only session-level aggregates)
    
    // Segmentation data only
    primary_segment: cluster.primary_segment,
    secondary_segments: cluster.secondary_segments,
    
    // Geographic data (coarse)
    region: user.region,  // State level only (e.g., "SP", "RJ", "MG")
    // city: REMOVED for sharing (kept only for internal)
    
    // Behavioral scores (aggregated, not raw)
    purchase_intent: cluster.purchase_intent,
    risk_appetite: cluster.risk_appetite,
    competitiveness: cluster.competitiveness,
    crypto_awareness: cluster.crypto_awareness,
    engagement_level: cluster.engagement_level,
    
    // Lead classification
    is_hot_lead: cluster.is_hot_lead,
    hot_lead_reasons: cluster.hot_lead_reasons,
    
    // Clustering metadata
    cluster_id: cluster.id,
    last_updated: cluster.computed_at,
    
    // Consent verification
    affiliate_sharing_consent: user.consents.affiliate_sharing,
    consent_date: user.consent_timestamps.affiliate_sharing,
    consent_version: user.consent_version,
    
    // Data usage restrictions
    allowed_uses: [
      "targeted_marketing",
      "personalized_offers",
      "educational_content"
    ],
    prohibited_uses: [
      "selling_personal_data",
      "profiling_without_consent",
      "cross_device_tracking"
    ],
    
    // Expiration
    data_retention_until: user.consent_expires_at
  };
}

// One-way hash function (cannot be reversed)
function hashWithSalt(input: string, salt: string): string {
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', salt);
  hmac.update(input);
  return hmac.digest('hex');
}
```

---

## Data Retention Policy

```yaml
Data Retention by Type:
  
  Active Users:
    - Duration: Indefinite (with consent)
    - Consent review: Every 6 months
    - Right to delete: Always available
  
  Inactive Users (no login > 365 days):
    - Duration: 2 years after last login
    - Notification: 30 days before deletion
    - Data export available: Up to deletion date
  
  Deleted Accounts:
    - Immediate: All data deleted from production
    - Backup retention: 30 days (legal requirement only)
    - Marketing emails: Immediate unsubscribe
  
  Affiliate Lead Data:
    - Retention: Until consent revoked or 2 years
    - Sharing frequency: Weekly batches
    - Anonymization: Applied before each export
    - No personal data: Ever shared
```

---

## Cookie and Tracking Policy

```typescript
const cookiePolicy = {
  essential_cookies: {
    purpose: "Authentication and basic functionality",
    duration: "7 days",
    consent_required: false,  // Always allowed
    examples: ["session_token", "auth_token"]
  },
  
  analytics_cookies: {
    purpose: "Session-level analytics (not per-action)",
    duration: "30 days",
    consent_required: true,  // Requires behavioral_analysis consent
    examples: ["session_id", "session_start", "screens_viewed", "session_duration"]
  },
  
  marketing_cookies: {
    purpose: "Affiliate offer targeting",
    duration: "90 days",
    consent_required: true,  // Requires affiliate_sharing consent
    examples: ["segment_id", "lead_score", "interest_categories"]
  },
  
  prohibited_tracking: {
    fingerprinting: false,
    cross_site_tracking: false,
    invasive_profiling: false,
    sale_to_third_parties: false
  }
};
```

---

## Consent Versioning

```typescript
interface ConsentVersion {
  version: string,
  effective_date: Date,
  changes: string[],
  migration_required: boolean
}

const consentHistory: ConsentVersion[] = [
  {
    version: "1.0",
    effective_date: "2026-01-20",
    changes: [
      "Initial implementation of GDPR-compliant consent system",
      "Three-layer consent structure (essential, behavioral, affiliate)",
      "Upfront opt-in for all non-essential data collection",
      "Granular opt-in controls in settings",
      "Data anonymization for affiliate sharing"
    ],
    migration_required: false
  }
];

function requiresConsentMigration(
  currentVersion: string,
  newVersion: string
): boolean {
  // If policy changes materially, require re-consent
  return newVersion !== currentVersion;
}
```

---

## Related Documents

- [[01-Tech-Stack]] - Database and ORM setup
- [[02-Database-Schema]] - User and consent tables
- [[03-Behavioral-Clustering]] - How data is used for segmentation
- [[04-Hot-Lead-Definition]] - Lead scoring methodology

---

*"Privacy is not a feature, it's a fundamental right of our users."*
