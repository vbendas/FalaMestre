# Phase 4: Expansion

---
tags: #roadmap #expansion #phase-4 #pvp #growth
status: complete
priority: medium
phase: planning
last_updated: 2026-01-18
timeline: Months 4-6
budget: TBD
---

## Overview

Phase 4 expands competitive features, deepens social systems, and optimizes for scale.

> [!note] Phase 4 Focus
> Build the competitive ecosystem that keeps users engaged long-term.

---

## Goals

1. **Real-time PvP**: Live competitive matches
2. **Ranked system**: Seasonal competitive ladder
3. **Social depth**: Guilds/clubs, live events
4. **User scale**: 50,000+ active users

---

## Month 4: Real-Time PvP

### Week 13-14: Infrastructure

```
Tasks:
[ ] WebSocket infrastructure
[ ] Real-time game sync
[ ] Matchmaking service
[ ] Anti-cheat basics
[ ] Connection handling

Deliverable: Real-time infrastructure ready
```

### Week 15-16: Live Matches

```
Tasks:
[ ] Real-time match UI
[ ] In-match decisions
[ ] Live chat during match
[ ] Spectator mode (basic)
[ ] Match reconnection

Deliverable: Live PvP matches playable
```

---

## Month 5: Ranked & Seasons

### Week 17-18: Ranking System

```
Tasks:
[ ] ELO rating system
[ ] Rank tiers (Bronze to Diamond)
[ ] Placement matches
[ ] Rank decay
[ ] Rank rewards

Deliverable: Ranked ladder functional
```

### Week 19-20: Seasonal System

```
Tasks:
[ ] Season calendar
[ ] Season rewards
[ ] Season reset logic
[ ] Historical stats
[ ] Season leaderboards

Deliverable: First ranked season launches
```

---

## Month 6: Social & Events

### Week 21-22: Guilds/Clubs

```
Tasks:
[ ] Club creation
[ ] Club membership
[ ] Club chat
[ ] Club competitions
[ ] Club rankings

Deliverable: Players can join clubs
```

### Week 23-24: Live Events

```
Tasks:
[ ] Event system framework
[ ] Special tournaments
[ ] Time-limited modes
[ ] Event rewards
[ ] Event calendar

Deliverable: Live events running
```

---

## Features Included

### Must Have (P0)

- [ ] Real-time PvP matches
- [ ] Ranked ladder
- [ ] Seasonal resets
- [ ] Matchmaking
- [ ] Rank rewards

### Should Have (P1)

- [ ] Guild/club system
- [ ] Live events
- [ ] Spectator mode
- [ ] Advanced formations
- [ ] Tournament brackets

### Nice to Have (P2)

- [ ] Voice chat
- [ ] Streaming integration
- [ ] Manager customization
- [ ] Stadium builder

---

## Technical Requirements

### Real-Time Infrastructure

```typescript
const rtInfrastructure = {
  webSocket: "Supabase Realtime or Pusher",
  matchmaking: {
    algorithm: "ELO-based",
    maxWaitTime: "60 seconds",
    teamStrengthBand: "±5 rating"
  },
  antiCheat: {
    serverAuthority: true,
    rateLimit: "10 actions/second",
    replayValidation: true
  }
};
```

### Scaling Considerations

| Component | Phase 3 | Phase 4 |
|-----------|---------|---------|
| Concurrent users | 500 | 5,000 |
| Matches/minute | 50 | 500 |
| WebSocket connections | N/A | 10,000 |
| Database queries/sec | 100 | 1,000 |

---

## Success Metrics

| Metric | Target | Critical |
|--------|--------|----------|
| Active users | 50,000+ | Yes |
| PvP engagement | >30% of users | Yes |
| Ranked participation | >50% of PvP | No |
| Guild membership | >20% | No |
| Retention D30 | >25% | Yes |

---

## Team Expansion

| Role | Start | Monthly Cost |
|------|-------|--------------|
| Part-time developer | Month 4 | $2,000 |
| Community manager | Month 5 | $1,500 |
| Content creator | Month 6 | $1,000 |

---

## Budget (Estimate)

| Item | Monthly Cost |
|------|--------------|
| Development | $6,000 |
| Infrastructure scaling | $1,000 |
| Team (part-time) | $3,500 |
| Marketing | $5,000 |
| **Total** | **$15,500/month** |

---

## Exit Criteria

Phase 4 is complete when:

1. [ ] Real-time PvP live
2. [ ] Ranked seasons running
3. [ ] 50,000+ active users
4. [ ] Guild system functional
5. [ ] First live event completed
6. [ ] Anti-cheat effective

---

## Related Documents

- [[03-Phase-3-Scale]] - Previous phase
- [[05-Phase-5-Global]] - Next phase
- [[04-Expansion-Tasks]] - Detailed tasks
- [[11-PvP-Multiplayer]] - PvP design

---

*"Competition drives excellence."*
