# Visual Design

---
tags: #ux #design #art #rive #animation #style
status: complete
priority: high
phase: mvp
last_updated: 2026-01-18
---

## Overview

Fala Mestre! uses a "Premium Flat Vector" visual style that balances professionalism with playfulness. The design is optimized for mobile-first experiences and integrates seamlessly with Rive animations.

> [!note] Design Philosophy
> "Look like a sports app, feel like a game, work like a conversation."

---

## Art Direction

### Style Reference

Our visual style draws inspiration from:

| Reference | What We Take |
|-----------|--------------|
| **Duolingo** | Friendly characters, clean UI |
| **Head Soccer** | Cute player representations |
| **Kurzgesagt** | Sophisticated flat illustrations |
| **Socios.com** | Professional sports branding |

### Core Principles

1. **Clean & Readable**: Information-first design
2. **Mobile-Native**: Thumb-friendly, one-handed use
3. **Brazilian Flair**: Warm colors, passionate energy
4. **Animated Life**: Subtle motion brings UI alive
5. **Scalable Assets**: Vector-first for all screen sizes

---

## Color System

### Primary Palette

| Color | Hex | Usage |
|-------|-----|-------|
| **Mengao Red** | `#E31937` | Primary actions, highlights |
| **Pitch Green** | `#2ECC71` | Success states, positive feedback |
| **Deep Black** | `#1A1A2E` | Text, dark backgrounds |
| **Clean White** | `#FFFFFF` | Cards, light backgrounds |
| **Gold Accent** | `#F1C40F` | Rewards, achievements, premium |

### Secondary Palette

| Color | Hex | Usage |
|-------|-----|-------|
| **Sky Blue** | `#3498DB` | Links, info states |
| **Warning Orange** | `#E67E22` | Caution, warnings |
| **Error Red** | `#C0392B` | Errors, deletions |
| **Muted Gray** | `#95A5A6` | Disabled, secondary text |
| **Background Gray** | `#F5F6FA` | App background |

### Team Colors

Dynamic theming based on user's selected team:

```typescript
const teamColors = {
  flamengo: { primary: '#E31937', secondary: '#000000' },
  corinthians: { primary: '#000000', secondary: '#FFFFFF' },
  palmeiras: { primary: '#006437', secondary: '#FFFFFF' },
  saopaulo: { primary: '#FF0000', secondary: '#FFFFFF' },
  santos: { primary: '#000000', secondary: '#FFFFFF' },
  cruzeiro: { primary: '#003DA5', secondary: '#FFFFFF' },
  // ... more teams
};
```

### Color Usage Guidelines

```
+------------------------------------------+
|  BACKGROUND: #F5F6FA                     |
|  +------------------------------------+  |
|  |  CARD: #FFFFFF                     |  |
|  |  +------------------------------+  |  |
|  |  |  PRIMARY ACTION: #E31937     |  |  |
|  |  +------------------------------+  |  |
|  |                                    |  |
|  |  TEXT PRIMARY: #1A1A2E             |  |
|  |  TEXT SECONDARY: #95A5A6           |  |
|  +------------------------------------+  |
+------------------------------------------+
```

---

## Typography

### Font Stack

```css
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-display: 'Poppins', 'Inter', sans-serif;
--font-mono: 'JetBrains Mono', monospace;
```

### Type Scale

| Name | Size | Weight | Usage |
|------|------|--------|-------|
| **Display** | 32px | 700 | Headers, celebrations |
| **Title** | 24px | 600 | Section titles |
| **Subtitle** | 18px | 600 | Card titles |
| **Body** | 16px | 400 | Main content |
| **Caption** | 14px | 400 | Secondary info |
| **Small** | 12px | 400 | Timestamps, labels |

### Type Examples

```
VITORIA! FLAMENGO 3-1          <- Display (32px, Bold)
Resultado da Partida           <- Title (24px, SemiBold)
Gabigol - Atacante             <- Subtitle (18px, SemiBold)
O artilheiro marcou duas vezes <- Body (16px, Regular)
14:32 - Hoje                   <- Caption (14px, Regular)
+100 pts                       <- Small (12px, Regular)
```

---

## Spacing System

### Base Unit: 4px

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight spacing |
| `space-2` | 8px | Element gaps |
| `space-3` | 12px | Card padding |
| `space-4` | 16px | Section gaps |
| `space-5` | 24px | Large gaps |
| `space-6` | 32px | Section separators |
| `space-8` | 48px | Major sections |

### Layout Grid

```
+------------------------------------------+
|  <- 16px ->  CONTENT  <- 16px ->         |
|              (max 600px)                  |
+------------------------------------------+

Mobile: 16px margins, fluid content
Tablet: 24px margins, max-width 600px
Desktop: Centered, max-width 480px (phone preview)
```

---

## Components

### Buttons

**Primary Button**
```
+----------------------------------+
|         JOGAR PARTIDA            |  <- #E31937 bg, white text
+----------------------------------+     height: 48px, radius: 12px
```

**Secondary Button**
```
+----------------------------------+
|         VER ELENCO               |  <- transparent bg, #E31937 border
+----------------------------------+     height: 48px, radius: 12px
```

**Quick Action Button**
```
+------------+
|   Jogar    |  <- #F5F6FA bg, #1A1A2E text
+------------+     height: 36px, radius: 8px
```

### Cards

**Standard Card**
```
+------------------------------------------+
|  padding: 16px                           |
|  background: #FFFFFF                     |
|  border-radius: 16px                     |
|  shadow: 0 2px 8px rgba(0,0,0,0.08)     |
+------------------------------------------+
```

**Highlighted Card (Match Result)**
```
+------------------------------------------+
|  border-left: 4px solid #E31937          |
|  background: linear-gradient(            |
|    to right, #FFF5F5, #FFFFFF)          |
+------------------------------------------+
```

### Input Fields

**Chat Input**
```
+------------------------------------------+
|  [Message icon]  Digite uma mensagem...  |
|                                   [Send] |
+------------------------------------------+
height: 56px
background: #FFFFFF
border: 1px solid #E5E5E5
border-radius: 28px (pill shape)
```

### Message Bubbles

**AI Message (Left)**
```
+------------------------+
|  Message content       |  <- #FFFFFF bg
|                  14:32 |     border-radius: 16px 16px 16px 4px
+------------------------+
```

**User Message (Right)**
```
        +------------------------+
        |  Message content       |  <- #E31937 bg, white text
        |                  14:32 |     border-radius: 16px 16px 4px 16px
        +------------------------+
```

---

## Iconography

### Icon Style

- **Style**: Outlined with 2px stroke
- **Size**: 24x24px base (scales to 20, 28, 32)
- **Corner**: Rounded caps and joins
- **Color**: Inherits from context

### Core Icons

| Icon | Usage | Unicode/Name |
|------|-------|--------------|
| Football | Match, play | `soccer-ball` |
| Users | Squad, team | `users` |
| ShoppingCart | Transfer market | `shopping-bag` |
| TrendingUp | Training, progress | `trending-up` |
| Trophy | Achievements, wins | `trophy` |
| Coins | Points, money | `coins` |
| MessageCircle | Chat, conversation | `message-circle` |
| Settings | Configuration | `settings` |
| HelpCircle | Help, info | `help-circle` |
| ChevronRight | Navigate | `chevron-right` |

### Emoji Usage

Strategic emoji use enhances emotional impact:

| Context | Emoji |
|---------|-------|
| Goal scored | `goal` |
| Victory | `trophy`, `fire` |
| Defeat | (none - respectful) |
| Points earned | `star`, `sparkles` |
| Warning | `warning` |
| Injury | `ambulance` |
| Transfer | `handshake` |
| Celebration | `party`, `confetti` |

---

## Rive Animations

### Animation Strategy

Rive provides lightweight, interactive vector animations:

| Component | Animation Type | Trigger |
|-----------|---------------|---------|
| **Formation Card** | State Machine | Data changes |
| **Goal Celebration** | One-shot | Goal event |
| **Loading Spinner** | Loop | Waiting states |
| **Points Counter** | Value change | Points earned |
| **Player Cards** | Hover/tap | User interaction |

### Formation Card Animation

```typescript
// Rive State Machine Inputs
interface FormationRiveInputs {
  formation: '4-3-3' | '4-4-2' | '3-5-2' | '5-3-2' | '4-2-3-1';
  playerMoods: number[]; // 0-100 for each position
  highlighted: number; // Player index to highlight
  isTransitioning: boolean;
}
```

**Behaviors:**
- Players "breathe" with subtle idle animation
- Formation changes animate players sliding to new positions
- Injured players show limp animation
- Highlighted player pulses gently
- Tap on player triggers detail card

### Goal Celebration Animation

```
Timeline:
0ms    - Ball enters frame
200ms  - Ball hits net (ripple effect)
400ms  - Explosion of particles
600ms  - Scorer name appears
1000ms - Animation complete
```

### Match Event Visuals

| Event | Animation |
|-------|-----------|
| **Goal** | Net ripple + confetti burst |
| **Yellow Card** | Card flip + flash |
| **Red Card** | Dramatic card reveal |
| **Injury** | Medical icon + concern |
| **Substitution** | Player swap transition |
| **VAR Check** | Suspense animation + reveal |

### Interactive Decision Points

During matches, Rive-powered decision moments:

```
+------------------------------------------+
|  [RIVE CANVAS]                           |
|                                          |
|  82' - Contra-ataque!                    |
|                                          |
|     [SHOOT TARGET]     [PASS ARROW]      |
|                                          |
|  Gabigol tem 3 segundos para decidir...  |
|                                          |
+------------------------------------------+
```

---

## Character Design

### Player Characters

**Style Guide:**
- Cute, stylized proportions (large head, small body)
- Distinctive silhouettes
- Team kit colors
- Expressive faces
- Consistent 3-head-tall proportions

**Components (for Rive rigging):**
- Head (separate)
- Torso (with kit)
- Arms (2 pieces each)
- Legs (2 pieces each)
- Ball (optional prop)

### Manager Avatar

The user's representation:

```
+----------+
|   (^_^)  |  <- Customizable face
|  /|[]|\  |  <- Suit/casual options
|   /  \   |  <- Simple lower body
+----------+
```

**Customization Options (Future):**
- Face style (5 options)
- Hair style (10 options)
- Skin tone (6 options)
- Outfit (suit, casual, team kit)

---

## Dark Mode

### Dark Palette

| Element | Light | Dark |
|---------|-------|------|
| Background | `#F5F6FA` | `#1A1A2E` |
| Card | `#FFFFFF` | `#252542` |
| Text Primary | `#1A1A2E` | `#FFFFFF` |
| Text Secondary | `#95A5A6` | `#7F8C9A` |
| Primary Action | `#E31937` | `#FF4757` |
| Borders | `#E5E5E5` | `#3D3D5C` |

### Implementation

```css
:root {
  --bg-primary: #F5F6FA;
  --bg-card: #FFFFFF;
  --text-primary: #1A1A2E;
}

[data-theme="dark"] {
  --bg-primary: #1A1A2E;
  --bg-card: #252542;
  --text-primary: #FFFFFF;
}
```

---

## Responsive Design

### Breakpoints

| Name | Width | Target |
|------|-------|--------|
| `mobile` | 0-479px | Small phones |
| `mobile-lg` | 480-639px | Large phones |
| `tablet` | 640-1023px | Tablets |
| `desktop` | 1024px+ | Desktop (preview mode) |

### Mobile-First Approach

```css
/* Base styles (mobile) */
.card { padding: 12px; }

/* Tablet and up */
@media (min-width: 640px) {
  .card { padding: 16px; }
}

/* Desktop preview */
@media (min-width: 1024px) {
  .app-container {
    max-width: 480px;
    margin: 0 auto;
    border-radius: 24px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  }
}
```

---

## Asset Requirements

### Required Assets (MVP)

| Asset | Format | Quantity | Status |
|-------|--------|----------|--------|
| Team logos | SVG | 20 | Pending |
| Player base character | SVG (rigged) | 1 | Pending |
| Head variations | SVG | 10 | Pending |
| Formation backgrounds | SVG | 5 | Pending |
| Stadium illustration | PNG | 1 | Pending |
| UI icons | SVG | 20 | Pending |
| Goal celebration | Rive | 1 | Pending |
| Card animations | Rive | 3 | Pending |

### Asset Specifications

**Team Logos:**
- Size: 128x128px
- Format: SVG (vector)
- Background: Transparent
- Style: Official or simplified

**Player Characters:**
- Size: 256px tall
- Format: SVG with layers
- Layers: Head, Torso, L-Arm, R-Arm, L-Leg, R-Leg
- Style: Flat vector, thick outlines

**Stadium Background:**
- Size: 1080x1920px (mobile portrait)
- Format: PNG or SVG
- Style: Atmospheric, blurred crowd

---

## Brand Applications

### App Icon

```
+----------------+
|                |
|     [Ball]     |  <- Football with chat bubble
|    "FM"        |  <- Stylized letters
|                |
+----------------+

Size: 1024x1024px (iOS) / 512x512px (Android)
Corners: Rounded by OS
Colors: Team primary or Mengao Red default
```

### Social Share Cards

```
+------------------------------------------+
|  FALA MESTRE!                            |
|                                          |
|  FLAMENGO 3-1 PALMEIRAS                  |
|                                          |
|  Gabigol (2)      Endrick               |
|  Arrascaeta                              |
|                                          |
|  [Manager Avatar] @username              |
|  falamestre.ai                           |
+------------------------------------------+
Size: 1200x630px (OG image)
```

---

## Related Documents

- [[03-Conversational-Interface]] - UI patterns
- [[03-Asset-Requirements]] - Full asset list
- [[00-Core-Concept]] - Design philosophy
- [[02-Onboarding-Flow]] - Visual flow

---

*"Design is not just what it looks like. Design is how it works." - Steve Jobs*
