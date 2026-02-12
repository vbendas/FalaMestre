# Analytics & User Clustering

---
tags: #business #analytics #clustering #cdp #liveramp #marketing
status: complete
priority: high
phase: mvp
last_updated: 2026-01-18
---

## Overview

Fala Mestre! is built as a **regulatory-compliant user acquisition channel** for Socios.com. Every conversation reveals user intent, preferences, and behavior patterns - enabling sophisticated marketing segmentation while staying fully compliant with Brazilian crypto regulations.

> [!important] Regulatory-Compliant Architecture
> **Fala Mestre! tracks ONLY game behaviors. All crypto messaging, wallet connection, and token education is handled by Socios.com. This keeps the game in the "grey zone" while Socios.com maintains full regulatory compliance.**

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

## Analytics Architecture

### Data Pipeline

```
+------------------+     +------------------+     +------------------+
|   Game Events    | --> |   Event Store    | --> |   Processing     |
|   (Mixpanel)     |     |   (Supabase)     |     |   (Daily Batch)  |
+------------------+     +------------------+     +------------------+
                                                          |
                                                          v
+------------------+     +------------------+     +------------------+
|   Ad Platforms   | <-- |   LiveRamp CDP   | <-- |  AI Clustering   |
|   (FB, Google)   |     |   (Audiences)    |     |  (Claude Sonnet) |
+------------------+     +------------------+     +------------------+
```

### Event Tracking

```typescript
// Core events tracked
const eventSchema = {
  // Session events
  'session_start': { device, source, referrer },
  'session_end': { duration, matches_played, points_earned },
  
  // Game events
  'match_played': { opponent, result, score, formation, tactics },
  'transfer_made': { player, price, type },
  'training_completed': { players, type, improvement },
  'formation_changed': { from, to, reason },
  
  // Conversation events
  'message_sent': { intent, length, response_time },
  'card_viewed': { card_type, duration },
  'action_clicked': { action, context },
  
  // Economy events
  'points_earned': { amount, source },
  'voucher_earned': { voucher_id },
  'purchase_made': { item, price, currency },
  'ad_watched': { ad_type, completed },
  
  // Social events
  'friend_invited': { method },
  'achievement_shared': { platform, achievement },
  'tournament_joined': { tournament_id }
};
```

---

## User Clustering

### Behavioral Clustering (Game-Only Metrics)

**IMPORTANT:** We track ONLY game behaviors. No crypto-related metrics.

**Tracked Behaviors:**
- Match completion rate
- Prediction accuracy
- Session frequency/duration
- Points earned
- Leaderboard position
- Social sharing (game results)
- Educational content engagement (non-crypto topics)

**DO NOT track:**
- Crypto knowledge level
- Wallet ownership
- Token holdings
- Financial intent

### Cluster Definitions

#### 1. Casual Fan (60% of users)

```yaml
Profile:
  Sessions per week: 1-3
  Average session: 5-10 minutes
  Matches per session: 1-2
  Narrative engagement: Low (skips often)
  
Behaviors:
  - Quick sessions during commute
  - Prefers simple decisions
  - Responsive to notifications
  - Price-sensitive
  
Marketing Strategy:
  - Push notifications for engagement
  - Simple, visual ad creative
  - Focus on fun, not depth
  - "Special rewards" messaging (no crypto)
  
Conversion Potential: Medium
Churn Risk: High
Recommended Ads: Facebook/Instagram Stories
```

#### 2. Regular Fan (30% of users)

```yaml
Profile:
  Sessions per week: 3-5
  Average session: 10-20 minutes
  Matches per session: 2-4
  Points earned: 500-2000
  
Behaviors:
  - Consistent engagement
  - Medium session frequency
  - Community-focused
  - Values rewards
  
Marketing Strategy:
  - Community messaging
  - "Join the fan community"
  - "Exclusive content for dedicated fans"
  - "Special rewards available"
  
Conversion Potential: High
Churn Risk: Medium
Recommended Ads: Facebook, Instagram
```

#### 3. Power User (10% of users)

```yaml
Profile:
  Sessions per week: 5-7
  Average session: 20-30 minutes
  Matches per session: 3-5
  Points earned: 2000+
  Days active: 30+
  
Behaviors:
  - Daily engagement
  - High points, leaderboard
  - Social sharing
  - Community participation
  
Marketing Strategy:
  - "Special rewards available"
  - "Top fan recognition"
  - "Exclusive access"
  - "Priority access to benefits"
  
Conversion Potential: Very High
Churn Risk: Very Low
Recommended Ads: All platforms (high intent)
```

#### 4. Cluster Distribution (Target)

```yaml
Total Users: 1000
Power Users: 100 (10%)
  -> Email sent: 100 (100% of Power Users)
  -> Email open: 40 (40% open rate)
  -> Landing page: 30 (75% of openers)
  -> Wallet connect: 15 (50% of landing page)
  -> Token purchase: 8 (50% of wallet connect)

Target Conversion Rate:
  - 25-30% of Power Users (not total users)
  - ~2.5-3% of total users
  - This is excellent for crypto user acquisition
```

---

## Real-Time Cluster Tracking

### Real-Time Architecture

```typescript
// Real-time cluster engine (updates every session)
const clusterEngine = {
  updateUser: async (userId, sessionData) => {
    const user = await getUser(userId);
    const newCluster = calculateCluster(user, sessionData);
    
    if (newCluster !== user.cluster) {
      // Trigger Socios.com API for Power Users
      if (newCluster === 'power_user') {
        await sociosAPI.notifyPowerUser(userId, user.points);
      }
    }
    
    await updateUserCluster(userId, newCluster);
  }
};

// Cluster calculation (behavior only)
function calculateCluster(user, sessionData) {
  const totalPoints = user.points || 0;
  const daysActive = user.daysActive || 0;
  const matchesPlayed = user.matchesPlayed || 0;
  
  if (matchesPlayed < 5) return 'casual_fan';
  if (totalPoints > 2000 && daysActive > 30) return 'power_user';
  if (matchesPlayed > 10) return 'regular_fan';
  return 'casual_fan';
}
```

### Socios.com Integration

```typescript
// FalaMestre! calls this when user hits Power User
const sociosAPI = {
  notifyPowerUser: async (userId, points) => {
    // Send to Socios.com webhook
    // They handle email, compliance, crypto messaging
    return { success: true };
  }
};
```

### Batch Processing (Daily)

```typescript
// Daily batch process for email triggers
async function processDailyBatch() {
  // 1. Get Power Users from last 24 hours
  const powerUsers = await db.users.findMany({
    where: {
      cluster: 'power_user',
      lastActive: { gte: daysAgo(1) }
    },
    select: {
      id: true,
      email: true,
      points: true,
      daysActive: true
    }
  });
  
  // 2. Batch for Socios.com API
  for (const user of powerUsers) {
    await sociosAPI.notifyPowerUser(user.id, user.points);
  }
}
```

### Real-Time Dashboard (For Chilliz)

```typescript
// Real-time dashboard metrics
const dashboardMetrics = {
  // Power User tracking (real-time)
  powerUsers: {
    current: 0,
    newToday: 0,
    threshold: 10 // 10% of total users
  },
  
  // Email triggers (batch)
  emailTriggers: {
    sent: 0,
    pending: 0,
    processed: 0
  },
  
  // Conversion funnel (real-time via Socios.com webhooks)
  conversionFunnel: {
    powerUsersIdentified: 0,
    emailsSent: 0,
    emailsOpened: 0,
    landingPageViews: 0,
    walletConnections: 0,
    tokenPurchases: 0
  }
};

// Real-time updates
function updateDashboard() {
  return {
    powerUsers: {
      current: countPowerUsers(),
      newToday: countNewPowerUsers(),
      percentage: (countPowerUsers() / totalUsers() * 100).toFixed(1) + '%'
    },
    
    emailTriggers: {
      sent: countEmailsSent(),
      pending: countPendingEmails(),
      processed: countProcessedEmails()
    },
    
    conversionFunnel: {
      powerUsersIdentified: countPowerUsers(),
      emailsSent: countEmailsSent(),
      emailsOpened: countEmailsOpened(),
      landingPageViews: countLandingPageViews(),
      walletConnections: countWalletConnections(),
      tokenPurchases: countTokenPurchases(),
      
      // Conversion rates
      emailOpenRate: calculateRate(countEmailsOpened(), countEmailsSent()),
      landingPageRate: calculateRate(countLandingPageViews(), countEmailsOpened()),
      walletConnectRate: calculateRate(countWalletConnections(), countLandingPageViews()),
      tokenPurchaseRate: calculateRate(countTokenPurchases(), countWalletConnections()),
      
      // Overall conversion
      overallConversion: calculateRate(countTokenPurchases(), countPowerUsers())
    }
  };
}
```

---

## LiveRamp CDP Integration

### Audience Segments

| Segment | Definition | Size (Target) | Use Case |
|---------|------------|---------------|----------|
| `high_value` | LTV > $20, engaged | 15% | Lookalike targeting |
| `at_risk` | Churn risk > 0.7 | 10% | Retention campaigns |
| `token_ready` | Near voucher, engaged | 20% | Conversion push |
| `premium_potential` | Engaged F2P, can afford | 25% | Subscription offers |
| `social_amplifier` | Shares, invites | 10% | Referral programs |
| `whale_potential` | High spender signals | 5% | VIP treatment |

### Sync Configuration

```typescript
const liveRampConfig = {
  // Sync frequency
  syncInterval: 'daily',
  
  // Segments to sync
  segments: [
    {
      name: 'fala_mestre_high_value',
      criteria: 'ltv > 20 AND cluster != "casual_fan"',
      platforms: ['facebook', 'google', 'tiktok']
    },
    {
      name: 'fala_mestre_at_risk',
      criteria: 'churn_risk > 0.7 AND days_since_active > 3',
      platforms: ['facebook', 'google']
    },
    {
      name: 'fala_mestre_token_ready',
      criteria: 'points > 7000 AND vouchers_earned = 0',
      platforms: ['facebook', 'instagram']
    }
  ],
  
  // Identity resolution
  identifiers: ['email_hash', 'device_id', 'phone_hash'],
  
  // Privacy compliance
  consent: {
    gdpr: true,
    lgpd: true, // Brazil's data law
    ccpa: true
  }
};
```

### Platform Audiences

```
LiveRamp → Facebook Custom Audiences
         → Google Customer Match
         → TikTok Custom Audiences
         → Twitter Tailored Audiences
         → Programmatic (DV360)
```

---

## Pipeline Guidance (Regulatory-Safe)

### Fala Mestre! Pipeline (Game Only)

```
Casual Fan → Regular Fan → Power User
    ↓              ↓            ↓
Fun only    Community    "Special rewards"
                              ↓
                    Socios.com email bridge
```

### Socios.com Pipeline (Crypto Side)

```
Email recipient → Landing page → Wallet connect → Token conversion
    (FalaMestre! user)    (Socios.com)      (Socios.com)      (Socios.com)
```

### The Handoff (Critical)

1. **Fala Mestre! identifies Power User** (behavior only)
2. **Fala Mestre! triggers Socios.com email** via API
3. **Socios.com sends email** (they control crypto messaging)
4. User clicks → Socios.com landing page
5. **Socios.com handles:** Wallet connection, token education, conversion

**Fala Mestre! never mentions crypto.** Only "special rewards."

### Target Conversion Rate (25-30%)

**Realistic breakdown:**
```
Total users: 1000
Power Users: 100 (10%)
Email sent: 100 (100% of Power Users)
Email open: 40 (40% open rate)
Landing page: 30 (75% of openers)
Wallet connect: 15 (50% of landing page)
Token purchase: 8 (50% of wallet connect)
```

**Your 25-30% target:**
- **25-30% of Power Users** (not total users)
- **~2.5-3% of total users** (more realistic)
- **This is excellent** for crypto user acquisition

**Optimization levers:**
- Improve email open rate (Socios.com subject lines)
- Improve landing page conversion (Socios.com UX)
- Increase Power User % (better game engagement)

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

## Partnership Success Metrics & SLAs

### Minimum Viable Performance (Month 3)

| Metric | Threshold | Measurement | Action if Below |
|--------|-----------|-------------|-----------------|
| Power User identification rate | >8% | Real-time tracking | Review clustering algorithm |
| Email open rate | >35% | Socios.com analytics | A/B test subject lines |
| Landing page conversion | >60% | Socios.com analytics | UX optimization |
| Token purchase rate | >5% | Socios.com attribution | Review targeting criteria |
| D7 Retention | >35% | Game analytics | Gameplay optimization |
| API uptime | >99.5% | Monitoring | Technical review |

### Service Level Agreements (SLAs)

| Service Level | Target | Measurement | Penalty |
|---------------|--------|-------------|---------|
| **API Availability** | 99.9% | Uptime monitoring | Service credits |
| **API Response Time** | <500ms (p95) | Performance monitoring | Investigation |
| **Email Delivery** | >95% | Delivery tracking | Root cause analysis |
| **Data Accuracy** | 100% | Validation checks | Immediate fix |
| **Support Response** | <4 hours (business) | Ticket system | Escalation |
| **Bug Resolution** | <24 hours (critical) | Issue tracking | Priority handling |

### Reporting Cadence

| Report | Frequency | Audience | Contents | Delivery |
|--------|-----------|----------|----------|----------|
| **Real-time Dashboard** | Continuous | Head of Acquisition | Live conversion funnel | Web access |
| **Daily Summary** | 9 AM local | Marketing team | Previous day metrics | Email |
| **Weekly Report** | Monday | Leadership | Week-over-week trends | Email + meeting |
| **Monthly Review** | 1st of month | Executive team | ROI analysis, recommendations | Presentation |
| **Quarterly Business Review** | Quarterly | Both leadership teams | Strategic assessment | In-person |

### Optimization Process

**Weekly:**
- A/B test email subject lines (Socios.com marketing)
- Review email open rates and CTR
- Landing page conversion analysis

**Bi-weekly:**
- Review cluster definitions (FalaMestre!)
- Power User threshold optimization
- Game engagement metrics

**Monthly:**
- Landing page optimization (Socios.com design)
- Conversion funnel deep dive
- User feedback analysis
- ROI calculation and reporting

**Quarterly:**
- Strategic review and goal adjustment
- Market expansion planning
- Feature roadmap alignment
- Partnership health check

### Success Criteria

#### Month 1-2: Pilot Phase
- **Goal:** Validate technical integration
- **Success:** 1,000 users, API functioning, emails delivering
- **Decision:** Continue to Phase 2

#### Month 3-4: Validation Phase
- **Goal:** Prove conversion model
- **Success:** >5% token purchase rate, >35% email open rate
- **Decision:** Scale to 10,000 users

#### Month 5-6: Scale Phase
- **Goal:** Optimize and expand
- **Success:** >25% Power User conversion, positive ROI
- **Decision:** Full market rollout

#### Month 7-12: Growth Phase
- **Goal:** Maximize market penetration
- **Success:** 100,000+ users, 3,660% cumulative ROI
- **Decision:** Expand to additional markets

### Exit Criteria

| Scenario | Notice Period | Data Handoff | Transition Support |
|----------|---------------|--------------|-------------------|
| Performance below threshold (3 consecutive months) | 30 days | Full export (CSV, JSON) | 30 days technical support |
| Strategic pivot by either party | 60 days | 90-day transition period | 60 days consulting |
| Acquisition of FalaMestre! | Per agreement | Integration support | Per acquisition terms |
| Regulatory shutdown | Immediate | Immediate export (7 days) | Emergency transition |
| Mutual agreement | 30 days | Standard export | 30 days support |

### Performance Guarantees

**FalaMestre! Guarantees:**
- Minimum 8% Power User identification rate by Month 3
- 99.9% API uptime
- <500ms API response time (p95)
- 100% data accuracy

**Socios.com Commitments:**
- Email delivery within 24 hours of trigger
- Landing page optimization based on data
- Monthly performance reviews
- Quarterly strategic planning

**Shared Responsibilities:**
- Weekly optimization meetings
- Monthly ROI reporting
- Quarterly business reviews
- Joint crisis management

---

## Implementation Plan

### Phase 1: MVP with Behavioral Clustering (Week 1-2)
- ✅ Track: matches, points, accuracy, session frequency
- ✅ Cluster: casual/regular/power (behavior only)
- ✅ Real-time: cluster updates
- ✅ Trigger: Power User → Socios.com API call
- ❌ No crypto messaging in game

### Phase 2: Socios.com Integration (Week 3-4)
- ✅ API webhook for Power User notification
- ✅ Socios.com email template (they create)
- ✅ Landing page (Socios.com)
- ✅ Real-time dashboard for Chilliz

### Phase 3: Optimization (Week 5-6)
- ✅ A/B test email subject lines (Socios.com)
- ✅ Optimize Power User threshold
- ✅ Track conversion funnel (Socios.com provides data)
- ✅ Refine cluster definitions based on conversion data

### Real-Time Dashboard (Built by FalaMestre!)

**Dashboard Features:**
- Power Users: Real-time count
- Email triggers: Real-time (sent/pending/processed)
- Conversion funnel: Real-time (via Socios.com webhooks)
- Conversion rates: Email open, landing page, wallet connect, token purchase
- Overall conversion: Power User → Token purchase

**Update frequency:** Real-time
**Data sources:** FalaMestre! database + Socios.com webhooks
**Access:** Provided to Chilliz Head of Acquisition

**Dashboard metrics:**
```
POWER USERS
- Current: 100 (10% of total users)
- New today: 15
- Threshold: 10%

EMAIL TRIGGERS
- Sent: 100
- Pending: 0
- Processed: 100

CONVERSION FUNNEL
- Power Users: 100
- Emails sent: 100
- Emails opened: 40 (40%)
- Landing page views: 30 (75%)
- Wallet connections: 15 (50%)
- Token purchases: 8 (50%)

CONVERSION RATES
- Email open: 40%
- Landing page: 75%
- Wallet connect: 50%
- Token purchase: 50%
- Overall: 8% (Power User → Token)
```

---

## Regulatory Compliance

### Brazilian Crypto Regulations

**The Challenge:**
- Crypto ads heavily restricted in Brazil
- Traditional user acquisition costs $50-200 per user
- Compliance risk for platforms

**Our Solution:**
- **Fala Mestre! stays in "grey zone"** (game only)
- **Socios.com handles all crypto compliance** (they have licenses)
- **No crypto messaging in game** (only "special rewards")
- **Email/remarketing from Socios.com** (compliant messaging)

### Data Handling

| Data Type | Retention | Encryption | Access |
|-----------|-----------|------------|--------|
| Game events | 2 years | At rest | Analytics team |
| Behavioral data | 1 year | At rest + transit | Marketing team |
| Personal info | Account lifetime | At rest + transit | Auth only |
| Cluster data | 1 year | At rest | Marketing team |
| Crypto-related | N/A (not tracked) | N/A | N/A |

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

### LGPD Compliance (Brazil)

- **Data collection**: Only game behaviors (compliant)
- **Consent**: Opt-in for marketing, opt-out for analytics
- **Data deletion**: Within 30 days of request
- **Transparency**: Privacy policy clearly explains data use
- **No crypto data**: We don't collect crypto-related data

---

## Related Documents

- [[00-Monetization]] - Revenue optimization
- [[04-AI-LLM-Strategy]] - AI clustering implementation
- [[03-Go-To-Market]] - Audience targeting
- [[01-Success-Metrics]] - KPI tracking

---

*"Data tells you what. Conversations tell you why."*
