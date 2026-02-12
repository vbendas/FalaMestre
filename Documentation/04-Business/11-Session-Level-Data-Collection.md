# Session-Level Data Collection

---
tags: #technical #analytics #gdpr #behavioral #data-collection
status: complete
priority: critical
phase: mvp
last_updated: 2026-01-20
---

## Overview

FalaMestre! implements session-level data collection to understand user behavior at a meaningful granularity while respecting privacy and GDPR. Unlike per-action tracking that can be invasive, session-level aggregation provides insights without excessive detail.

> [!important] Core Principle
> **Collect aggregated session metrics, not every individual action. Balance between behavioral insights and user privacy.**

---

## What We Track vs What We Don't

| Category | We Track (Session-Level) | We Don't Track |
|-----------|-------------------------|----------------|
| Screens Viewed | Screens visited + time spent | Specific button clicks |
| Decisions Made | Tactical choices per session | Every UI interaction |
| Matches Played | Count, results, duration | Every pass/click |
| Transfer Attempts | Count, outcomes | Every search query |
| Messages Sent | Total per session | Full message content (only for clustering) |
| Crypto Mentions | Count per session | Exact wording for every mention |
| Social Sharing | Count, platforms | Every share action |
| Engagement | Session duration, repeat visits | Location history, IP tracking |

---

## Session Data Model

```typescript
interface SessionData {
  // Session Identity
  id: string;  // UUID
  userId: string;
  sessionStart: Date;
  sessionEnd: Date;
  duration: number;  // minutes
  
  // Device Context
  deviceType: 'mobile' | 'tablet' | 'desktop';
  browser: string;
  os: string;
  screenSize: string;  // resolution
  
  // Location (Coarse, privacy-preserving)
  region: string;  // State only (e.g., "SP", "RJ", "MG")
  city: string;  // City level only for targeting, not for sharing
  
  // Aggregated Actions (Not Per-Action)
  matchesPlayed: number;
  transfersAttempted: number;
  trainingSessions: number;
  
  // Decision Patterns (Session-Level)
  decisions: SessionDecisions;
  screenshotsViewed: string[];
  timeOnScreens: Record<string, number>;  // screen: seconds spent
  
  // Conversational Patterns (Session-Level)
  messagesSent: number;
  cryptoMentions: number;
  tokenQuestions: number;
  conversationTopics: string[];  // Themes discussed (not full content)
  
  // Engagement Metrics (Session-Level)
  totalActions: number;  // Sum of all above
  avgActionFrequency: number;  // actions per minute
  engagementScore: number;  // 0-100 calculated score
  
  // Monetization Signals (Session-Level)
  viewedPremiumOffers: boolean;
  viewedPurchaseOptions: boolean;
  purchaseAttempts: number;
  spendingBehavior: 'none' | 'conservative' | 'moderate' | 'aggressive';
}

interface SessionDecisions {
  tacticalStyle: 'aggressive' | 'balanced' | 'defensive';
  riskLevel: 'high' | 'medium' | 'low';
  teamComposition: 'youth_focused' | 'balanced' | 'star_heavy';
  preferredFormation: string;  // 4-3-3, 4-4-2, 3-5-2, etc.
  decisionSpeed: 'impulsive' | 'analytical' | 'balanced';
}

interface SessionEngagementScore {
  actions: number;
  timeSpent: number;
  depth: number;  // Deep engagement with complex decisions
  social: boolean;  // Shared or challenged friends
  consistency: number;  // Regular sessions over time
  passion: number;  // Long sessions, intense play
}
```

---

## Session Start/End Tracking

```typescript
// Auto-start session when user opens app
export async function startSession(userId: string): Promise<SessionData> {
  const sessionId = crypto.randomUUID();
  
  const sessionData = {
    id: sessionId,
    userId,
    sessionStart: new Date(),
    sessionEnd: null,
    duration: 0,
    deviceType: detectDeviceType(),
    browser: detectBrowser(),
    os: detectOS(),
    screenSize: detectScreenSize(),
    region: await detectRegionCoarse(),
    matchesPlayed: 0,
    transfersAttempted: 0,
    trainingSessions: 0,
    decisions: {
      tacticalStyle: 'balanced',  // Default
      riskLevel: 'medium',
      teamComposition: 'balanced',
      preferredFormation: '4-3-3',
      decisionSpeed: 'balanced'
    },
    screenshotsViewed: [],
    timeOnScreens: {},
    messagesSent: 0,
    cryptoMentions: 0,
    tokenQuestions: 0,
    conversationTopics: [],
    totalActions: 0,
    avgActionFrequency: 0,
    engagementScore: 50,  // Default neutral
    viewedPremiumOffers: false,
    viewedPurchaseOptions: false,
    purchaseAttempts: 0,
    spendingBehavior: 'moderate'
  };
  
  await createSessionInDatabase(sessionData);
  
  // Send session start event to Mixpanel
  mixpanel.track('Session Started', {
    sessionId,
    deviceType: sessionData.deviceType,
    region: sessionData.region
  });
  
  return sessionData;
}

// Auto-end session when user closes app or is inactive
export async function endSession(sessionId: string): Promise<void> {
  const sessionData = await getSessionFromDatabase(sessionId);
  
  sessionData.sessionEnd = new Date();
  sessionData.duration = calculateDuration(sessionData.sessionStart, sessionData.sessionEnd);
  sessionData.avgActionFrequency = sessionData.totalActions / (sessionData.duration || 1);
  sessionData.engagementScore = calculateEngagementScore(sessionData);
  
  await updateSessionInDatabase(sessionData);
  
  // Send session end event to Mixpanel
  mixpanel.track('Session Ended', {
    sessionId,
    duration: sessionData.duration,
    totalActions: sessionData.totalActions,
    engagementScore: sessionData.engagementScore
  });
}
```

---

## Action Tracking (Session-Level)

```typescript
// Track when user plays a match (not every pass)
export async function trackMatchPlayed(sessionId: string, result: MatchResult): Promise<void> {
  await incrementSessionCounter(sessionId, 'matchesPlayed');
  await updateSessionDecisions(sessionId, {
    result: result.score > result.opponentScore ? 'win' : 'loss',
    tacticalStyle: inferTacticalStyle(result)
  });
  
  mixpanel.track('Match Played', {
    result: result.score > result.opponentScore ? 'win' : 'loss',
    opponent: result.opponent
  });
}

// Track transfer attempt (not every search)
export async function trackTransferAttempt(
  sessionId: string,
  player: string,
  offerAmount: number,
  wasSuccessful: boolean
): Promise<void> {
  await incrementSessionCounter(sessionId, 'transfersAttempted');
  
  // Only track spending behavior if purchase made
  if (wasSuccessful) {
    await updateSpendingBehavior(sessionId, offerAmount);
  }
  
  mixpanel.track('Transfer Attempted', {
    player,
    offerAmount,
    wasSuccessful
  });
}

// Track training session (once per training)
export async function trackTrainingSession(
  sessionId: string,
  focus: string,
  players: string[]
): Promise<void> {
  await incrementSessionCounter(sessionId, 'trainingSessions');
  
  mixpanel.track('Training Completed', {
    focus,
    playerCount: players.length
  });
}
```

---

## Decision Pattern Detection

```typescript
// Infer tactical style from session actions
export function inferTacticalStyle(sessionData: SessionData): 'aggressive' | 'balanced' | 'defensive' {
  const { decisions } = sessionData;
  
  // Check formation preference
  if (decisions.preferredFormation === '4-3-3' || decisions.preferredFormation === '3-5-2') {
    return 'attacking';  // Aggressive formations
  } else if (decisions.preferredFormation === '5-3-2' || decisions.preferredFormation === '5-4-1') {
    return 'defensive';  // Defensive formations
  }
  
  // Check team composition
  if (decisions.teamComposition === 'star_heavy') {
    return 'aggressive';  // Big names, all-star
  } else if (decisions.teamComposition === 'youth_focused') {
    return 'balanced';  // Long-term thinking
  }
  
  return 'balanced';  // Default
}

// Infer risk level from spending behavior
export function inferRiskLevel(spendingBehavior: string): 'high' | 'medium' | 'low' {
  if (spendingBehavior === 'aggressive') {
    return 'high';  // Willing to spend freely
  } else if (spendingBehavior === 'moderate') {
    return 'medium';  // Considered spending
  } else {
    return 'low';  // Conservative, price-sensitive
  }
}

// Infer decision speed from timing
export function inferDecisionSpeed(decisions: SessionDecisions): 'impulsive' | 'analytical' | 'balanced' {
  // This would need to track timing between decisions
  // For MVP: Default to 'balanced' as simplified
  return 'balanced';
}
```

---

## Crypto Interest Detection (Session-Level)

```typescript
// Count crypto mentions (not full content)
export async function trackCryptoMention(sessionId: string): Promise<void> {
  await incrementSessionCounter(sessionId, 'cryptoMentions');
  await incrementSessionCounter(sessionId, 'tokenQuestions');
  
  // If multiple mentions in short time = high interest
  const cryptoMentions = await getSessionCounter(sessionId, 'cryptoMentions');
  if (cryptoMentions >= 3) {
    await markHighCryptoInterest(userId);
  }
}

// Track token-related questions
export async function trackTokenQuestion(sessionId: string, topic: string): Promise<void> {
  const session = await getSessionFromDatabase(sessionId);
  
  // Extract topic keywords
  const cryptoKeywords = ['token', 'wallet', 'blockchain', 'nft', 'crypto'];
  const hasCryptoKeyword = cryptoKeywords.some(kw => topic.toLowerCase().includes(kw));
  
  if (hasCryptoKeyword) {
    await incrementSessionCounter(sessionId, 'tokenQuestions');
    session.conversationTopics.push(topic);
  } else {
    session.conversationTopics.push('general');
  }
  
  await updateSessionInDatabase(session);
}
```

---

## Engagement Score Calculation

```typescript
export function calculateEngagementScore(sessionData: SessionData): number {
  const { duration, totalActions, messagesSent } = sessionData;
  
  // Base score from time spent (0-50 points)
  const timeScore = Math.min(duration * 2, 50);
  
  // Bonus for action frequency (0-30 points)
  const actionScore = Math.min(totalActions * 0.3, 30);
  
  // Bonus for engagement depth (0-20 points)
  const depthScore = sessionData.engagementScore ? Math.min(sessionData.engagementScore * 0.2, 20) : 0;
  
  // Normalize to 0-100
  const totalScore = timeScore + actionScore + depthScore;
  return Math.min(totalScore, 100);
}

// Example calculations
// 15-minute session with 20 actions
// timeScore: 15 * 2 = 30
// actionScore: 20 * 0.3 = 6
// depthScore: 10 (medium engagement)
// Total: 46/100

// 5-minute session with 5 actions
// timeScore: 5 * 2 = 10
// actionScore: 5 * 0.3 = 1.5
// depthScore: 0 (no deep engagement)
// Total: 11.5/100
```

---

## Data Aggregation for Behavioral Clustering

```typescript
// Weekly aggregation for GML-4.7 behavioral clustering
export async function aggregateUserForClustering(userId: string): Promise<ClusteringInput> {
  // Fetch last 14 days of session data (not per-action)
  const sessions = await fetchUserSessions(userId, 14);
  
  const aggregation = {
    userId,
    period_days: 14,
    
    // Session patterns
    session_count: sessions.length,
    avg_session_duration: average(sessions.map(s => s.duration)),
    avg_session_frequency: 7 / sessions.length,  // sessions per week
    
    // Gaming behavior (session-level)
    avg_matches_per_session: average(sessions.map(s => s.matchesPlayed)),
    avg_transfers_per_session: average(sessions.map(s => s.transfersAttempted)),
    avg_training_per_session: average(sessions.map(s => s.trainingSessions)),
    
    // Decision patterns (session-level)
    dominant_tactical_style: getDominantValue(sessions.map(s => s.decisions.tacticalStyle)),
    dominant_risk_level: getDominantValue(sessions.map(s => s.decisions.riskLevel)),
    dominant_team_composition: getDominantValue(sessions.map(s => s.decisions.teamComposition)),
    
    // Conversational patterns (session-level)
    avg_messages_per_session: average(sessions.map(s => s.messagesSent)),
    crypto_mention_rate: average(sessions.map(s => s.cryptoMentions)),
    token_question_rate: average(sessions.map(s => s.tokenQuestions)),
    
    // Engagement (session-level)
    avg_engagement_score: average(sessions.map(s => s.engagementScore)),
    high_engagement_days: sessions.filter(s => s.engagementScore > 70).length,
    consistency_score: calculateSessionConsistency(sessions),
    
    // Spending behavior (session-level)
    spending_distribution: sessions.map(s => s.spendingBehavior),
    premium_view_rate: sessions.filter(s => s.viewedPremiumOffers).length / sessions.length
  };
  
  return aggregation;
}

function calculateSessionConsistency(sessions: SessionData[]): number {
  // How regularly does user play?
  if (sessions.length < 7) return 0;  // Too early to tell
  
  const last7Days = sessions.slice(-7);
  const uniqueDays = new Set(last7Days.map(s => s.sessionStart.toISOString().split('T')[0]));
  
  // Consistency: (days played / 7) * 100
  return (uniqueDays.size / 7) * 100;
}
```

---

## Database Table Schema

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Session Identity
  session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_end TIMESTAMPTZ,
  duration INTEGER,  -- minutes
  
  -- Device Context
  device_type TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  browser TEXT,
  os TEXT,
  screen_size TEXT,
  
  -- Location (Coarse, privacy-preserving)
  region TEXT,  -- State level (e.g., "SP", "RJ", "MG")
  city TEXT,  -- City for targeting, not for sharing
  
  -- Aggregated Actions (Not Per-Action)
  matches_played INTEGER DEFAULT 0,
  transfers_attempted INTEGER DEFAULT 0,
  training_sessions INTEGER DEFAULT 0,
  total_actions INTEGER DEFAULT 0,
  avg_action_frequency NUMERIC,  -- actions per minute
  
  -- Decision Patterns (Session-Level, JSON)
  decisions JSONB DEFAULT '{
    "tactical_style": "balanced",
    "risk_level": "medium",
    "team_composition": "balanced",
    "preferred_formation": "4-3-3",
    "decision_speed": "balanced"
  }',
  
  -- Screen Time (Aggregated, not per-action)
  screens_viewed TEXT[] DEFAULT '{}',
  time_on_screens JSONB DEFAULT '{}',
  
  -- Conversational Patterns (Session-Level)
  messages_sent INTEGER DEFAULT 0,
  crypto_mentions INTEGER DEFAULT 0,
  token_questions INTEGER DEFAULT 0,
  conversation_topics TEXT[] DEFAULT '{}',
  
  -- Engagement Score (0-100)
  engagement_score INTEGER DEFAULT 50,
  
  -- Monetization Signals
  viewed_premium_offers BOOLEAN DEFAULT FALSE,
  viewed_purchase_options BOOLEAN DEFAULT FALSE,
  purchase_attempts INTEGER DEFAULT 0,
  spending_behavior TEXT DEFAULT 'moderate'
);

-- Indexes
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_start ON sessions(session_start DESC);
CREATE INDEX idx_sessions_user_duration ON sessions(user_id, duration);
```

---

## Privacy Guarantees

### Data Minimization

- **Collected:** Session-level aggregates (counts, averages, patterns)
- **Not Collected:** Full message content, every button click, detailed timestamps
- **Reason:** Patterns reveal intent; raw data reveals specifics

### Location Privacy

- **Stored:** State + City (coarse)
- **Not Stored:** IP address, precise GPS coordinates, street address
- **Purpose:** Regional targeting for marketing (not tracking)
- **Sharing:** City never shared with affiliates (only state)

### User Control

- **Transparency:** Users can see what's collected in Settings
- **Access:** Full data export under GDPR
- **Correction:** Request modification of inaccurate data
- **Deletion:** Complete account and data deletion

---

## Related Documents

- [[09-GDPR-Compliance]] - Consent management for session tracking
- [[10-Three-Tier-LLM-Strategy]] - How data is used for clustering
- [[10-Hot-Lead-Definition]] - How session data determines hot lead status
- [[02-Database-Schema]] - Full database with sessions table

---

*"Session-level data respects privacy while revealing behavioral patterns."*
