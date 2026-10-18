# Phase 3: Decision Prompt UI Component — Implementation Plan

## Context

Phase 1 built types, constants, and the decision engine. Phase 2 built game engine segmentation, commentary, and the API endpoint. Phase 3 connects them to the user's screen.

The UI must follow existing patterns: `'use client'` components, `framer-motion` for animations, `lucide-react` for icons, pixel-art CSS classes (`pixel-card`, `pixel-border`, `pixel-btn`), and `Button` from shadcn/ui.

## Files to Create/Modify

| File | Action | Est. Lines |
|------|--------|------------|
| `app/src/components/game/DecisionPrompt.tsx` | CREATE | ~200 |
| `app/src/components/game/TurnSummary.tsx` | CREATE | ~110 |
| `app/src/components/game/CountdownTimer.tsx` | CREATE | ~60 |
| `app/src/components/game/OptionButton.tsx` | CREATE | ~55 |
| `app/src/app/pixel-art.css` | MODIFY | +70 |
| `app/src/components/game/index.ts` | MODIFY | +4 exports |

**Total: ~495 lines (430 new, 65 modified)**

## Execution Order

```
3.5 (CSS) ─────────────────────────────────────────┐
                                                     ▼
3.3 (CountdownTimer) ──┐                    ┌── 3.1 (DecisionPrompt)
                        ├─── depends on ────┤
3.4 (OptionButton) ────┘     3.5 (CSS)      ├── 3.2 (TurnSummary)
                                                     │
                                                     ▼
                                              3.6 (Update exports)
```

- **Phase 1 (parallel):** 3.5 + 3.3 + 3.4 (no dependencies between them)
- **Phase 2 (sequential):** 3.1 + 3.2 (depend on 3.3, 3.4, 3.5)
- **Phase 3 (sequential):** 3.6 (depends on 3.1, 3.2)

## Known Issue: Reduced-motion CSS edit

The previous model (qwen3-coder) looped 30+ times trying to add reduced-motion overrides. The issue was matching the oldString. The existing reduced-motion block is at lines 137-144 of pixel-art.css. To add new classes, use this EXACT oldString:

```css
    [class*="animate-"] {
      animation: none !important;
      transition: none !important;
    }
  }
```

And add the new animation classes before the closing brace.

---

## Task 3.5: Add CSS Animations to `pixel-art.css`

**STATUS: PARTIALLY DONE** — keyframes added (lines 86-127), still needs:
1. Reduced-motion overrides for new classes
2. Mobile optimization

### 3.5.1 — Reduced-motion overrides (ALREADY EXISTS at line 137, NEEDS UPDATE)

Add these classes to the existing `@media (prefers-reduced-motion: reduce)` block:

```css
    .timer-pulse,
    .prompt-enter,
    .default-flash,
    .score-pulse,
    .option-press {
      animation: none !important;
      transition: none !important;
    }
```

### 3.5.2 — Mobile optimization (ALREADY EXISTS at line 147, NEEDS UPDATE)

Add to the existing `@media (max-width: 768px)` block:

```css
    .prompt-enter { animation-duration: 0.25s; }
    .timer-bar-green, .timer-bar-yellow, .timer-bar-red { height: 6px; }
```

### Verification
- [ ] All animations render in Chrome
- [ ] `prefers-reduced-motion` disables all animations
- [ ] Mobile viewport shows correct sizing
- [ ] `npm run build` passes

---

## Task 3.3: Create `CountdownTimer.tsx`

**File:** `app/src/components/game/CountdownTimer.tsx` (NEW — ~60 lines)

### 3.3.1 — Props Interface

```typescript
interface CountdownTimerProps {
  timeRemaining: number;
  totalTime: number;
  isPulsing: boolean;      // true when <=10s
}
```

### 3.3.2 — Timer Bar

- Container: full width, 8px height, rounded
- Fill: width = `(timeRemaining / totalTime) * 100%`
- Color classes: `.timer-bar-green` (>15s) → `.timer-bar-yellow` (8-15s) → `.timer-bar-red` (<8s)
- When `isPulsing`: add `.timer-pulse` class

### 3.3.3 — Timer Text

- Remaining seconds: "{timeRemaining}s"
- Font: `font-[family-name:var(--font-retro)]`, `text-lg`
- Color matches bar color

### Verification
- [ ] Bar width matches time remaining
- [ ] Color transitions at correct thresholds (15s, 8s)
- [ ] Pulse animation plays when <=10s
- [ ] `npm run build` passes

---

## Task 3.4: Create `OptionButton.tsx`

**File:** `app/src/components/game/OptionButton.tsx` (NEW — ~55 lines)

### 3.4.1 — Props Interface

```typescript
interface OptionButtonProps {
  option: DecisionOption;
  isDefault: boolean;        // true if this is the default/fallback option
  isSelected: boolean;       // true if user selected this (or timeout default)
  onSelect: () => void;
  disabled: boolean;
}
```

### 3.4.2 — Button Layout

```
┌─────────────────────────────────────────┐
│ [icon]  label                           │
│         description text                │
└─────────────────────────────────────────┘
```

- Icon: `option.icon` (emoji string, rendered as text)
- Label: `option.label` (e.g., "Subir a marcação")
- Description: `option.description` (smaller text, muted color)

### 3.4.3 — Style Variants by Category

- **mentality/formation** (`category === 'mentality' || 'formation'`): Gold border (`border-[#FEDD00]`)
- **substitution** (`category === 'substitution'`): Blue border (`border-[#3b82f6]`)
- **tactical** (`category === 'tactical'`): Standard pixel-btn
- **default/keep_setup** (`isDefault === true`): Subtle style, muted border (`border-white/30`)

### 3.4.4 — Interaction States

- **Normal:** Default pixel-btn style
- **Hover/Focus:** Slight brightness increase, border glow
- **Pressed:** `.option-press` CSS animation
- **Selected (timeout):** `.default-flash` CSS animation
- **Disabled:** `opacity-0.5`, no pointer events

### 3.4.5 — Touch Target

- Minimum 44px height: `min-h-[44px]`
- Full width within parent container

### Verification
- [ ] Renders icon, label, description correctly
- [ ] Category-based styling applies
- [ ] Touch target >=44px
- [ ] Press animation triggers on tap
- [ ] `npm run build` passes

---

## Task 3.1: Create `DecisionPrompt.tsx`

**File:** `app/src/components/game/DecisionPrompt.tsx` (NEW — ~200 lines)

**Depends on:** 3.3 (CountdownTimer), 3.4 (OptionButton), 3.5 (CSS)

### 3.1.1 — Props Interface

```typescript
interface DecisionPromptProps {
  turn: DecisionTurn;
  turnPrompt: string;
  segmentSummary: string;
  onDecision: (option: DecisionOption) => void;
  onTimeout: () => void;
}
```

### 3.1.2 — Timer State Machine

- `useState` for `timeRemaining` (initialized to `turn.timerSeconds`)
- `useState` for `selectedOption` (null until user clicks or timeout)
- `useEffect` with `setInterval(1000)` → decrement `timeRemaining`
- When `timeRemaining === 0` → call `onTimeout()`, clear interval, highlight default option for 0.5s
- When `selectedOption !== null` → clear interval, call `onDecision(selectedOption)`
- **Pulse zone:** When `timeRemaining <= 10`, pass `isPulsing={true}` to CountdownTimer

### 3.1.3 — Layout Structure

```
Full-screen overlay (semi-transparent black backdrop)
  └─ pixel-card container (centered, max-width 400px, slide-up animation)
      ├─ CountdownTimer component (top)
      ├─ Turn header (turn.label + minute indicator)
      ├─ Context text (turnPrompt)
      └─ Option buttons (map turn.options → OptionButton, max 3)
```

### 3.1.4 — Timeout Behavior

- When timer hits 0: flash `defaultOption` button with `.default-flash` CSS class for 500ms
- After flash: call `onTimeout()` (parent handles applying default)
- Prompt closes with fade-out animation

### 3.1.5 — Entry/Exit Animations

- Entry: `.prompt-enter` CSS class (slide-up from bottom)
- Exit: framer-motion fade-out
- Wrap in parent `<AnimatePresence>` for smooth transitions

### Verification
- [ ] Renders with 1, 2, or 3 options
- [ ] Timer counts 30 → 0 accurately
- [ ] Clicking option calls `onDecision` with correct `DecisionOption`
- [ ] Timer expiry calls `onTimeout`
- [ ] Timer bar pulses when <=10s
- [ ] Default option flashes gold on timeout
- [ ] Backdrop blocks interaction with match behind it
- [ ] `npm run build` passes

---

## Task 3.2: Create `TurnSummary.tsx`

**File:** `app/src/components/game/TurnSummary.tsx` (NEW — ~110 lines)

### 3.2.1 — Props Interface

```typescript
interface TurnSummaryProps {
  segment: MatchSegment;
  homeTeam: string;
  awayTeam: string;
  homeColor: string;
  awayColor: string;
  segmentSummary: string;
  turnNumber: number;
  totalTurns: number;
  onContinue: () => void;
}
```

### 3.2.2 — Score Display

- Large centered score: `segment.homeScoreAtEnd` — `segment.awayScoreAtEnd`
- Team logos via `getTeamData()` (existing pattern from MatchSimulation.tsx)
- If goal scored (`homeScoreAtEnd !== homeScoreAtStart` or same for away): `.score-pulse` animation

### 3.2.3 — Segment Header

- "Fim do 1º Tempo" (if `segment.fromMinute === 45`) or "Minutos {from}'- {to}'"
- Turn indicator: "Decisão {turnNumber + 1}/{totalTurns}"

### 3.2.4 — Summary Text

- Render `segmentSummary` (max 3 lines, overflow hidden)
- Font: `font-[family-name:var(--font-retro)]`

### 3.2.5 — Auto-Advance Logic

- `useEffect` with 4-second timeout → call `onContinue()`
- "Continuar" button for manual advance (clears timeout, calls `onContinue` immediately)
- Counter: "Continuando em 4... 3... 2... 1..."

### 3.2.6 — Entry/Exit Animations

- Entry: fade-in + scale 0.95 → 1 (0.3s)
- Exit: fade-out + scale 1 → 0.95 (0.3s)
- Uses framer-motion `motion.div`

### Verification
- [ ] Renders correct score from segment data
- [ ] Shows correct time range ("Minutos 15'- 30'")
- [ ] Goal scored triggers score pulse animation
- [ ] Auto-advances after 4 seconds
- [ ] Manual "Continuar" skips auto-advance
- [ ] `npm run build` passes

---

## Task 3.6: Update Component Exports

**File:** `app/src/components/game/index.ts` (MODIFY)

Add to existing exports:

```typescript
export { DecisionPrompt } from './DecisionPrompt';
export { TurnSummary } from './TurnSummary';
export { CountdownTimer } from './CountdownTimer';
export { OptionButton } from './OptionButton';
```

### Verification
- [ ] All 4 components can be imported from `@/components/game`
- [ ] `npm run build` passes

---

## Final Verification Checklist

- [ ] `npm run build` passes with zero TypeScript errors
- [ ] DecisionPrompt renders with 1/2/3 options
- [ ] Timer counts 30→0 accurately
- [ ] Clicking option fires `onDecision` with correct data
- [ ] Timer expiry fires `onTimeout`, default option flashes gold
- [ ] Timer bar pulses when <=10s
- [ ] TurnSummary shows correct score and time range
- [ ] Goal scored triggers score pulse animation
- [ ] TurnSummary auto-advances after 4s
- [ ] "Continuar" button skips auto-advance
- [ ] All animations respect `prefers-reduced-motion`
- [ ] Touch targets >=44px on mobile (375px viewport)
- [ ] Pixel art theme is consistent (green cards, yellow borders)
- [ ] No console errors in browser
- [ ] Components exported from `index.ts`

---

## Key Reference Files

- **Types:** `app/src/lib/types.ts` lines 513-577 (DecisionOption, DecisionTurn, MatchSegment, etc.)
- **Constants:** `app/src/lib/constants.ts` lines 561-651 (DECISION_TURN_CONFIG, DECISION_TURNS)
- **Decision Engine:** `app/src/lib/decision-engine.ts` (buildDecisionTurn, generateDecisionOptions)
- **Commentary:** `app/src/lib/commentary.ts` (generateSegmentSummary, generateTurnPrompt)
- **Segment Engine:** `app/src/lib/match-segment-engine.ts` (runMatchSegment return shape)
- **Existing UI patterns:** `app/src/components/game/MatchSimulation.tsx`, `HighlightOverlay.tsx`, `MatchResultModal.tsx`
- **CSS:** `app/src/app/pixel-art.css` (pixel-card, pixel-border, pixel-btn classes)
- **Component index:** `app/src/components/game/index.ts`
