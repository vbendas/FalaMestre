# Points & Rewards Economy

---
tags: #game-design #economy #points #rewards #mvp
status: complete
priority: critical
phase: planning
last_updated: 2026-01-18
---

## Overview

The points economy rewards good management. Players earn points through gameplay and spend them on training, scouting, fan engagement and cosmetic items. Points exist only inside the game; Fala Mestre! is a standalone game with no crypto or ad-platform integrations.

> [!important] Core Balance
> Meaningful unlocks should arrive every few sessions for casual players, without being too easy for active players.

---

## Points System

### Earning Points

#### Daily Activities

| Activity | Points | Frequency | Notes |
|----------|--------|-----------|-------|
| Daily Login | 10 | Once/day | Base reward |
| 3-Day Streak | 30 | Every 3 days | Bonus |
| 7-Day Streak | 100 | Weekly | Major bonus |
| 30-Day Streak | 1,000 | Monthly | Huge bonus |

#### Match Results

| Result | Base Points | Notes |
|--------|-------------|-------|
| Win (Easy) | 50 | Weaker opponent |
| Win (Normal) | 75 | Equal opponent |
| Win (Hard) | 100 | Stronger opponent |
| Win (Very Hard) | 150 | Much stronger |
| Draw | 25 | Any opponent |
| Loss | 0 | No penalty |

#### Performance Bonuses

| Achievement | Points | Trigger |
|-------------|--------|---------|
| Clean Sheet | 25 | No goals conceded |
| Hat-trick | 50 | Player scores 3+ |
| Comeback Win | 50 | Win after trailing |
| Dominant Win | 40 | Win by 3+ goals |
| Derby Win | 50 | Beat rival team |
| Late Drama | 30 | Win in 85'+ |

#### Streaks

| Streak | Points | Trigger |
|--------|--------|---------|
| 3 Win Streak | 100 | 3 consecutive wins |
| 5 Win Streak | 250 | 5 consecutive wins |
| 10 Win Streak | 1,000 | 10 consecutive wins |
| 10 Unbeaten | 500 | 10 without loss |

#### Season Milestones

| Achievement | Points | Description |
|-------------|--------|-------------|
| Season Complete | 1,000 | Finish the season |
| Top Half Finish | 1,500 | 10th or better |
| Top 4 Finish | 2,500 | Champions League spots |
| Promotion | 3,000 | Move up a division |
| League Title | 5,000 | Win the league |
| Unbeaten Season | 10,000 | No losses all season |

#### Cup Competitions

| Stage | Points |
|-------|--------|
| Quarter-final | 300 |
| Semi-final | 700 |
| Final Appearance | 1,500 |
| Cup Winner | 3,000 |

#### Other Activities

| Activity | Points | Notes |
|----------|--------|-------|
| Youth Graduate Debut | 100 | Academy player plays |
| Player Reaches 80 OVR | 300 | Development success |
| Player Reaches 90 OVR | 500 | Star creation |
| Profit Transfer | Varies | 1 pt per R$100K profit |
| Fan Vote Participation | 20 | Engage with fans |
| Friend Referral (Join) | 500 | Successful invite |

---

## Earning Rates

| Player Type | Points/Hour |
|-------------|-------------|
| Casual | 150-200 |
| Regular | 250-350 |
| Hardcore | 400-500 |

---

## Spending Points

### Training & Development

| Expense | Cost | Effect |
|---------|------|--------|
| Basic Scout Report | 500 | Reveal player basics |
| Advanced Scout | 1,500 | Reveal all attributes |
| Elite Scout | 5,000 | Reveal hidden potential |
| Training Boost | 1,000 | +50% training week |
| Youth Academy Upgrade | 10,000 | Better prospects |

### Fan Engagement

| Expense | Cost | Effect |
|---------|------|--------|
| Campaign for Vote | 300-800 | +10-15% vote influence |
| Appease Faction | 500 | +10 mood one faction |
| Community Event | 1,000 | +5 mood all factions |

### Premium Items

| Item | Cost | Effect |
|------|------|--------|
| Extra Squad Slot | 2,000 | +1 roster spot |
| Manager Costume | 500 | Cosmetic |
| Stadium Theme | 1,500 | Visual customization |
| Name Change | 1,000 | Once per season |

---

## Economy Balance

### Daily Earning Potential

```typescript
const DAILY_POTENTIAL = {
  minimum: {
    login: 10,
    matches: 75,    // 1 match
    total: 85
  },
  casual: {
    login: 10,
    streak: 10,     // Average
    matches: 200,   // 2-3 matches
    bonuses: 30,
    total: 250
  },
  active: {
    login: 10,
    streak: 15,
    matches: 400,   // 4-5 matches
    bonuses: 75,
    achievements: 100,
    total: 600
  },
  hardcore: {
    login: 10,
    streak: 30,
    matches: 600,   // 6-8 matches
    bonuses: 150,
    achievements: 200,
    tournaments: 200,
    total: 1190
  }
};
```

### Weekly Caps

To prevent exploitation and maintain economy health:

| Cap Type | Limit | Reset |
|----------|-------|-------|
| Daily Points | 2,000 | Midnight |
| Daily Matches | 50 | Midnight |
| Weekly Bonus Points | 5,000 | Sunday |

### Monthly Projection

| Player Type | Monthly Points |
|-------------|----------------|
| Casual (5hr/week) | 3,000-4,000 |
| Regular (10hr/week) | 8,000-12,000 |
| Hardcore (20hr/week) | 20,000-30,000 |

---

## Anti-Abuse Mechanisms

### Rate Limiting

```typescript
const ANTI_ABUSE = {
  // Daily limits
  dailyMaxPoints: 2000,
  dailyMaxMatches: 50,
  
  // Cooldowns
  sameOpponentCooldown: 3600,  // 1 hour
  referralCooldown: 86400,     // 24 hours
  
  // Rate limits
  actionsPerMinute: 30,
  pointsPerMinuteMax: 100
};
```

### Fraud Detection

```typescript
const SUSPICIOUS_PATTERNS = [
  'win_rate_over_95_percent',      // Impossible consistency
  'identical_match_results',        // Bot behavior
  'rapid_account_creation',         // Multi-accounting
  'inhuman_reaction_times',         // Script detection
  'same_ip_multiple_accounts'       // IP tracking
];

function checkForAbuse(user: User, action: Action): AbuseCheck {
  if (user.todayPoints >= DAILY_MAX) {
    return { allowed: false, reason: 'daily_cap' };
  }
  
  if (user.winRate > 0.95 && user.matches > 100) {
    return { allowed: true, flagForReview: true };
  }
  
  const recentActions = user.getActionsInWindow(60);
  if (recentActions.length > 30) {
    return { allowed: false, reason: 'rate_limit' };
  }
  
  return { allowed: true };
}
```

### Behavioral Flags

| Flag | Trigger | Action |
|------|---------|--------|
| Suspicious Win Rate | >95% over 100 matches | Manual review |
| Rapid Progression | 10K points in 24h | Verification |
| Multiple Accounts | Same device/IP | Warning, then ban |
| Bot Behavior | Pattern detection | Immediate suspension |

---

## Premium Benefits

### Season Pass ($4.99/month)

| Benefit | Description |
|---------|-------------|
| No Ads | Remove all advertisements |
| Exclusive Formations | 3 premium formations |
| Extra Saves | 3 save slots (vs 1) |
| Premium Badge | Visible profile flair |
| Early Access | New features first |
| Weekly Bonus | 500 bonus points/week |

> [!note] Status
> Premium is a design idea only; it is not implemented in the game.

---

## Economy Metrics

### Health Indicators

| Metric | Healthy Range | Action if Outside |
|--------|---------------|-------------------|
| Avg Daily Earn | 150-400 pts | Adjust rewards |
| Premium Conversion | 8-15% | Adjust benefits |
| Economy Inflation | <5%/month | Cap adjustments |

### Tracking Dashboard

```typescript
interface EconomyMetrics {
  totalPointsIssued: number;
  totalPointsSpent: number;
  premiumConversionRate: number;
  dailyActiveEarners: number;
  topEarnersCapped: number;  // Hit daily limit
}
```

---

## Related Documents

- [[01-Gameplay-Loop]] - Earning in game loop

---

*"Rewards should feel earned, not bought. Progress should feel achievable, not endless."*
