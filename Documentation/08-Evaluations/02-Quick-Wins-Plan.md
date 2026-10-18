# Fala Mestre! -- Quick Wins Plan

> **Date:** 2026-02-06
> **Priority:** Tasks that are high-impact, low-effort, and address critical/high-severity issues
> **Derived from:** `01-Comprehensive-Evaluation-2026-02-06.md`
> **Estimation scale:** XS (<30min), S (30min-2h), M (2-4h), L (4-8h), XL (1-2 days)

---

## Overview

This plan identifies 8 quick-win initiatives broken into 42 actionable tasks. They are ordered by **priority** (critical bugs first, then high-impact improvements). Each initiative addresses one or more issues from the evaluation's Critical Issues Register.

### Priority Matrix

```
                    HIGH IMPACT
                        |
     [QW-1 Fix Bugs]   |  [QW-2 Enable AI]
     [QW-3 Validation]  |  [QW-4 Game Logic]
                        |
  LOW EFFORT -----------+------------ HIGH EFFORT
                        |
     [QW-5 TypeScript]  |  [QW-7 Testing]
     [QW-6 Cleanup]     |  [QW-8 Auth]
                        |
                    LOW IMPACT
```

**Total estimated time: 3-5 days of focused work**

---

## QW-1: Fix Critical Bugs (Priority: CRITICAL)

**Impact:** Eliminates 4 critical/high issues from the evaluation
**Effort:** S-M (2-4 hours total)
**Risk if skipped:** Core features broken; disconnected state; visual glitches

### Task 1.1: Fix AI mock-only bug (Effort: XS)
- **File:** `app/src/app/api/conversation/route.ts`
- **Line:** 46-48
- **Problem:** Both branches of the `useMock` ternary call `callAIMock`. Real AI is never invoked.
- **Fix:** Change the false branch to call `callAI`:
  ```typescript
  const aiResponse = useMock
    ? await callAIMock(message, gameState, conversationHistory)
    : await callAI(message, gameState, conversationHistory);
  ```
- **Subtasks:**
  - [ ] 1.1.1 Fix the ternary to call `callAI` on the false branch
  - [ ] 1.1.2 Add a fallback: if `callAI` throws and there's no API key, fallback to mock gracefully
  - [ ] 1.1.3 Test with `useMock: false` and a valid OPENROUTER_API_KEY

### Task 1.2: Remove duplicate useGameState in ChatView (Effort: XS)
- **File:** `app/src/components/game/ChatView.tsx`
- **Line:** 129
- **Problem:** `ChatView` calls `useGameState()` independently, creating a disconnected state instance.
- **Fix:** Remove the hook call and derive `teamName` from messages or accept it as a prop.
- **Subtasks:**
  - [ ] 1.2.1 Remove `import { useGameState } from '@/hooks/useGameState'` from ChatView
  - [ ] 1.2.2 Remove `const { gameState } = useGameState()` at line 129
  - [ ] 1.2.3 Add `teamName?: string` to `ChatViewProps` interface
  - [ ] 1.2.4 Pass `teamName={gameState?.user.team}` from `page.tsx` to `ChatView`
  - [ ] 1.2.5 Update all `gameState?.user.team` references in ChatView to use the prop
  - [ ] 1.2.6 Verify the team badge still shows correctly in chat messages

### Task 1.3: Fix Math.random() in render functions (Effort: S)
- **File:** `app/src/components/game/MatchView.tsx`, `app/src/components/game/MatchSimulation.tsx`
- **Problem:** Random values are recalculated on every render, causing flickering stats.
- **Fix:** Use `useMemo` or `useState` to generate stable random values.
- **Subtasks:**
  - [ ] 1.3.1 In `MatchView.tsx:76`, wrap `opponentRating` in `useMemo(() => 70 + Math.floor(Math.random() * 10), [nextMatch.opponent])`
  - [ ] 1.3.2 In `MatchSimulation.tsx:199-201`, generate possession stats with `useMemo` based on `minute`
  - [ ] 1.3.3 Verify match stats no longer flicker during simulation

### Task 1.4: Fix React import position in SquadView (Effort: XS)
- **File:** `app/src/components/game/SquadView.tsx`
- **Line:** 316
- **Problem:** `import React from 'react'` is at the bottom of the file.
- **Fix:** Move it to the top with the other imports.
- **Subtasks:**
  - [ ] 1.4.1 Remove `import React from 'react'` from line 316
  - [ ] 1.4.2 Add it to the top of the file after the first `'use client'` line
  - [ ] 1.4.3 Verify SquadView still renders correctly (StatCard's useEffect depends on React)

---

## QW-2: Enable Real AI Integration (Priority: CRITICAL)

**Impact:** Transforms the app from a static mock to an actual AI-powered experience
**Effort:** M (2-4 hours)
**Risk if skipped:** The product's core differentiator (AI conversation) doesn't work

### Task 2.1: Make AI mode configurable (Effort: S)
- **File:** `app/src/app/api/conversation/route.ts`
- **Problem:** `useMock` defaults to `true` and the real AI path is broken (see QW-1.1).
- **Subtasks:**
  - [ ] 2.1.1 Add `USE_MOCK_AI` environment variable to `.env.example`
  - [ ] 2.1.2 Change the default: `const useMock = requestBody.useMock ?? (process.env.USE_MOCK_AI === 'true' || !process.env.OPENROUTER_API_KEY)`
  - [ ] 2.1.3 Remove `useMock: true` hardcoded in `useGameState.ts:100` -- let it default to env var
  - [ ] 2.1.4 Update `app/README.md` to document the new env var

### Task 2.2: Improve AI error handling and fallback (Effort: S)
- **File:** `app/src/lib/ai-service.ts`
- **Problem:** If the real AI call fails, the fallback response is generic and doesn't classify intent.
- **Subtasks:**
  - [ ] 2.2.1 In the `callAI` catch block, use `classifyIntent` for the fallback response
  - [ ] 2.2.2 Add a retry mechanism: try real AI once, on failure try mock, log the failure
  - [ ] 2.2.3 Add timeout to the fetch call (8 second timeout): `AbortController` with `signal`
  - [ ] 2.2.4 Log AI failures to the analytics_events table for monitoring

### Task 2.3: Improve mock AI response variety (Effort: M)
- **File:** `app/src/lib/ai-service.ts`
- **Problem:** Only 4 response patterns exist. Conversations feel repetitive.
- **Subtasks:**
  - [ ] 2.3.1 Add 3-5 response variants per intent (randomly selected)
  - [ ] 2.3.2 Add response patterns for: `training`, `playing_style_aggressive`, `playing_style_defensive`, `spending_conservative`, `spending_aggressive`
  - [ ] 2.3.3 Include game state context in mock responses (player names, opponent names, score history)
  - [ ] 2.3.4 Add a "greeting" intent for "ola", "bom dia", "e ai"

---

## QW-3: Add Input Validation (Priority: CRITICAL)

**Impact:** Prevents injection, DOS, and data corruption attacks
**Effort:** S-M (2-3 hours)
**Risk if skipped:** API is vulnerable to any malicious request

### Task 3.1: Install and configure Zod (Effort: S)
- **Subtasks:**
  - [ ] 3.1.1 Run `npm install zod` in the `app/` directory
  - [ ] 3.1.2 Create `app/src/lib/validations.ts` with Zod schemas:
    ```typescript
    import { z } from 'zod';

    export const conversationRequestSchema = z.object({
      userId: z.string().min(1).max(100),
      message: z.string().min(1).max(2000),
      useMock: z.boolean().optional(),
    });

    export const matchRequestSchema = z.object({
      userId: z.string().min(1).max(100),
    });
    ```

### Task 3.2: Add validation to conversation API (Effort: S)
- **File:** `app/src/app/api/conversation/route.ts`
- **Subtasks:**
  - [ ] 3.2.1 Import the `conversationRequestSchema` from validations
  - [ ] 3.2.2 Replace raw `await request.json()` with `conversationRequestSchema.parse(await request.json())`
  - [ ] 3.2.3 Wrap in try-catch: return 400 with Zod error details on `ZodError`
  - [ ] 3.2.4 Add userId format validation regex: `/^user_[a-z0-9]{9}$/`

### Task 3.3: Add validation to match API (Effort: XS)
- **File:** `app/src/app/api/match/route.ts`
- **Subtasks:**
  - [ ] 3.3.1 Import the `matchRequestSchema` from validations
  - [ ] 3.3.2 Validate the request body the same way as conversation
  - [ ] 3.3.3 Validate that the userId matches the expected format

### Task 3.4: Sanitize message content (Effort: S)
- **Subtasks:**
  - [ ] 3.4.1 Strip HTML tags from message content before processing
  - [ ] 3.4.2 Trim whitespace from messages
  - [ ] 3.4.3 Reject messages that are only whitespace or special characters

---

## QW-4: Fix Game Logic Issues (Priority: HIGH)

**Impact:** Makes matches feel realistic and progression meaningful
**Effort:** M (3-4 hours)
**Risk if skipped:** Players notice same-team matches and identical opponents immediately

### Task 4.1: Fix self-play bug (Effort: XS)
- **File:** `app/src/app/api/match/route.ts`
- **Line:** 63
- **Problem:** Random opponent can be the user's own team.
- **Subtasks:**
  - [ ] 4.1.1 Filter out the user's team from the opponent selection:
    ```typescript
    const opponents = BRAZILIAN_TEAMS.filter(t => t.name !== gameState.user.team);
    const nextOpponent = opponents[Math.floor(Math.random() * opponents.length)].name;
    ```
  - [ ] 4.1.2 Also filter out the current opponent to avoid repeat matches:
    ```typescript
    const opponents = BRAZILIAN_TEAMS.filter(t => 
      t.name !== gameState.user.team && t.name !== opponentTeam
    );
    ```

### Task 4.2: Generate proper opponent squads (Effort: S)
- **File:** `app/src/app/api/match/route.ts`
- **Lines:** 37-41
- **Problem:** Opponent squad is a clone of the user's squad.
- **Subtasks:**
  - [ ] 4.2.1 Import `generateSquad` from game-engine
  - [ ] 4.2.2 Replace the squad cloning with: `const opponentSquad = generateSquad(opponentTeam)`
  - [ ] 4.2.3 Generate a random opponent morale: `const awayMorale = 55 + Math.floor(Math.random() * 30)` instead of hardcoded 70
  - [ ] 4.2.4 Verify match results now have more variance

### Task 4.3: Use hidden player attributes in simulation (Effort: M)
- **File:** `app/src/lib/game-engine.ts`
- **Problem:** `bigMatchPlayer`, `consistency`, `leadership` attributes are generated but never used.
- **Subtasks:**
  - [ ] 4.3.1 In `simulateMatch`: multiply goal probability by consistency/100 for each check
  - [ ] 4.3.2 Apply `bigMatchPlayer` bonus when playing against top-3 teams
  - [ ] 4.3.3 Apply `leadership` bonus to morale calculation
  - [ ] 4.3.4 Update `calculateTeamPower` to factor in average leadership for team cohesion bonus

### Task 4.4: Add season fixture logic (Effort: S)
- **File:** `app/src/app/api/match/route.ts`
- **Problem:** Position calculation is simplistic (decrease by 1 on any win).
- **Subtasks:**
  - [ ] 4.4.1 Track total wins/draws/losses in game state
  - [ ] 4.4.2 Calculate position based on points relative to expected points: `position = Math.max(1, Math.min(20, 11 - Math.floor(points / (week * 3) * 10)))`
  - [ ] 4.4.3 Add season end condition at week 38 (Liga Mestre has 38 rounds)
  - [ ] 4.4.4 Show a season summary when week reaches 38

---

## QW-5: TypeScript Strictness (Priority: HIGH)

**Impact:** Catches bugs at compile time; prevents runtime type errors
**Effort:** M (2-4 hours)
**Risk if skipped:** Silent data corruption from untyped JSONB; difficult debugging

### Task 5.1: Type the database client (Effort: S)
- **File:** `app/src/db/index.ts`
- **Problem:** `let db: any` makes the entire database layer untyped.
- **Subtasks:**
  - [ ] 5.1.1 Import the proper Drizzle type: `import { NeonHttpDatabase } from 'drizzle-orm/neon-http'`
  - [ ] 5.1.2 Type the db variable: `let db: NeonHttpDatabase<typeof schema>`
  - [ ] 5.1.3 Type the mock db to match the same interface (or create a typed mock factory)
  - [ ] 5.1.4 Verify type errors are caught by `tsc --noEmit`

### Task 5.2: Type the JSONB columns (Effort: S)
- **File:** `app/src/db/schema.ts`
- **Problem:** `currentState` uses `$type<any>()`.
- **Subtasks:**
  - [ ] 5.2.1 Change `.$type<any>()` to `.$type<GameState>()` with proper import
  - [ ] 5.2.2 Type `conversationHistory` as `.$type<Message[]>()`
  - [ ] 5.2.3 Type `statistics` as a proper interface (or remove if unused)
  - [ ] 5.2.4 Type `properties` in analyticsEvents as a proper interface
  - [ ] 5.2.5 Replace `pendingDecisions: any[]` in types.ts with a proper union type

### Task 5.3: Add runtime validation for DB reads (Effort: S)
- **Problem:** JSONB data from DB is cast with `as GameState` without validation.
- **Subtasks:**
  - [ ] 5.3.1 Create a Zod schema that mirrors the `GameState` TypeScript interface
  - [ ] 5.3.2 Validate JSONB data after reading from DB: `gameStateSchema.parse(record.currentState)`
  - [ ] 5.3.3 Handle validation errors gracefully (reset to initial state if corrupted)

---

## QW-6: Code Cleanup (Priority: MEDIUM)

**Impact:** Cleaner codebase, smaller bundle, fewer deprecation warnings
**Effort:** S (1-2 hours)
**Risk if skipped:** Minor; tech debt accumulates

### Task 6.1: Replace deprecated `substr` with `substring` (Effort: XS)
- **Affected files:** `useGameState.ts`, `game-engine.ts`, `ai-service.ts`, `conversation/route.ts`, `match/route.ts`
- **Subtasks:**
  - [ ] 6.1.1 Search for all `.substr(` occurrences
  - [ ] 6.1.2 Replace `.substr(2, 9)` with `.substring(2, 11)` (same behavior for positive args)
  - [ ] 6.1.3 Verify no behavior change with a quick test

### Task 6.2: Remove unused dependencies (Effort: XS)
- **File:** `app/package.json`
- **Subtasks:**
  - [ ] 6.2.1 Remove `lottie-react` if not used (only imported in `LottieAnimation.tsx` which appears unused)
  - [ ] 6.2.2 Check if `LottieAnimation.tsx` is imported anywhere; if not, remove the component too
  - [ ] 6.2.3 Run `npm prune` to clean up

### Task 6.3: Extract magic values to constants (Effort: S)
- **Subtasks:**
  - [ ] 6.3.1 Create `app/src/lib/constants.ts`
  - [ ] 6.3.2 Move game constants:
    ```typescript
    export const GAME_CONSTANTS = {
      HOME_ADVANTAGE: 1.1,
      DEFAULT_MORALE: 75,
      DEFAULT_FITNESS: 100,
      MAX_MORALE: 100,
      MIN_MORALE: 30,
      WIN_POINTS: 3,
      DRAW_POINTS: 1,
      LOSS_POINTS: 0,
      SEASON_LENGTH: 38,
      BASE_RATINGS: { GK: 70, DEF: 68, MID: 72, FWD: 75 },
      POSITION_WEIGHTS: { GK: 0.8, DEF: 1.0, MID: 1.1, FWD: 1.2 },
    };
    ```
  - [ ] 6.3.3 Replace all hardcoded values in `game-engine.ts` and `match/route.ts`
  - [ ] 6.3.4 Move AI model name to env var: `process.env.AI_MODEL || 'zhipu/glm-4.7'`

### Task 6.4: Add a proper ID generation utility (Effort: XS)
- **Problem:** `Math.random().toString(36).substring(2, 11)` is used in 8+ places.
- **Subtasks:**
  - [ ] 6.4.1 Add to `utils.ts`: `export const generateId = (prefix?: string) => ${prefix ? prefix + '_' : ''}${Math.random().toString(36).substring(2, 11)}`
  - [ ] 6.4.2 Replace all inline ID generation with `generateId()` or `generateId('user')`

---

## QW-7: Set Up Testing Foundation (Priority: HIGH)

**Impact:** Enables regression testing and confidence for future changes
**Effort:** L (4-8 hours for foundation + initial tests)
**Risk if skipped:** Every change risks breaking existing functionality; no confidence to refactor

### Task 7.1: Install and configure Vitest (Effort: S)
- **Subtasks:**
  - [ ] 7.1.1 Run `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`
  - [ ] 7.1.2 Create `app/vitest.config.ts`:
    ```typescript
    import { defineConfig } from 'vitest/config';
    import path from 'path';

    export default defineConfig({
      test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        },
      },
    });
    ```
  - [ ] 7.1.3 Create `app/src/test/setup.ts` with `@testing-library/jest-dom` import
  - [ ] 7.1.4 Add `"test": "vitest"` and `"test:run": "vitest run"` to package.json scripts

### Task 7.2: Write game engine unit tests (Effort: M)
- **Priority:** Highest -- game engine is the most testable and critical business logic
- **Subtasks:**
  - [ ] 7.2.1 Create `app/src/lib/__tests__/game-engine.test.ts`
  - [ ] 7.2.2 Test `generateSquad`: correct number of players (11), correct position distribution (1 GK, 4 DEF, 3 MID, 3 FWD), all attributes in 50-99 range
  - [ ] 7.2.3 Test `calculateTeamPower`: returns positive number, morale affects power proportionally, position weights are applied
  - [ ] 7.2.4 Test `simulateMatch`: returns valid scores (non-negative integers), events array has at least one entry for a 90-minute match, winner matches score comparison
  - [ ] 7.2.5 Test `createInitialGameState`: correct team assigned, week starts at 1, morale is 75, squad has 11 players

### Task 7.3: Write AI service unit tests (Effort: S)
- **Subtasks:**
  - [ ] 7.3.1 Create `app/src/lib/__tests__/ai-service.test.ts`
  - [ ] 7.3.2 Test `classifyIntent`: "quero jogar" -> "play_match", "meu elenco" -> "view_squad", "comprar jogador" -> "transfer_market", "ola" -> "general_chat"
  - [ ] 7.3.3 Test `callAIMock`: returns valid AIResponse shape, responds to different intents, simulates latency

### Task 7.4: Add test script to CI (Effort: XS)
- **Subtasks:**
  - [ ] 7.4.1 Create `.github/workflows/test.yml` with basic test job
  - [ ] 7.4.2 Run `npm run test:run` in the workflow
  - [ ] 7.4.3 Run `tsc --noEmit` in the workflow for type checking
  - [ ] 7.4.4 Run `npm run lint` in the workflow

---

## QW-8: Basic Authentication (Priority: HIGH)

**Impact:** Prevents unauthorized data access; enables proper user identity
**Effort:** L-XL (6-12 hours depending on approach)
**Risk if skipped:** Any user's data is accessible to anyone; no trust boundary

### Task 8.1: Evaluate auth approach (Effort: XS)
- **Decision needed:** Choose one:
  - **Option A: NextAuth.js** -- Quick setup, Google/GitHub OAuth, session management. Best for MVP.
  - **Option B: Lucia Auth** -- Already mentioned in docs. Lightweight, flexible. Good for custom flows.
  - **Option C: Clerk** -- Hosted auth, minimal code, beautiful UI. Fastest to implement.
- **Subtasks:**
  - [ ] 8.1.1 Evaluate each option against requirements (speed to implement, cost)
  - [ ] 8.1.2 Choose and document the decision

### Task 8.2: Implement basic auth (Effort: L)
- **Subtasks:**
  - [ ] 8.2.1 Install chosen auth library
  - [ ] 8.2.2 Configure auth provider (Google OAuth at minimum)
  - [ ] 8.2.3 Create login/signup page
  - [ ] 8.2.4 Add auth middleware to protect API routes
  - [ ] 8.2.5 Replace localStorage userId with authenticated user ID
  - [ ] 8.2.6 Migrate the `users` table to work with the auth provider
  - [ ] 8.2.7 Add session validation to all API route handlers

### Task 8.3: Protect API routes (Effort: S)
- **Subtasks:**
  - [ ] 8.3.1 Create `app/src/lib/auth.ts` middleware helper
  - [ ] 8.3.2 Add `getAuthenticatedUser()` check at the top of every API route
  - [ ] 8.3.3 Ensure users can only access their own game state (compare session userId with request userId)
  - [ ] 8.3.4 Return 401 for unauthenticated requests
  - [ ] 8.3.5 Return 403 for requests to other users' data

---

## Execution Order

The recommended execution order optimizes for: critical fixes first, then enablers, then improvements.

```
Week 1 (Days 1-2):
  [QW-1] Fix Critical Bugs (2-4h)          -- Unblocks everything
  [QW-3] Add Input Validation (2-3h)        -- Security foundation
  [QW-6] Code Cleanup (1-2h)                -- Quick quality boost

Week 1 (Days 3-5):
  [QW-4] Fix Game Logic (3-4h)              -- Better user experience
  [QW-5] TypeScript Strictness (2-4h)       -- Catches future bugs
  [QW-2] Enable Real AI (2-4h)              -- Core differentiator

Week 2 (Days 1-3):
  [QW-7] Testing Foundation (4-8h)          -- Enables safe refactoring
  [QW-8] Basic Authentication (6-12h)       -- Security requirement
```

### Progress Tracking

| # | Initiative | Tasks | Status | Completion |
|---|-----------|-------|--------|------------|
| QW-1 | Fix Critical Bugs | 4 tasks, 14 subtasks | Not Started | 0% |
| QW-2 | Enable Real AI | 3 tasks, 11 subtasks | Not Started | 0% |
| QW-3 | Input Validation | 4 tasks, 10 subtasks | Not Started | 0% |
| QW-4 | Fix Game Logic | 4 tasks, 12 subtasks | Not Started | 0% |
| QW-5 | TypeScript Strictness | 3 tasks, 10 subtasks | Not Started | 0% |
| QW-6 | Code Cleanup | 4 tasks, 11 subtasks | Not Started | 0% |
| QW-7 | Testing Foundation | 4 tasks, 13 subtasks | Not Started | 0% |
| QW-8 | Basic Authentication | 3 tasks, 13 subtasks | Not Started | 0% |
| | **Total** | **29 tasks, 94 subtasks** | | **0%** |

---

## Expected Outcomes After Completion

| Metric | Before | After |
|--------|--------|-------|
| Critical bugs | 4 | 0 |
| AI integration | Mock only | Real AI + Mock fallback |
| Input validation | None | All API endpoints validated |
| Test coverage | 0% | ~30% (core business logic) |
| Authentication | None | OAuth-based |
| TypeScript `any` usage | 6+ instances | 0 |
| Security score (eval) | 1.5/5 | ~3.0/5 |
| **Overall eval score** | **2.72/5** | **~3.5/5 (estimated)** |

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-06 | 1.0 | Initial quick wins plan |
