# Phase 2: Enhancement

---
tags: #roadmap #enhancement #phase-2 #development
status: complete
priority: high
phase: planning
last_updated: 2026-01-18
timeline: Weeks 5-8
budget: $5,000
---

## Overview

Phase 2 deepens gameplay with transfer market, training system, and tournaments. This phase transforms MVP into a sticky, engaging product.

> [!note] Phase 2 Focus
> Turn "interesting demo" into "daily habit."

---

## Goals

1. **Deeper gameplay**: More decisions, more strategy
2. **Engagement loops**: Daily reasons to return
3. **Competition**: Tournaments and leaderboards
4. **Soft launch**: 1,000+ public users

---

## Week 5: Transfer Market

### Day 29-31: Player Search & Browse

```
Tasks:
[ ] Player search API
[ ] Filter by position, rating, price
[ ] Player comparison
[ ] Market UI in conversation
[ ] Recommendation system

Deliverable: Users can find players to buy
```

### Day 32-35: Negotiation System

```
Tasks:
[ ] Offer mechanics
[ ] AI negotiation logic
[ ] Counter-offer system
[ ] Club personalities
[ ] Budget management
[ ] Transfer completion

Deliverable: Full transfer flow working
```

---

## Week 6: Training & Development

### Day 36-38: Training System

```
Tasks:
[ ] Training types (technical, physical, tactical)
[ ] Attribute improvement logic
[ ] Training cost/time
[ ] Injury risk from training
[ ] Training UI in chat

Deliverable: Players can be trained
```

### Day 39-42: Youth Academy

```
Tasks:
[ ] Youth player generation
[ ] Potential system
[ ] Graduation to first team
[ ] Development tracking
[ ] Academy investment

Deliverable: Youth system functional
```

---

## Week 7: Competitions

### Day 43-45: Tournaments (PvE)

```
Tasks:
[ ] Tournament creation
[ ] Bracket generation
[ ] Tournament AI opponents
[ ] Prize distribution
[ ] Tournament history

Deliverable: Weekly tournaments running
```

### Day 46-49: Leaderboards

```
Tasks:
[ ] Global leaderboard
[ ] Regional leaderboards
[ ] Friend rankings
[ ] Team-specific rankings
[ ] Achievement tracking

Deliverable: Competitive elements live
```

---

## Week 8: Polish & Soft Launch

### Day 50-52: Advanced Stats

```
Tasks:
[ ] Player career stats
[ ] Team statistics
[ ] Season history
[ ] Form analysis
[ ] Comparison tools

Deliverable: Rich statistics available
```

### Day 53-56: Soft Launch

```
Tasks:
[ ] Performance optimization
[ ] Bug fixes
[ ] Marketing material prep
[ ] Influencer outreach
[ ] Public access (limited)

Deliverable: Soft launch with 1,000+ users
```

---

## Features Included

### Must Have (P0)

- [ ] Transfer market search
- [ ] Transfer negotiations
- [ ] Budget management
- [ ] Weekly tournaments
- [ ] Leaderboards
- [ ] Soft launch

### Should Have (P1)

- [ ] Basic training system
- [ ] Youth academy (basic)
- [ ] Player form system
- [ ] Achievement system

### Nice to Have (P2)

- [ ] Advanced statistics
- [ ] Player comparison
- [ ] Transfer history
- [ ] Scout network

### VR Match Experience (P2)

- [ ] VR mode toggle in match simulation
- [ ] Top-down 3D soccer field (A-Frame)
- [ ] Player sprite billboards in 3D space
- [ ] Match event synchronization
- [ ] Cardboard VR stereoscopic rendering
- [ ] Mobile performance optimization
- [ ] VR instruction overlay

---

## Technical Additions

### New API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/transfers/search` | GET | Search players |
| `/api/transfers/offer` | POST | Make offer |
| `/api/transfers/respond` | POST | Respond to counter |
| `/api/training/start` | POST | Begin training |
| `/api/tournaments` | GET | List tournaments |
| `/api/tournaments/join` | POST | Enter tournament |
| `/api/leaderboards` | GET | Get rankings |

### New Database Tables

| Table | Purpose |
|-------|---------|
| `transfers` | Transfer history and negotiations |
| `training_sessions` | Active training |
| `tournaments` | Tournament definitions |
| `tournament_entries` | User participations |
| `leaderboards` | Cached rankings |
| `achievements` | User achievements |

---

## Success Metrics

| Metric | Target | Critical |
|--------|--------|----------|
| Soft launch users | 1,000+ | Yes |
| D7 retention | >30% | Yes |
| Transfers per user | >2/week | Yes |
| Tournament participation | >40% | No |
| Session length | >15 min | Yes |
| NPS | >30 | Yes |

---

## Budget Breakdown

| Item | Cost |
|------|------|
| Development (4 weeks) | $4,000 |
| Infrastructure scaling | $300 |
| Marketing (soft launch) | $500 |
| Testing | $200 |
| **Total** | **$5,000** |

---

## Exit Criteria

Phase 2 is complete when:

1. [ ] Transfer system fully functional
2. [ ] Tournaments running weekly
3. [ ] Leaderboards live
4. [ ] 1,000+ soft launch users
5. [ ] D7 retention >30%
6. [ ] Training system working
7. [ ] No P0 bugs

---

## Related Documents

- [[01-Phase-1-MVP]] - Previous phase
- [[03-Phase-3-Scale]] - Next phase
- [[02-Enhancement-Tasks]] - Detailed tasks
- [[04-Transfer-Market]] - Transfer design
- [[05-Training-Development]] - Training design

---

*"The second release is where the magic happens."*
