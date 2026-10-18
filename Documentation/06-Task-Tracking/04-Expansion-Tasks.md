# Expansion Tasks (Phase 4-5)

---
tags: #tasks #expansion #phase-4 #phase-5 #pvp #global #tracking
status: active
priority: medium
phase: expansion
last_updated: 2026-01-19
---

## Overview

Detailed task breakdown for Phase 4 (Expansion) and Phase 5 (Global). Total: 121 tasks over 6 months.

> [!note] Phases 4-5 Focus
> Real-time PvP, ranked seasons, guilds, international expansion, and esports.

---

# Phase 4: Expansion (Months 4-6)

## Month 4: Real-Time Infrastructure

### Week 13-14: WebSocket Infrastructure

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| EXP-001 | Research WebSocket solutions (Supabase Realtime vs Pusher) | P0 | 4h | - | [ ] |
| EXP-002 | Set up WebSocket infrastructure | P0 | 6h | EXP-001 | [ ] |
| EXP-003 | Create connection management service | P0 | 4h | EXP-002 | [ ] |
| EXP-004 | Implement reconnection logic | P0 | 3h | EXP-003 | [ ] |
| EXP-005 | Build heartbeat/ping system | P0 | 2h | EXP-003 | [ ] |
| EXP-006 | Create presence tracking | P1 | 3h | EXP-003 | [ ] |
| EXP-007 | Implement connection pooling | P1 | 4h | EXP-002 | [ ] |
| EXP-008 | Add connection analytics | P1 | 2h | EXP-003 | [ ] |

### Matchmaking System

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| EXP-009 | Create matchmaking_queue table | P0 | 2h | SCL-084 | [ ] |
| EXP-010 | Design ELO-based matching algorithm | P0 | 4h | - | [ ] |
| EXP-011 | Implement queue join/leave API | P0 | 3h | EXP-009 | [ ] |
| EXP-012 | Build match pairing service | P0 | 6h | EXP-010 | [ ] |
| EXP-013 | Create team strength band matching | P0 | 3h | EXP-012 | [ ] |
| EXP-014 | Implement wait time limits (60s max) | P0 | 2h | EXP-012 | [ ] |
| EXP-015 | Add bot opponent fallback | P1 | 4h | EXP-014 | [ ] |
| EXP-016 | Build matchmaking UI | P0 | 4h | EXP-011 | [ ] |

### Week 15-16: Live Match System

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| EXP-017 | Create live_matches table | P0 | 2h | EXP-012 | [ ] |
| EXP-018 | Design real-time match state sync | P0 | 6h | EXP-017 | [ ] |
| EXP-019 | Implement turn-based decision system | P0 | 8h | EXP-018 | [ ] |
| EXP-020 | Build real-time match UI | P0 | 8h | EXP-019 | [ ] |
| EXP-021 | Create in-match tactical changes | P0 | 4h | EXP-019 | [ ] |
| EXP-022 | Implement substitution system | P1 | 3h | EXP-021 | [ ] |
| EXP-023 | Add match timer/clock | P0 | 2h | EXP-020 | [ ] |
| EXP-024 | Build live match events feed | P0 | 4h | EXP-020 | [ ] |

### Anti-Cheat & Security

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| EXP-025 | Implement server-authoritative game state | P0 | 6h | EXP-018 | [ ] |
| EXP-026 | Add action rate limiting (10/sec) | P0 | 2h | EXP-025 | [ ] |
| EXP-027 | Create replay validation system | P1 | 6h | EXP-025 | [ ] |
| EXP-028 | Implement disconnect handling | P0 | 3h | EXP-018 | [ ] |
| EXP-029 | Add timeout detection | P0 | 2h | EXP-028 | [ ] |
| EXP-030 | Create match result verification | P0 | 4h | EXP-027 | [ ] |

---

## Month 5: Ranked & Seasons

### Week 17-18: Ranking System

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| EXP-031 | Create player_rankings table | P0 | 2h | EXP-030 | [ ] |
| EXP-032 | Implement ELO calculation service | P0 | 4h | EXP-031 | [ ] |
| EXP-033 | Design rank tiers (Bronze to Diamond) | P0 | 2h | - | [ ] |
| EXP-034 | Create rank tier icons/assets | P1 | 4h | EXP-033 | [ ] |
| EXP-035 | Build rank display component | P0 | 2h | EXP-034 | [ ] |
| EXP-036 | Implement placement matches (10) | P0 | 4h | EXP-032 | [ ] |
| EXP-037 | Create rank change animations | P1 | 3h | EXP-035 | [ ] |
| EXP-038 | Add rank history tracking | P1 | 2h | EXP-031 | [ ] |
| EXP-039 | Implement rank decay (7 days inactive) | P1 | 3h | EXP-031 | [ ] |
| EXP-040 | Build ranked leaderboard | P0 | 4h | EXP-031 | [ ] |

### Week 19-20: Seasonal System

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| EXP-041 | Create seasons table | P0 | 2h | EXP-040 | [ ] |
| EXP-042 | Design season calendar (3 months) | P0 | 2h | - | [ ] |
| EXP-043 | Implement season start/end logic | P0 | 4h | EXP-041 | [ ] |
| EXP-044 | Create season rewards table | P0 | 2h | EXP-041 | [ ] |
| EXP-045 | Design season reward tiers | P0 | 3h | EXP-044 | [ ] |
| EXP-046 | Build season end celebration UI | P1 | 4h | EXP-045 | [ ] |
| EXP-047 | Implement soft rank reset | P0 | 3h | EXP-043 | [ ] |
| EXP-048 | Create season statistics archive | P1 | 3h | EXP-041 | [ ] |
| EXP-049 | Build season pass system (optional) | P2 | 8h | EXP-044 | [ ] |

---

## Month 6: Social & Events

### Week 21-22: Guild/Club System

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| EXP-050 | Create guilds table | P1 | 2h | EXP-049 | [ ] |
| EXP-051 | Create guild_members table | P1 | 2h | EXP-050 | [ ] |
| EXP-052 | Build guild creation flow | P1 | 4h | EXP-050 | [ ] |
| EXP-053 | Implement guild search/discovery | P1 | 3h | EXP-050 | [ ] |
| EXP-054 | Create guild join request system | P1 | 3h | EXP-051 | [ ] |
| EXP-055 | Build guild management (roles, kick) | P1 | 4h | EXP-051 | [ ] |
| EXP-056 | Implement guild chat channel | P1 | 6h | EXP-050 | [ ] |
| EXP-057 | Create guild leaderboard | P1 | 3h | EXP-050 | [ ] |
| EXP-058 | Add guild achievements | P2 | 4h | EXP-057 | [ ] |
| EXP-059 | Build guild vs guild competitions | P2 | 8h | EXP-057 | [ ] |

### Week 23-24: Live Events

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| EXP-060 | Create events table | P1 | 2h | EXP-059 | [ ] |
| EXP-061 | Design event framework | P1 | 4h | EXP-060 | [ ] |
| EXP-062 | Build event calendar UI | P1 | 3h | EXP-060 | [ ] |
| EXP-063 | Create special tournament type | P1 | 6h | EXP-061 | [ ] |
| EXP-064 | Implement time-limited game modes | P2 | 6h | EXP-061 | [ ] |
| EXP-065 | Build event reward distribution | P1 | 3h | EXP-063 | [ ] |
| EXP-066 | Create event notification system | P1 | 2h | EXP-060 | [ ] |
| EXP-067 | Add event countdown timers | P1 | 2h | EXP-062 | [ ] |

---

# Phase 5: Global Expansion (Months 7-12)

## Month 7-8: Localization Foundation

### Localization Infrastructure

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| GLB-001 | Research i18n solutions (next-intl) | P0 | 4h | - | [ ] |
| GLB-002 | Set up internationalization framework | P0 | 6h | GLB-001 | [ ] |
| GLB-003 | Extract all strings to translation files | P0 | 8h | GLB-002 | [ ] |
| GLB-004 | Create translation management system | P0 | 4h | GLB-003 | [ ] |
| GLB-005 | Implement language selector UI | P0 | 2h | GLB-002 | [ ] |
| GLB-006 | Add RTL support preparation | P2 | 4h | GLB-002 | [ ] |
| GLB-007 | Create locale-specific formatting | P0 | 3h | GLB-002 | [ ] |

### Portuguese (Portugal) Localization

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| GLB-008 | Translate UI strings (PT-PT) | P0 | 8h | GLB-003 | [ ] |
| GLB-009 | Adapt AI personality for PT-PT | P0 | 6h | GLB-008 | [ ] |
| GLB-010 | Localize marketing materials | P1 | 4h | GLB-008 | [ ] |
| GLB-011 | Add Portuguese Liga teams | P0 | 4h | - | [ ] |
| GLB-012 | Seed Portuguese players data | P0 | 6h | GLB-011 | [ ] |
| GLB-013 | Test PT-PT experience end-to-end | P0 | 4h | All PT | [ ] |

### Spanish (LATAM) Localization

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| GLB-014 | Translate UI strings (ES-LATAM) | P0 | 8h | GLB-003 | [ ] |
| GLB-015 | Adapt AI personality for ES-LATAM | P0 | 6h | GLB-014 | [ ] |
| GLB-016 | Localize marketing materials (ES) | P1 | 4h | GLB-014 | [ ] |
| GLB-017 | Add Liga MX teams | P0 | 4h | - | [ ] |
| GLB-018 | Add Argentine Primera teams | P0 | 4h | - | [ ] |
| GLB-019 | Seed LATAM players data | P0 | 8h | GLB-017,18 | [ ] |
| GLB-020 | Test ES-LATAM experience end-to-end | P0 | 4h | All ES | [ ] |

---

## Month 9-10: European Expansion

### Major League Content

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| GLB-021 | Add Premier League teams | P0 | 6h | - | [ ] |
| GLB-022 | Seed Premier League players | P0 | 8h | GLB-021 | [ ] |
| GLB-023 | Add La Liga teams | P0 | 6h | - | [ ] |
| GLB-024 | Seed La Liga players | P0 | 8h | GLB-023 | [ ] |
| GLB-025 | Add Serie A teams | P1 | 6h | - | [ ] |
| GLB-026 | Seed Serie A players | P1 | 8h | GLB-025 | [ ] |
| GLB-027 | Add Bundesliga teams | P1 | 6h | - | [ ] |
| GLB-028 | Seed Bundesliga players | P1 | 8h | GLB-027 | [ ] |
| GLB-029 | Add Ligue 1 teams | P2 | 6h | - | [ ] |
| GLB-030 | Seed Ligue 1 players | P2 | 8h | GLB-029 | [ ] |
| GLB-031 | Verify data accuracy | P0 | 4h | All leagues | [ ] |

### English Localization

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| GLB-032 | Translate UI strings (EN-GB) | P0 | 6h | GLB-003 | [ ] |
| GLB-033 | Create EN-US variant | P1 | 3h | GLB-032 | [ ] |
| GLB-034 | Adapt AI personality for English | P0 | 8h | GLB-032 | [ ] |
| GLB-035 | Localize marketing materials (EN) | P0 | 4h | GLB-032 | [ ] |
| GLB-036 | Test EN experience end-to-end | P0 | 4h | All EN | [ ] |

### Currency & Payments

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| GLB-037 | Add EUR payment support | P0 | 3h | SCL-004 | [ ] |
| GLB-038 | Add GBP payment support | P0 | 3h | SCL-004 | [ ] |
| GLB-039 | Add MXN payment support | P1 | 3h | SCL-004 | [ ] |
| GLB-040 | Implement dynamic pricing by region | P0 | 4h | GLB-037 | [ ] |
| GLB-041 | Add regional payment methods | P1 | 6h | GLB-040 | [ ] |

---

## Month 11-12: Esports

### Tournament Platform

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| GLB-042 | Design esports tournament framework | P1 | 6h | - | [ ] |
| GLB-043 | Create official_tournaments table | P1 | 2h | GLB-042 | [ ] |
| GLB-044 | Build tournament registration system | P1 | 4h | GLB-043 | [ ] |
| GLB-045 | Implement qualification rounds | P1 | 6h | GLB-044 | [ ] |
| GLB-046 | Create bracket generation for 128+ | P1 | 4h | GLB-045 | [ ] |
| GLB-047 | Build tournament spectator mode | P1 | 8h | GLB-046 | [ ] |
| GLB-048 | Implement prize pool display | P1 | 2h | GLB-043 | [ ] |
| GLB-049 | Create tournament results archive | P1 | 3h | GLB-043 | [ ] |

### Streaming & Broadcasting

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| GLB-050 | Create caster/observer mode | P1 | 8h | GLB-047 | [ ] |
| GLB-051 | Build match replay system | P1 | 10h | EXP-027 | [ ] |
| GLB-052 | Integrate with Twitch/YouTube | P2 | 6h | GLB-050 | [ ] |
| GLB-053 | Create broadcast overlay graphics | P2 | 6h | GLB-050 | [ ] |
| GLB-054 | Add AI commentary generation | P2 | 8h | GLB-050 | [ ] |

---

## Task Checklist Summary

```
PHASE 4: EXPANSION (Months 4-6)
===============================

Month 4 (Real-Time PvP)
[ ] EXP-001 through EXP-030 (30 tasks)
Estimated: 102 hours

Month 5 (Ranked & Seasons)
[ ] EXP-031 through EXP-049 (19 tasks)
Estimated: 61 hours

Month 6 (Social & Events)
[ ] EXP-050 through EXP-067 (18 tasks)
Estimated: 66 hours

PHASE 4 SUBTOTAL: 67 tasks, 229 hours

===============================

PHASE 5: GLOBAL (Months 7-12)
===============================

Months 7-8 (Localization)
[ ] GLB-001 through GLB-020 (20 tasks)
Estimated: 99 hours

Months 9-10 (European)
[ ] GLB-021 through GLB-041 (21 tasks)
Estimated: 103 hours

Months 11-12 (Esports)
[ ] GLB-042 through GLB-054 (13 tasks)
Estimated: 69 hours

PHASE 5 SUBTOTAL: 54 tasks, 271 hours

===============================

GRAND TOTAL: 121 tasks, 500 hours
```

---

## Priority Breakdown

### Phase 4

| Priority | Tasks | Hours | Focus |
|----------|-------|-------|-------|
| P0 | 38 | 134h | Real-time, ranked core |
| P1 | 22 | 73h | Guilds, events, polish |
| P2 | 7 | 22h | Optional features |

### Phase 5

| Priority | Tasks | Hours | Focus |
|----------|-------|-------|-------|
| P0 | 27 | 119h | Localization, content |
| P1 | 19 | 111h | Esports |
| P2 | 8 | 41h | Advanced streaming |

---

## Technical Architecture Changes

### Phase 4 Infrastructure

```
+-------------------------------------------+
|              CLIENT (Next.js)             |
+-------------------------------------------+
            |                    |
            v                    v
+------------------+   +------------------+
|   REST API       |   |   WebSocket      |
|   (Existing)     |   |   (New)          |
+------------------+   +------------------+
            |                    |
            v                    v
+-------------------------------------------+
|              SUPABASE                      |
|  +------------+  +------------+           |
|  | PostgreSQL |  | Realtime   |           |
|  +------------+  +------------+           |
+-------------------------------------------+
```

### Phase 5 Scale Architecture

```
+-------------------------------------------+
|              CDN (Vercel Edge)            |
+-------------------------------------------+
            |
            v
+-------------------------------------------+
|              LOAD BALANCER                |
+-------------------------------------------+
     |              |              |
     v              v              v
+--------+    +--------+    +--------+
| App 1  |    | App 2  |    | App 3  |
+--------+    +--------+    +--------+
     |              |              |
     v              v              v
+-------------------------------------------+
|          DATABASE CLUSTER                 |
|  +--------+  +--------+  +--------+      |
|  | Primary|  |Replica |  |Replica |      |
|  +--------+  +--------+  +--------+      |
+-------------------------------------------+
```

---

## Team Requirements

### Phase 4 Team

| Role | Type | Cost/Month |
|------|------|------------|
| Lead Developer | Full-time | $6,000 |
| Backend Developer | Part-time | $2,000 |
| Community Manager | Part-time | $1,500 |
| **Total** | | **$9,500** |

### Phase 5 Team

| Role | Type | Cost/Month |
|------|------|------------|
| Lead Developer | Full-time | $6,000 |
| Backend Developer | Full-time | $5,000 |
| Frontend Developer | Full-time | $5,000 |
| Localization Manager | Part-time | $2,000 |
| Community Manager | Full-time | $3,000 |
| Marketing Manager | Part-time | $2,000 |
| Esports Coordinator | Part-time | $1,500 |
| **Total** | | **$24,500** |

---

## Risk Register

| Risk | Phase | Probability | Impact | Mitigation |
|------|-------|-------------|--------|------------|
| WebSocket scaling issues | 4 | Medium | High | Load test early, have fallback |
| Anti-cheat bypass | 4 | Medium | High | Server-authoritative, logging |
| Low ranked participation | 4 | Low | Medium | Marketing, rewards |
| Localization quality | 5 | Medium | Medium | Native speaker review |
| Club licensing rejection | 5 | High | Medium | Use generic names initially |
| Esports low viewership | 5 | Medium | Low | Start small, build community |

---

## Success Metrics

### Phase 4 Targets

| Metric | Target | Critical |
|--------|--------|----------|
| Active users | 50,000+ | Yes |
| PvP participation | >30% | Yes |
| Ranked placement | >50% of PvP | No |
| Guild membership | >20% | No |

### Phase 5 Targets

| Metric | Target | Critical |
|--------|--------|----------|
| Total users | 100,000+ | Yes |
| International users | >20% | Yes |
| Languages supported | 3+ | Yes |
| Leagues available | 10+ | Yes |

---

## Related Documents

- [[00-Task-Index]] - Master task index
- [[03-Scale-Tasks]] - Previous phase tasks
- [[04-Phase-4-Expansion]] - Phase 4 overview
- [[05-Phase-5-Global]] - Phase 5 overview

---

*"First Brazil, then the world."*
