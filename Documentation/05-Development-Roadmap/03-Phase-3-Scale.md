# Phase 3: Scale

---
tags: #roadmap #scale #phase-3 #monetization #launch
status: complete
priority: high
phase: planning
last_updated: 2026-01-18
timeline: Weeks 9-12
budget: $5,000
---

## Overview

Phase 3 focuses on monetization, social features, and public launch. This phase transforms the product from beta into a sustainable business.

> [!important] Phase 3 Focus
> Make money, grow users, build virality.

---

## Goals

1. **Revenue generation**: Premium subscriptions and ads
2. **Social features**: Friends, sharing, viral mechanics
3. **Token integration**: Voucher redemption live
4. **Public launch**: 10,000+ users

---

## Week 9: Monetization

### Day 57-59: Premium Subscription

```
Tasks:
[ ] Subscription tiers design
[ ] Stripe integration
[ ] PIX payment support
[ ] Premium feature flags
[ ] Subscription management UI
[ ] Receipt/invoice system

Deliverable: Premium subscriptions purchasable
```

### Day 60-63: Ad Integration

```
Tasks:
[ ] Rewarded video integration
[ ] Ad placement strategy
[ ] Ad-free for premium
[ ] Daily ad limits
[ ] Ad analytics

Deliverable: Ads generating revenue
```

---

## Week 10: Social Features

### Day 64-66: Friend System

```
Tasks:
[ ] Friend requests
[ ] Friend list
[ ] Friend search
[ ] Friend activity feed
[ ] Import from contacts (optional)

Deliverable: Users can add friends
```

### Day 67-70: PvP Matches (Async)

```
Tasks:
[ ] Matchmaking system
[ ] Async match simulation
[ ] PvP result notification
[ ] Ranking impact
[ ] Rematch functionality

Deliverable: Users can challenge friends
```

---

## Week 11: Virality & Tokens

### Day 71-73: Sharing Features

```
Tasks:
[ ] Match result share cards
[ ] Achievement share cards
[ ] Referral code system
[ ] Social deep links
[ ] WhatsApp/Instagram optimization

Deliverable: Viral sharing mechanics live
```

### Day 74-77: Voucher Redemption

```
Tasks:
[ ] Socios.com OAuth integration
[ ] Voucher claim flow
[ ] Token selection UI
[ ] Redemption confirmation
[ ] Balance sync

Deliverable: Real fan tokens can be claimed
```

---

## Week 12: Launch

### Day 78-80: Final Polish

```
Tasks:
[ ] Performance audit
[ ] Security audit
[ ] Bug bash
[ ] Onboarding optimization
[ ] A/B test setup

Deliverable: Production-ready quality
```

### Day 81-84: Public Launch

```
Tasks:
[ ] Marketing campaign launch
[ ] Influencer coordination
[ ] PR outreach
[ ] App store optimization
[ ] Launch monitoring

Deliverable: Public launch complete
```

---

## Features Included

### Must Have (P0)

- [ ] Premium subscription (Stripe)
- [ ] PIX payments
- [ ] Rewarded video ads
- [ ] Friend system
- [ ] Voucher redemption
- [ ] Share cards
- [ ] Referral program
- [ ] Public launch

### Should Have (P1)

- [ ] Async PvP
- [ ] Friend leaderboards
- [ ] Achievement sharing
- [ ] Interstitial ads

### Nice to Have (P2)

- [ ] Live tournaments
- [ ] Spectator mode
- [ ] Replay sharing

---

## Technical Additions

### New Integrations

| Service | Purpose |
|---------|---------|
| Stripe | Payment processing |
| PIX (via Stripe) | Brazilian instant payments |
| AdMob/IronSource | Ad mediation |
| Socios.com API | Token redemption |
| Branch.io | Deep linking |

### New API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/payments/subscribe` | POST | Start subscription |
| `/api/payments/cancel` | POST | Cancel subscription |
| `/api/friends/add` | POST | Send friend request |
| `/api/friends/list` | GET | Get friends |
| `/api/pvp/challenge` | POST | Challenge friend |
| `/api/rewards/redeem` | POST | Redeem voucher |
| `/api/share/card` | GET | Generate share card |

---

## Monetization Model

### Revenue Streams Active

| Stream | Target Month 12 |
|--------|-----------------|
| Subscriptions | $10,000/month |
| Token attribution | $7,000/month |
| Advertising | $4,000/month |
| One-time purchases | $2,000/month |
| **Total** | **$23,000/month** |

### Pricing

| Product | Price (USD) | Price (BRL) |
|---------|-------------|-------------|
| Monthly subscription | $4.99 | R$24,90 |
| Annual subscription | $39.99 | R$199,90 |
| Starter pack | $2.99 | R$14,90 |
| Points bundle (S) | $0.99 | R$4,90 |

---

## Success Metrics

| Metric | Target | Critical |
|--------|--------|----------|
| Public users | 10,000+ | Yes |
| Premium conversion | >5% | Yes |
| D30 retention | >20% | Yes |
| Viral coefficient | >0.8 | Yes |
| Revenue | >$5,000 | Yes |
| Voucher redemptions | 100+ | Yes |

---

## Budget Breakdown

| Item | Cost |
|------|------|
| Development (4 weeks) | $3,000 |
| Payment integration fees | $500 |
| Marketing (launch) | $1,000 |
| Infrastructure scaling | $300 |
| Legal/compliance review | $200 |
| **Total** | **$5,000** |

---

## Exit Criteria

Phase 3 is complete when:

1. [ ] Subscriptions generating revenue
2. [ ] Ads live and earning
3. [ ] Voucher redemption working
4. [ ] 10,000+ public users
5. [ ] Viral coefficient >0.8
6. [ ] Friend system functional
7. [ ] PvP matches playable

---

## Related Documents

- [[02-Phase-2-Enhancement]] - Previous phase
- [[04-Phase-4-Expansion]] - Next phase
- [[03-Scale-Tasks]] - Detailed tasks
- [[00-Monetization]] - Revenue model
- [[01-Fan-Token-Integration]] - Token system

---

*"Revenue is oxygen. Without it, the dream dies."*
