# Phase 1: MVP

---
tags: #roadmap #mvp #phase-1 #development
status: complete
priority: critical
phase: mvp
last_updated: 2026-01-18
timeline: Weeks 1-4
budget: $10,000
---

## Overview

Phase 1 delivers a Minimum Viable Product that proves the core concept: a conversational football management game that's fun to play.

> [!important] MVP Definition
> The smallest product that validates our hypothesis: people will manage a football club through conversation.

---

## Goals

1. **Playable core loop**: Select team -> Play matches -> Earn points
2. **Engaging AI**: Conversations feel natural and fun
3. **Technical foundation**: Scalable architecture for future phases
4. **User validation**: Beta feedback confirms product-market fit

---

## Week 1: Foundation

### Day 1-2: Project Setup

```
Tasks:
[x] Create Next.js 14 project with TypeScript
[x] Configure Tailwind CSS + shadcn/ui
[x] Set up Supabase project
[x] Configure environment variables
[x] Set up Git repository
[x] Create deployment pipeline (Vercel)
[x] Set up OpenRouter API access

Deliverable: Empty project deploys to staging
```

### Day 3-4: Database & Auth

```
Tasks:
[x] Create database schema (users, game_states)
[x] Set up Supabase Auth
[x] Create player database seed
[x] Implement basic API routes
[x] Add RLS policies

Deliverable: User can sign up and be stored
```

### Day 5-7: Chat Interface

```
Tasks:
[x] Build chat container component
[x] Create message bubble components
[x] Add input field with send
[x] Implement message history
[x] Add typing indicator
[x] Mobile-responsive layout

Deliverable: Chat UI functional (no AI yet)
```

---

## Week 2: Core Game

### Day 8-10: Team Selection & Squad

```
Tasks:
[x] Team selection screen
[x] 5 initial teams (Brazilian)
[x] Squad display card
[x] Formation visualization
[x] Player detail cards
[x] Basic squad JSON structure

Deliverable: User can select team and view squad
```

### Day 11-14: Match Simulation

```
Tasks:
[x] Match calculation engine
[x] Event generation (goals, cards)
[x] Score probability system
[x] Match result card
[x] Basic statistics
[x] Points awarding

Deliverable: Matches can be simulated with results
```

---

## Week 3: AI Integration

### Day 15-17: Claude Integration

```
Tasks:
[x] OpenRouter API integration
[x] System prompt engineering
[x] Intent classification
[x] Response formatting
[x] Error handling
[x] Fallback responses

Deliverable: AI responds to basic commands
```

### Day 18-21: Conversation Flow

```
Tasks:
[x] Match flow conversation
[x] Squad view conversation
[x] Help responses
[x] Context management
[x] Action buttons in responses
[x] Card rendering in chat

Deliverable: Full match can be played via conversation
```

---

## Week 4: Polish & Beta

### Day 22-24: Season & Points

```
Tasks:
[x] Season week progression
[x] League standings
[x] Points balance display
[x] Progress bar to voucher
[x] Daily login bonus
[x] Win streak tracking

Deliverable: Season progression works
```

### Day 25-28: Testing & Beta

```
Tasks:
[x] Bug fixes
[x] Performance optimization
[x] Analytics setup (Mixpanel)
[x] Beta invite system
[x] Feedback collection
[x] Documentation

Deliverable: Beta launches with 100 users
```

---

## Technical Specifications

### Tech Stack (MVP)

```typescript
const mvpStack = {
  frontend: "Next.js 14 + TypeScript",
  styling: "Tailwind CSS + shadcn/ui",
  state: "Zustand",
  backend: "Next.js API Routes",
  database: "Supabase PostgreSQL",
  auth: "Supabase Auth",
  ai: "OpenRouter (Claude Haiku/Sonnet)",
  hosting: "Vercel",
  analytics: "Mixpanel"
};
```

### API Endpoints (MVP)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/register` | POST | Create account |
| `/api/auth/login` | POST | Login |
| `/api/game/state` | GET | Get game state |
| `/api/conversation` | POST | Chat with AI |
| `/api/game/match` | POST | Play match |

### Database Tables (MVP)

| Table | Columns |
|-------|---------|
| `users` | id, email, username, socios_points, created_at |
| `game_states` | user_id, team, squad, season, week, points |
| `players` | id, name, team, position, attributes |
| `matches` | id, user_id, score, events, played_at |
| `conversations` | id, user_id, session_id, messages |

---

## Features Included

### Must Have (P0)

- [x] User registration/login
- [x] Team selection (5 teams)
- [x] Squad viewing
- [x] Match simulation
- [x] AI chat interface
- [x] Points earning
- [x] Season progression
- [x] Basic analytics

### Should Have (P1)

- [x] Formation display
- [x] Match statistics
- [x] Win streaks
- [x] Daily login bonus

### Won't Have (Deferred)

- [ ] Transfer market (Phase 2)
- [ ] Training (Phase 2)
- [ ] PvP (Phase 3)
- [ ] Premium features (Phase 3)
- [ ] Token redemption (Phase 3)

---

## Success Metrics

| Metric | Target | Critical |
|--------|--------|----------|
| Beta users | 100 | Yes |
| Matches played | 500+ | Yes |
| Avg session length | >10 min | Yes |
| AI response time (p95) | <2s | Yes |
| Critical bugs | 0 | Yes |
| User satisfaction | >7/10 | Yes |
| Day 1 return rate | >50% | Yes |

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| AI too slow | Medium | High | Haiku for simple tasks |
| UI not mobile-friendly | Low | High | Mobile-first design |
| Database bottleneck | Low | Medium | Proper indexes |
| Beta feedback negative | Medium | High | Rapid iteration |

---

## Budget Breakdown

| Item | Cost |
|------|------|
| Development (4 weeks) | $8,000 |
| Design assets | $1,000 |
| Infrastructure (month 1) | $200 |
| Testing/QA | $500 |
| Contingency | $300 |
| **Total** | **$10,000** |

---

## Exit Criteria

Phase 1 is complete when:

1. [ ] 100 beta users have played
2. [ ] Average session >10 minutes
3. [ ] D1 return rate >50%
4. [ ] No critical bugs
5. [ ] User satisfaction >7/10
6. [ ] AI response <2s (p95)
7. [ ] Core loop validated

---

## Related Documents

- [[00-Development-Phases]] - Phase overview
- [[02-Phase-2-Enhancement]] - Next phase
- [[01-MVP-Tasks]] - Detailed task list
- [[00-Core-Concept]] - Game design
- [[00-System-Overview]] - Technical architecture

---

*"If you're not embarrassed by the first version, you shipped too late." - Reid Hoffman*
