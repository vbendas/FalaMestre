# VR Match Experience

---
tags: #game-design #vr #match #immersive
status: planning
priority: medium
phase: enhancement
last_updated: 2026-02-26
---

## Overview

The VR Match Experience transforms match viewing into an immersive 3D experience using low-cost cardboard VR glasses. Users can watch their team compete in a top-down 3D soccer field with their PixelLab character sprites.

> [!note] MVP Scope
> Phase 1 implements top-down view only. Angled 45° view requires 3D character models (Phase 2).

---

## Target Hardware

| Item | Cost | Notes |
|------|------|-------|
| Cardboard VR Glasses | $1-3 | Shinecon Viar or similar |
| Smartphone | User's own | iOS/Android |
| Total User Cost | $1-3 | Extremely affordable |

---

## User Experience

### Entering VR Mode

1. User watches match in standard mode
2. During match, "VR Mode" button appears
3. User taps button
4. Instruction overlay shows how to insert phone into VR glasses
5. Stereoscopic 3D view activates

### VR View

- **Camera Position**: Top-down, ~15 meters above field
- **Field Orientation**: Home team attacks upward, away team attacks downward
- **Player Sprites**: PixelLab characters as billboards facing camera
- **Ball**: Animated sprite moving between players
- **Goals**: Flash effect + celebration animation

### Exiting VR

- Tap "Exit VR" button (always visible)
- Returns to standard match view

---

## Technical Implementation

### Framework

- **A-Frame**: WebVR framework for browser-based VR
- **React Integration**: Custom React components within A-Frame
- **Stereoscopic**: Built-in cardboard VR support

### Field Geometry

```
Field Dimensions (A-Frame units):
- Length: 105 units
- Width: 68 units
- Penalty Box: 16.5 x 40 units
- Center Circle: 9.15 unit radius
```

### Player Positioning

| Formation | Positions Mapped |
|-----------|-----------------|
| 4-3-3 | GK, 4 DEF, 3 MID, 3 FWD |
| 4-4-2 | GK, 4 DEF, 4 MID, 2 FWD |
| 3-5-2 | GK, 3 DEF, 5 MID, 2 FWD |
| 5-3-2 | GK, 5 DEF, 3 MID, 2 FWD |

### Sprite Rendering

- Use South-facing PixelLab idle animation as billboard
- Billboard component always faces camera
- Position at player's 3D coordinates on field
- Scale appropriately for visibility from top-down view

---

## Event Synchronization

| Match Event | VR Response |
|-------------|-------------|
| Goal (Home) | Ball to net, home players celebrate |
| Goal (Away) | Ball to net, away players celebrate |
| Half Time | Brief pause, "HT" indicator |
| Full Time | Final score overlay, "FT" indicator |
| Substitution | Old player fades, new player appears |

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Frame Rate | 60 fps |
| Draw Calls | < 50 |
| Texture Memory | < 20MB |
| Load Time | < 3 seconds |

---

## Future Enhancements (Phase 2+)

### Angled 45° View

Requires 3D character models (not 2D sprites):
- Generate in PixelLab with isometric/3/4 view
- Different from current front-facing sprites
- Models rotate to face ball position

### Social VR

- Watch matches with friends in virtual lounge
- Virtual stadium with crowd
- Voice chat integration

---

## Related Documents

- [[03-Match-Simulation]] - Core match engine
- [[FLAMENGO_ASSET_GENERATION]] - PixelLab character assets

---

*"Immersive experiences create lasting memories."*
