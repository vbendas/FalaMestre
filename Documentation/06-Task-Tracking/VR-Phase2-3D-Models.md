# VR Phase 2: 3D Character Models Specification

---
tags: #vr #phase-2 #3d-models #future
status: planning
priority: low
last_updated: 2026-02-26
---

## Overview

This document outlines the requirements for Phase 2 VR enhancements - specifically the 3D character models needed for the angled (45°) VR view.

---

## Current State (Phase 1 MVP)

- **View**: Pure top-down (bird's eye)
- **Characters**: 2D sprites rendered as billboards
- **Sprites used**: South-facing PixelLab animations

---

## Phase 2 Goal: 45° Angled View

### Why 45°?

| Aspect | Top-Down (MVP) | Angled 45° (Phase 2) |
|--------|----------------|---------------------|
| Immersion | Good | Excellent |
| Character visibility | Flat sprites | 3D models |
| Asset requirement | Existing sprites | New 3D models |
| Complexity | Low | Medium |

---

## 3D Model Requirements

### Model Specifications

| Attribute | Value |
|-----------|-------|
| **Format** | GLB/GLTF |
| **Polygon Count** | 500-2000 tris per character |
| **Texture Size** | 512x512 max |
| **Animations** | Idle, Run, Celebrate, Defend |
| **Style** | Low-poly stylized (match pixel art) |

### Camera Position

```
Position: (0, 20, 20)
Rotation: (-45°, 0, 0)
Field of View: 75°
```

### Character Models Needed

| Character | Count | Animations |
|-----------|-------|------------|
| Field Player | 2 (home/away) | 4 each |
| Goalkeeper | 2 | 4 each |
| Coach | 2 | 2 each |
| Referee | 1 | 2 each |

### Total: 7 unique models, ~20 animations

---

## PixelLab.ai Generation Strategy

### Prompt Template for Isometric View

```
3D isometric football player, low poly style, [TEAM_COLOR] jersey, 
black shorts, white cleats, determined face, standing pose, 
clean geometry, game-ready, solid color textures, no gradients,
view from 45-degree angle, white background, Blender render style
```

### Animation Generation

Use the existing South-facing animations as reference:
- Idle → Idle (isometric)
- Running → Running (isometric)
- Celebrate → Goal celebration
- Defend → Defensive stance

---

## Implementation Plan

### Task Breakdown

| Task | Description | Hours |
|------|-------------|-------|
| VR-F2-1 | Generate 3D model prompts | 2h |
| VR-F2-2 | Create base player model | 4h |
| VR-F2-3 | Create goalkeeper model | 2h |
| VR-F2-4 | Create coach model | 2h |
| VR-F2-5 | Add animations | 8h |
| VR-F2-6 | Implement angled camera | 4h |
| VR-F2-7 | Integrate with VRMatchView | 6h |
| VR-F2-8 | Testing & polish | 4h |

**Total: 32 hours**

---

## Technical Implementation

### Integration with A-Frame

```javascript
// Replace billboard sprites with 3D models
<a-entity
  id="player-home-1"
  gltf-model="#player-home-model"
  position={`${x} 0 ${z}`}
  animation="property: rotation; to: 0 0 0; dur: 300"
></a-entity>
```

### Performance Considerations

| Optimization | Technique |
|--------------|-----------|
| LOD | Reduce poly count at distance |
| Instancing | Reuse geometries |
| Texture Atlas | Single texture for all players |
| Animation Blending | Smooth transitions |

---

## Related Documents

- [[03-Match-Simulation-VR]] - VR design document
- [[TEAM_ASSET_GENERATION]] - Current PixelLab assets

---

*"Phase 2 will transform VR from novelty to immersive experience."*
