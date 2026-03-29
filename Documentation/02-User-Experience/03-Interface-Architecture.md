# Interface Architecture

---
tags: #ux #interface #dashboard #navigation #mobile-first
status: updated
priority: critical
phase: mvp
last_updated: 2026-03-29
---

> [!important] Core Philosophy
> ** menus and action buttons are the controller. Touch/hit IS the interface. Mobile-first design with quick actions, not chat.**

---

## Overview

The FalaMestre interface has evolved from a conversational AI-first approach to a **menu-driven, dashboard-based mobile UI**. This pivot removes the chat interface and replaces it with:

- **Bottom Navigation** - Primary navigation cluster
- **Quick Action Bar** - Contextual actions per screen  
- **Floating Widgets** - Dicas and Daily Rewards
- **Full Pages** - Apostas (Predictions) and Investir (Investments)
- **Modal Dialogs** - Context-specific interactions

---

## Navigation Structure

### Bottom Navigation Clusters

```
┌─────────────────────────────────────────────────────────────┐
│                    [Header / Top Bar]                       │
├─────────────────────────────────────────────────────────────┤
│                    [Main Content Area]                      │
│                    (Dashboard, Squad, etc)                 │
├─────────────────────────────────────────────────────────────┤
│  JOGAR    │     TIME Cluster     │    FINANCE Cluster         │
│           │ Elenco│Tabela│Academy│Apostas │ Std│Staff│Fac│Trans│Investir│
└─────────────────────────────────────────────────────────────┘
```

### TIME Cluster (4 items)
- **Elenco** - Squad management
- **Tabela** - League standings
- **Academia** - Youth academy
- **Apostas** - Predictions/Betting hub

### FINANCE Cluster (5 items)
- **Estádio** - Stadium management
- **Staff** - Staff hiring
- **Instalações** - Facilities upgrades
- **Transferências** - Transfer market
- **Investir** - Investment hub

---

## Component Hierarchy

### Header
- Team name and logo
- Balance display (R$)
- Notifications bell
- Settings gear

### Main Content Area
Routes based on bottom nav selection:
- `/` - Dashboard
- `/squad` - Squad management
- `/match` - Match view
- `/standings` - League table
- `/stadium` - Stadium upgrades
- `/facilities` - Facility management
- `/youth` - Youth academy
- `/staff` - Staff management
- `/transfers` - Transfer market
- `/apostas` - **NEW** Predictions/Betting page
- `/investir` - **NEW** Investments page

### Floating Widgets (Below header, above content)
- **Dicas** - AI insights (collapsible)
- **Recompensa Diária** - Daily reward claim (collapsible)

### Quick Action Bar (Context-sensitive)
Positions vary by view but typically show:
- JOGAR (primary CTA)
- Chat (legacy - redirect to dashboard)
- Mercado
- Táticas

---

## Mobile-First Design Principles

### Touch Targets
- Minimum 44x44px touch targets
- Bottom nav buttons: 48px height
- All interactive elements have hover states (desktop) and active states (mobile)

### Layout Rules
- Single column content on mobile
- Max width: 480px centered
- Horizontal scrolling for overflow content only when necessary
- All action buttons fixed to bottom or top for thumb reachability

### Visual Design
- Dark mode primary (#012169 background)
- Accent color: Yellow (#FEDD00)
- Success: Green (#009739)
- Text: White primary, White/70 secondary, White/40 muted
- Borders: White/10 to White/30 based on importance

### Responsive Breakpoints
- Mobile: < 480px (primary target)
- Tablet: 481-768px 
- Desktop: > 768px (max-width 1024px)

---

## View Patterns

### Dashboard View
```
┌──────────────────────────────────┐
│ [Header: Team | Balance | ⚙️]   │
├──────────────────────────────────┤
│ [Floating Widgets: Dicas/Recomp]│
├──────────────────────────────────┤
│ [League Position Card]            │
│ [Form/History Cards]           │
│ [Quick Stats]                  │
│ [Next Match Preview]           │
│ [Squad Health]                │
│ [Top Players]                 │
├──────────────────────────────────┤
│ [Bottom Nav]                  │
└──────────────────────────────────┘
```

### Apostas View (Predictions/Betting)
```
┌──────────────────────────────────┐
│ [Header: Apostas | Balance]       │
├──────────────────────────────────┤
│ [Current Match Card]            │
│ [Bet Amount Slider]            │
│ [Available Markets Grid]        │
│ ┌─────────┬─────────┬─────────┐ │
│ │ Result- │ Total-  │ Ambos-  │ │  (rotating types)
│ │   ado  │   Gols  │ Marcam  │ │
│ └─────────┴─────────┴─────────┘ │
│ [Bet Slip (sticky bottom)]     │
├──────────────────────────────────┤
│ [Bottom Nav]                  │
└──────────────────────────────────┘
```

### Investir View (Investments)
```
┌──────────────────────────────────┐
│ [Header: Investir | Balance]      │
├──────────────────────────────────┤
│ [Active Investments List]       │
├──────────────────────────────────┤
│ [Investment Options Grid]        │
│ ┌─────────┬─────────┬─────────┐ │
│ │ Clube   │Marketing│Social  │ │  (7 types)
│ │ Torced. │ Digital │ Media  │ │
│ └─────────┴─────────┴─────────┘ │
│ ┌─────────┬─────────┬─────────┐ │
│ │ Academia│ Staff  │ Infra  │ │
│ └─────────┴─────────┴─────────┘ │
├──────────────────────────────────┤
│ [Bottom Nav]                  │
└──────────────────────────────────┘
```

---

## Action Button Patterns

### Primary Actions (Yellow Background)
Used for main game loop actions:
- "JOGAR" - Start match
- "APOSTAR" - Confirm bet
- "Investir" - Confirm investment

### Secondary Actions (Green Background)
Used for confirmations:
- "Confirmar" 
- "Sim"
- "Continuar"

### Tertiary Actions (Transparent/Outline)
Used for navigation:
- "Ver Detalhes"
- "Ver Todos"
- "Cancelar"

---

## Interaction Patterns

### Modal Dialogs
Used for:
- Match results
- Player details
- Formation selection
- Training confirmation
- Bet placement confirmation
- Investment confirmation

### Toast Notifications
Used for:
- Success feedback (green)
- Error feedback (red)  
- Info notices (blue)

### Sliders and Inputs
- Match simulation speed (VR mode)
- Bet amount on Apostas
- Player training focus selection

---

## Related Documents

- [[04-Soft-Training-Progression]] - Integration with predictions and investments
- [[02-Onboarding-Flow]] - New user experience
- [[01-Fan-Token-Integration]] - How soft training maps to real features

---

*"Menu-based, touch-first, mobile-native. The interface serves the game, not the other way around.*