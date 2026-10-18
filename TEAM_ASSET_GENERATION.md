# 🎮 GENERIC ASSET GENERATION DOCUMENT

**Version:** 2.0  
**Game:** Fala Mestre!  
**Team Type:** User-Customizable  
**Total Assets:** 3 characters, 42 animations (126 total files)  
**Directions Used:** South, East, West  
**Tool:** Pixellab.ai (Free tier, 48px max)

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Color Customization System](#color-customization-system)
3. [Character 1: Base Player](#character-1-base-player)
4. [Character 2: Goalkeeper](#character-2-goalkeeper)
5. [Character 3: Coach](#character-3-coach)
6. [Direction Logic Summary](#direction-logic-summary)
7. [Generation Checklist](#generation-checklist)
8. [Total Summary](#total-summary)

---

## Overview

This document provides a template for generating pixel art football assets that work with **user-customizable team colors**. The game allows players to create their own team with custom primary and secondary colors, so all assets must support color variations.

### Key Design Principles

1. **Color-Agnostic**: Use placeholder color variables in prompts
2. **Consistent Style**: 48px chibi style, 16-bit retro aesthetic
3. **Directional**: South (front), East (right), West (left)
4. **Animation-Ready**: 42 total animations per character set

### Team Color Examples

The game ships with 6 fictional PvE teams (defined in `app/src/lib/team-data.ts`, badges in `app/public/teams/*.svg`) and supports user-created teams. No real club names, crests or colour schemes are used:

| Team Name | Badge | Primary | Secondary | Jersey Pattern |
|-----------|-------|---------|-----------|----------------|
| Leões do Norte | `leoes.svg` (LEO) | Gold | Green | Vertical stripes |
| Falcões de Aço | `falcoes.svg` (FAL) | Silver | Black | Horizontal stripes |
| Trovão FC | `trovao.svg` (TRO) | Purple | White | Solid + accents |
| Maré Alta | `mare.svg` (MAR) | Blue | Cyan | Waves pattern |
| Serra Brava | `serra.svg` (SER) | Red | Orange | Vertical stripes |
| Estrela do Sul | `estrela.svg` (EST) | White | Gold | Solid + accents |

---

## Color Customization System

### Prompt Template Variables

Replace `[PRIMARY]` and `[SECONDARY]` with actual colors:

| Variable | Description | Examples |
|----------|-------------|----------|
| `[PRIMARY]` | Main jersey color | red, blue, green, purple, gold |
| `[SECONDARY]` | Accent/collar/trim color | black, white, silver, gold |
| `[PATTERN]` | Jersey pattern | solid, vertical stripes, horizontal stripes |
| `[SHORTS]` | Shorts color | Usually black or white |

### Example Prompts

**Gold/Green Team (Leões do Norte):**
```
Chibi Brazilian football player, 48px, gold and green vertical striped jersey, 
black shorts, white cleats, determined smiling face, brown skin, short black hair, 
standing pose, clean pixel outlines, vibrant colors, 16-bit retro game style
```

**Purple/White Team (Trovão FC):**
```
Chibi Brazilian football player, 48px, purple jersey with white accents, 
white shorts, white cleats, determined smiling face, brown skin, short black hair, 
standing pose, clean pixel outlines, vibrant colors, 16-bit retro game style
```

---

## Character 1: Base Player

### 🎨 Character Generation (Base)

| Setting | Value |
|---------|-------|
| **Prompt Template** | `Chibi Brazilian football player, 48px, [PRIMARY] and [SECONDARY] [PATTERN] jersey, [SHORTS] shorts, white cleats, determined smiling face, brown skin, short black hair, standing pose, clean pixel outlines, vibrant colors, 16-bit retro game style` |
| **Size** | 48px |
| **Camera View** | Front |
| **Direction** | **South** (facing camera) |
| **Head Size** | 1.2x |
| **Arms Length** | 1.0x |
| **Legs Length** | 1.0x |
| **Shoulder Width** | 1.0x |
| **Hip Width** | 1.0x |

---

### 🎬 Animations to Generate (26 total)

#### Movement Animations

| # | Animation | Direction | Frames | Football Purpose |
|---|-----------|-----------|--------|-----------------|
| 1 | **Idle (Breathing Idle)** | South | 8 frames | Chat scenes, standing still |
| 2 | **Running (6 frames)** | South | 6 frames | Standing run (chat/celebration) |
| 3 | **Running (6 frames)** | East | 6 frames | Attacking right (toward opponent goal) |
| 4 | **Running (6 frames)** | West | 6 frames | Defending left (facing own goal) |
| 5 | **Walking (4 frames)** | South | 4 frames | Pacing, warm-up (chat) |
| 6 | **Walking (4 frames)** | East | 4 frames | Walking toward attack |
| 7 | **Walking (4 frames)** | West | 4 frames | Walking back to defend |
| 8 | **Jumping (Jumping Alt1)** | South | - | Header celebration, standing |
| 9 | **Jumping (Jumping Alt1)** | East | - | Jumping header toward attack |
| 10 | **Crouching** | South | - | Defensive stance, chat |
| 11 | **Crouching** | East | - | Crouched ready to attack |
| 12 | **Slide** | East | - | Slide tackle (attacking) |
| 13 | **Slide** | West | - | Slide tackle (defending) |

---

#### Football-Specific Animations (Combat → Football)

| # | Animation | Direction | Football Interpretation | Purpose |
|---|-----------|-----------|----------------------|---------|
| 14 | **Flying kick** | South | Volley kick / Bicycle kick | Spectacular goal (celebration) |
| 15 | **Flying kick** | East | Volley kick / Bicycle kick | Scoring toward goal |
| 16 | **High kick** | South | High clearance / Header | Defending celebration |
| 17 | **High kick** | East | High clearance / Header | Defending crosses (attack) |
| 18 | **Leg sweep** | East | Slide tackle | Winning ball back (attack) |
| 19 | **Leg sweep** | West | Slide tackle | Winning ball back (defend) |
| 20 | **Roundhouse kick** | South | Powerful shot | Scoring celebration |
| 21 | **Roundhouse kick** | East | Powerful shot | Scoring from distance |
| 22 | **Cross punch** | South | Long pass / Cross | Pass celebration |
| 23 | **Cross punch** | East | Long pass / Cross | Passing to teammate |
| 24 | **Falling back death** | South | Falling down / Tackle | Collision (celebration) |
| 25 | **Falling back death** | East | Falling down / Tackle | Collision during attack |
| 26 | **Falling back death** | West | Falling down / Tackle | Collision during defend |
| 27 | **Lead jab (Punching)** | South | Quick pass | Short pass (chat/celebration) |
| 28 | **Surprise uppercut (Punching)** | South | Chip shot / Lob | Scoring over keeper |
| 29 | **Taking punch** | South | Getting hit by ball | Collision reaction |
| 30 | **Taking punch** | East | Getting hit by ball | Collision during play |

---

### 📊 Base Player Summary

| Direction | Animation Count | Total Files |
|-----------|-----------------|-------------|
| **South (Front)** | 12 animations | 12 files |
| **East (Right)** | 10 animations | 10 files |
| **West (Left)** | 4 animations | 4 files |
| **TOTAL** | **26 animations** | **26 files** |

---

## Character 2: Goalkeeper

### 🎨 Character Generation (Goalkeeper)

| Setting | Value |
|---------|-------|
| **Prompt Template** | `Chibi Brazilian goalkeeper, 48px, long sleeve [PRIMARY] jersey with [SECONDARY] accents, [SHORTS] shorts, white cleats, goalkeeper gloves, determined serious face, brown skin, short black hair, standing pose in goal, clean pixel outlines, vibrant colors, 16-bit retro game style` |
| **Size** | 48px |
| **Camera View** | Front |
| **Direction** | **South** (facing camera) |
| **Head Size** | 1.2x |
| **Arms Length** | 1.0x |
| **Legs Length** | 1.0x |
| **Shoulder Width** | 1.0x |
| **Hip Width** | 1.0x |
| **Special** | Goalkeeper gloves, long sleeves |

---

### 🎬 Animations to Generate (8 total)

| # | Animation | Direction | Football Interpretation | Purpose |
|---|-----------|-----------|----------------------|---------|
| 1 | **Idle (Breathing Idle)** | South | Ready stance | Goalkeeper waiting |
| 2 | **Idle (Breathing Idle)** | East | Side profile ready | Defending goal |
| 3 | **Crouching** | South | Low ready stance | Preparing for save |
| 4 | **Crouching** | East | Diving left | Save animation |
| 5 | **Jumping** | East | Diving save | Spectacular save |
| 6 | **Taking punch** | South | Shot hitting keeper | Save reaction |
| 7 | **Running** | East | Running out | Sweeping/clearing |
| 8 | **Walking** | South | Walking in goal | Distribution |

---

### 📊 Goalkeeper Summary

| Direction | Animation Count | Total Files |
|-----------|-----------------|-------------|
| **South (Front)** | 3 animations | 3 files |
| **East (Right)** | 5 animations | 5 files |
| **West (Left)** | 0 animations | 0 files |
| **TOTAL** | **8 animations** | **8 files** |

---

## Character 3: Coach

### 🎨 Character Generation (Coach)

| Setting | Value |
|---------|-------|
| **Prompt Template** | `Chibi Brazilian football coach, 48px, [PRIMARY] polo shirt with [SECONDARY] trim, [SHORTS] shorts, white shoes, headset microphone, enthusiastic gesturing pose, brown skin, short black hair, clean pixel outlines, vibrant colors, 16-bit retro game style` |
| **Size** | 48px |
| **Camera View** | Front |
| **Direction** | **South** (facing camera) |
| **Head Size** | 1.2x |
| **Arms Length** | 1.0x |
| **Legs Length** | 1.0x |
| **Special** | Headset/microphone, polo shirt |

---

### 🎬 Animations to Generate (8 total)

| # | Animation | Direction | Football Interpretation | Purpose |
|---|-----------|-----------|----------------------|---------|
| 1 | **Idle (Breathing Idle)** | South | Standing on sideline | Chat interface |
| 2 | **Walking** | South | Pacing sideline | Tactical instruction |
| 3 | **Walking** | East | Walking along bench | Substitution |
| 4 | **Cross punch** | South | Giving instructions | Celebrating goal |
| 5 | **Cross punch** | East | Pointing to field | Directing players |
| 6 | **Surprise uppercut** | South | Celebrating wildly | Big win celebration |
| 7 | **Taking punch** | South | Disappointed | Conceded goal |
| 8 | **High kick** | South | Jumping celebration | Trophy celebration |

---

### 📊 Coach Summary

| Direction | Animation Count | Total Files |
|-----------|-----------------|-------------|
| **South (Front)** | 5 animations | 5 files |
| **East (Right)** | 2 animations | 2 files |
| **West (Left)** | 1 animation | 1 file |
| **TOTAL** | **8 animations** | **8 files** |

---

## Direction Logic Summary

### Why These Directions?

| Direction | Camera View | Purpose |
|-----------|-------------|---------|
| **South** | Front-facing | Chat interface, celebrations, close-ups |
| **East** | Right profile | Match action (attacking right = toward opponent goal) |
| **West** | Left profile | Match action (defending left = toward own goal) |

### Direction Logic for PvE Teams

All 6 fictional teams use the same directional logic:
- When **attacking right** (East) = moving toward opponent's goal
- When **attacking left** (West) = moving toward opponent's goal (mirrored animation)

---

## Generation Checklist

### ✅ MVP Assets (Priority: Critical)

Generate for these **3 teams** first:

- [ ] **Team 1: Leões do Norte** (Gold/Green, vertical stripes)
  - [ ] Character 1: Base Player (26 animations)
  - [ ] Character 2: Goalkeeper (8 animations)
  - [ ] Character 3: Coach (8 animations)
  - **Total: 42 animations, 42 files**

- [ ] **Team 2: Falcões de Aço** (Silver/Black, horizontal stripes)
  - [ ] Character 1: Base Player (26 animations)
  - [ ] Character 2: Goalkeeper (8 animations)
  - [ ] Character 3: Coach (8 animations)
  - **Total: 42 animations, 42 files**

- [ ] **Team 3: Trovão FC** (Purple/White, solid)
  - [ ] Character 1: Base Player (26 animations)
  - [ ] Character 2: Goalkeeper (8 animations)
  - [ ] Character 3: Coach (8 animations)
  - **Total: 42 animations, 42 files**

### 🎯 Future Assets (Priority: Medium)

After MVP launch, generate for remaining PvE teams:

- [ ] **Team 4: Maré Alta** (Blue/Cyan, waves)
- [ ] **Team 5: Serra Brava** (Red/Orange, vertical stripes)
- [ ] **Team 6: Estrela do Sul** (White/Gold, solid)

**MVP Total: 126 animations, 126 files**

**Full Release Total: 252 animations, 252 files**

---

## Total Summary

### Character Breakdown

| Character | Animations per Team | MVP Teams (3) | Full Release (6) |
|-----------|-------------------|---------------|------------------|
| Base Player | 26 | 78 files | 156 files |
| Goalkeeper | 8 | 24 files | 48 files |
| Coach | 8 | 42 files | 84 files |
| **TOTAL** | **42** | **126 files** | **252 files** |

### Direction Distribution (Per Team)

| Direction | Base Player | Goalkeeper | Coach | Total per Team |
|-----------|-------------|------------|-------|----------------|
| South | 12 | 3 | 5 | 20 |
| East | 10 | 5 | 2 | 17 |
| West | 4 | 0 | 1 | 5 |
| **TOTAL** | **26** | **8** | **8** | **42** |

---

## Tool Instructions

### Pixellab.ai Settings

1. **Upload base character** (South direction)
2. **Apply color palette**: Match [PRIMARY] and [SECONDARY] colors
3. **Generate animations**: Select animation type, set direction
4. **Export**: PNG format, transparent background
5. **Post-process**: Resize to 48px if needed

### File Naming Convention

```
[team_id]_[character_type]_[animation_name]_[direction].png

Examples:
- leoes_baseplayer_idle_south.png
- leoes_goalkeeper_diving_east.png
- leoes_coach_celebration_south.png
```

---

## Related Documents

- [[19-IP-Protection-Team-Naming-Strategy]] - IP-safe team naming
- [[02-Player-System]] - Player attributes and ratings
- [[04-Visual-Design]] - Art direction and style guide
- [[ASSET_TRACKING]] - Asset generation status tracker

---

*"Color-customizable assets support infinite team variations while maintaining consistent style and quality."*