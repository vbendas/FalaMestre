# FalaMestre! — Shared Design System

> Paste this block at the top of every omma.build prompt.

```
== DESIGN SYSTEM (embed exactly) ==
FONT: Press Start 2P (Google Fonts) — pixel/retro monospace, use for ALL text. No other fonts.

COLORS:
- Background navy: #00381a
- Primary accent gold: #FFDF00 (text, borders, glow)
- Secondary accent green: #00A859 (positive, home team)
- Cyan labels: #55e0a0 (tertiary text, labels)
- Card/panel background: #004d23
- Pitch dark stripe: #006600
- Pitch light stripe: #008800
- Blue away: #3EA0D4
- Red danger: #FF3333
- Orange warnings: #FFA500
- Black outer cabinet: #000000
- Muted gold text: rgba(255,223,0,0.55)
- Frosted glass fill: rgba(0,18,8,0.72) with backdrop-filter: blur(14px)
- Frosted glass border: 1px solid rgba(255,223,0,0.30)

CRT EFFECTS (apply to entire screen, layered):
- Scanlines: repeating-linear-gradient horizontal, 2px transparent / 2px rgba(0,0,0,0.18), z-index 99
- Vignette: radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.65) 100%), z-index 98
- Phosphor border glow: inset 0 0 0 2px rgba(255,223,0,0.35), z-index 100
- Flicker: subtle opacity flicker every 6s
- Film grain: SVG feTurbulence noise filter at 4% opacity

COMPONENT PATTERNS:
- Buttons: gold bordered, dark navy fill, gold text; hover → gold fill + navy text
- Frosted glass cards: rgba(0,18,8,0.72), blur 14px, border 1px rgba(255,223,0,0.30), border-radius 7-10px
- Glow text: text-shadow: 0 0 10px #FFDF00, 0 0 22px rgba(255,215,0,0.5)
- Pixel icons: use emoji or custom pixel blocks only — no flat icon libraries
- Progress bars: Green (home/positive) or Blue (away/secondary), height 6px, border-radius 1px
- Section dividers: 1px solid rgba(255,223,0,0.2)

ORIENTATION: Landscape 844×390px. The game is designed to be played horizontally, like a handheld console or arcade cabinet.

LANGUAGE: Portuguese (pt-BR) for all UI labels.
== END DESIGN SYSTEM ==
```

---

## Attribute Mapping

Player stats in code vs. UI labels:

| Code | UI Label (pt-BR) | English | Category |
|------|-------------------|---------|----------|
| `pac` | Velocidade | Pace | Physical |
| `sho` | Finalização | Shooting | Technical |
| `pas` | Passe | Passing | Technical |
| `dri` | Drible | Dribbling | Technical |
| `def` | Defesa | Defending | Tactical |
| `phy` | Físico | Physical | Physical |

**Training Categories** (group multiple stats):
- TÉCNICO → pas, dri, sho
- FÍSICO → pac, phy
- TÁTICO → def
- DESCANSO → recovery (no direct stat)

**Position Color Coding:**
- GK (Goleiro) = Gold/Yellow
- DEF (Defensor) = Blue
- MID (Meio-campo) = Cyan
- FWD (Atacante) = Red
