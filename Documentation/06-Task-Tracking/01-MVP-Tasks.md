# MVP Tasks (Phase 1)

---
tags: #tasks #mvp #phase-1 #tracking
status: active
priority: critical
phase: mvp
last_updated: 2026-01-18
---

## Overview

Detailed task breakdown for Phase 1 (MVP). Total: 52 tasks over 4 weeks.

---

## Week 1: Foundation (Day 1-7)

### Project Setup

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| MVP-001 | Create Next.js 14 project with TypeScript | P0 | 1h | - | [ ] |
| MVP-002 | Configure Tailwind CSS | P0 | 1h | MVP-001 | [ ] |
| MVP-003 | Install and configure shadcn/ui | P0 | 1h | MVP-002 | [ ] |
| MVP-004 | Set up project folder structure | P0 | 1h | MVP-001 | [ ] |
| MVP-005 | Configure ESLint and Prettier | P1 | 1h | MVP-001 | [ ] |
| MVP-006 | Set up Git repository | P0 | 0.5h | - | [ ] |
| MVP-007 | Create Vercel project and deploy | P0 | 1h | MVP-006 | [ ] |
| MVP-008 | Configure environment variables | P0 | 0.5h | MVP-007 | [ ] |

### Database & Auth

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| MVP-009 | Create Supabase project | P0 | 0.5h | - | [ ] |
| MVP-010 | Design users table schema | P0 | 1h | MVP-009 | [ ] |
| MVP-011 | Design game_states table schema | P0 | 2h | MVP-009 | [ ] |
| MVP-012 | Design players table schema | P0 | 1h | MVP-009 | [ ] |
| MVP-013 | Create database tables | P0 | 2h | MVP-010,11,12 | [ ] |
| MVP-014 | Set up RLS policies | P0 | 2h | MVP-013 | [ ] |
| MVP-015 | Configure Supabase Auth | P0 | 2h | MVP-009 | [ ] |
| MVP-016 | Create auth helper functions | P0 | 2h | MVP-015 | [ ] |

### Chat Interface

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| MVP-017 | Create chat container layout | P0 | 2h | MVP-003 | [ ] |
| MVP-018 | Build AI message bubble component | P0 | 1h | MVP-017 | [ ] |
| MVP-019 | Build user message bubble component | P0 | 1h | MVP-017 | [ ] |
| MVP-020 | Create chat input component | P0 | 2h | MVP-017 | [ ] |
| MVP-021 | Add typing indicator | P1 | 1h | MVP-017 | [ ] |
| MVP-022 | Implement message history state | P0 | 2h | MVP-017 | [ ] |
| MVP-023 | Make chat mobile-responsive | P0 | 2h | MVP-017 | [ ] |

---

## Week 2: Core Game (Day 8-14)

### Team Selection

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| MVP-024 | Create team selection screen | P0 | 3h | MVP-017 | [ ] |
| MVP-025 | Design team card component | P0 | 2h | MVP-024 | [ ] |
| MVP-026 | Add 5 Brazilian teams data | P0 | 2h | MVP-012 | [ ] |
| MVP-027 | Implement team selection logic | P0 | 2h | MVP-024 | [ ] |
| MVP-028 | Save selected team to database | P0 | 1h | MVP-027 | [ ] |

### Squad & Players

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| MVP-029 | Create player database seed script | P0 | 4h | MVP-012 | [ ] |
| MVP-030 | Seed 5 teams with full squads | P0 | 4h | MVP-029 | [ ] |
| MVP-031 | Build squad display card | P0 | 3h | MVP-017 | [ ] |
| MVP-032 | Create formation visualization | P1 | 4h | MVP-031 | [ ] |
| MVP-033 | Build player detail card | P1 | 2h | MVP-031 | [ ] |
| MVP-034 | Add player attributes display | P1 | 2h | MVP-033 | [ ] |

### Match Simulation

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| MVP-035 | Design match calculation algorithm | P0 | 4h | - | [ ] |
| MVP-036 | Implement team strength calculation | P0 | 2h | MVP-035 | [ ] |
| MVP-037 | Build goal probability system | P0 | 2h | MVP-035 | [ ] |
| MVP-038 | Create match event generator | P0 | 4h | MVP-035 | [ ] |
| MVP-039 | Build match result card | P0 | 2h | MVP-017 | [ ] |
| MVP-040 | Add match statistics display | P1 | 2h | MVP-039 | [ ] |

---

## Week 3: AI Integration (Day 15-21)

### Claude Integration

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| MVP-041 | Set up OpenRouter account | P0 | 0.5h | - | [ ] |
| MVP-042 | Create LLM service class | P0 | 2h | MVP-041 | [ ] |
| MVP-043 | Implement API route for conversation | P0 | 2h | MVP-042 | [ ] |
| MVP-044 | Create base system prompt | P0 | 4h | MVP-042 | [ ] |
| MVP-045 | Build intent classification prompt | P0 | 2h | MVP-044 | [ ] |
| MVP-046 | Add match simulation prompt | P0 | 4h | MVP-044 | [ ] |
| MVP-047 | Implement error handling | P0 | 2h | MVP-043 | [ ] |
| MVP-048 | Create fallback responses | P1 | 2h | MVP-047 | [ ] |

### Conversation Flows

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| MVP-049 | Implement match flow conversation | P0 | 4h | MVP-046 | [ ] |
| MVP-050 | Implement squad view conversation | P0 | 2h | MVP-045 | [ ] |
| MVP-051 | Add help/guidance responses | P1 | 2h | MVP-045 | [ ] |
| MVP-052 | Implement action buttons | P0 | 2h | MVP-049 | [ ] |
| MVP-053 | Add card rendering in responses | P0 | 3h | MVP-052 | [ ] |

---

## Week 4: Polish & Beta (Day 22-28)

### Season & Points

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| MVP-054 | Create season progression logic | P1 | 3h | MVP-038 | [ ] |
| MVP-055 | Build league standings display | P1 | 2h | MVP-054 | [ ] |
| MVP-056 | Implement points earning system | P0 | 3h | MVP-038 | [ ] |
| MVP-057 | Create points balance display | P0 | 1h | MVP-056 | [ ] |
| MVP-058 | Add progress bar to voucher | P1 | 1h | MVP-057 | [ ] |
| MVP-059 | Implement daily login bonus | P1 | 2h | MVP-056 | [ ] |

### Testing & Launch

| ID | Task | Priority | Hours | Deps | Status |
|----|------|----------|-------|------|--------|
| MVP-060 | Set up Mixpanel analytics | P0 | 2h | - | [ ] |
| MVP-061 | Add core event tracking | P0 | 3h | MVP-060 | [ ] |
| MVP-062 | Performance optimization | P0 | 4h | All | [ ] |
| MVP-063 | Bug fixing sprint | P0 | 8h | All | [ ] |
| MVP-064 | Create beta invite system | P1 | 2h | MVP-016 | [ ] |
| MVP-065 | Prepare beta feedback form | P1 | 1h | - | [ ] |
| MVP-066 | Deploy beta version | P0 | 2h | All | [ ] |
| MVP-067 | Invite 100 beta users | P0 | 2h | MVP-066 | [ ] |

---

## Task Checklist Summary

```
WEEK 1 TASKS
============
[ ] MVP-001 through MVP-023 (23 tasks)
Estimated: 30 hours

WEEK 2 TASKS
============
[ ] MVP-024 through MVP-040 (17 tasks)
Estimated: 42 hours

WEEK 3 TASKS
============
[ ] MVP-041 through MVP-053 (13 tasks)
Estimated: 31 hours

WEEK 4 TASKS
============
[ ] MVP-054 through MVP-067 (14 tasks)
Estimated: 36 hours

TOTAL: 67 tasks, 139 hours
```

---

## Definition of Done

Each task is "Done" when:

1. [ ] Code written and working
2. [ ] Tested manually
3. [ ] No TypeScript errors
4. [ ] Mobile-responsive (if UI)
5. [ ] Deployed to staging

---

## Related Documents

- [[00-Task-Index]] - Master task index
- [[01-Phase-1-MVP]] - MVP phase overview
- [[02-Enhancement-Tasks]] - Next phase tasks

---

*"The secret to getting ahead is getting started."*
