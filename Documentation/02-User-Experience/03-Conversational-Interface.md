# Conversational Interface - DEPRECATED

---
tags: #ux #interface #deprecated #history
status: deprecated
priority: low
phase: legacy
last_updated: 2026-03-29
---

> ⚠️ **This document describes the ORIGINAL conversational AI interface which has been DEPRECATED as of March 2026.**
> 
> The game no longer uses a chat-based interface. Please refer to [[03-Interface-Architecture]] for the current menu-based design.

---

## Historical Context (For Reference Only)

**Original Concept:** A ChatGPT-style chat that served as the entire game UI.

**Core Philosophy (OLD):**
> "Chat IS the controller. Natural language IS the interface."

**Why Deprecated:**
- Mobile-first UX failed with chat-only interface  
- Natural language processing too inconsistent in Portuguese
- UI/UX review feedback: users wanted faster, more direct interactions
- Menu-based navigation proved more intuitive for repeated gameplay loops

**Replacement:** See [[03-Interface-Architecture]] for current architecture.

---

## What Was Changed

| Old (Chat-Based) | New (Menu-Based) |
|-----------------|------------------|
| Conversational AI prompts | Bottom Navigation clusters |
| "Votar no chat" via text | Apostas page with betting UI |
| "Investir via chat" | Investir page with investment cards |
| AI response delays | Instant UI feedback |
| Language ambiguity | Clear button/tap actions |

---

## Progression Phases

The gameplay unlock phases (predictions, investments, special tournaments) were originally surfaced through AI hints in the chat. They are now reached through dedicated pages:

- **Predictions (Apostas):** match predictions using virtual in-game currency
- **Investments (Investir):** in-game investments with daily yields
- **No longer requires AI conversation**

---

## Migration Timeline

| Date | Change |
|------|--------|
| 2026-01 | Chat-only prototype |
| 2026-02 | Quick Actions added |
| 2026-03 | Menu navigation + Apostas + Investir pages complete |
| 2026-03-29 | Chat officially deprecated, full menu-based UI live |

---

## Legacy Code Reference

Original chat system code exists but is not in use:
- `src/lib/ai-service.ts` - AI prompt logic (unused)
- `src/components/game/ChatView.tsx` - Legacy chat component (unused)
- `conversationHistory` in gameState (still stored for analytics, no longer UI-driven)

---

## Related Documents

- [[03-Interface-Architecture]] - Current design (ALWAYS USE THIS)

---

*"From chat to tap. From conversation to action."*