f# FalaMestre! — UI Screens Plan (omma.build)

> **Design Language Reference:** The Match View screen (already generated) defines the visual identity.
> All screens must follow this system faithfully.

---

## Design System

### Core Aesthetic
**Retro Arcade / CRT Monitor** — a football management game that looks like it runs on vintage arcade hardware. The UI lives inside a virtual CRT cabinet with phosphor glow, scanlines, and film grain overlays.

### Color Palette
| Token | Hex | Usage |
|---|---|---|
| `--navy` | `#00381a` | Primary background |
| `--gold` | `#FFDF00` | Primary accent, text, borders |
| `--green` | `#00A859` | Secondary accent, home team |
| `--pitch-dark` | `#006600` | Pitch surface dark stripe |
| `--pitch-light` | `#008800` | Pitch surface light stripe |
| `--card-navy` | `#004d23` | Card/panel background |
| `--blue` | `#3EA0D4` | Away team, secondary data |
| `--red` | `#FF3333` | Danger, red cards, live dot |
| `--orange` | `#FFA500` | Yellow cards, warnings |
| `--cyan` | `#55e0a0` | Labels, tertiary text |
| Black | `#000000` | Outer cabinet |
| `--muted-text` | `rgba(255,223,0,0.55)` | Subdued gold text |

### Typography
- **Primary font:** `Press Start 2P` (Google Fonts — pixel/retro)
- Font scale (px): 4 / 5 / 6 / 7 / 8 / 9 / 10 / 12 / 14 / 17 / 20 / 28
- All text renders with pixel-perfect anti-aliasing disabled where possible

### CRT Effects (applied to every screen)
- **Scanlines:** `repeating-linear-gradient` horizontal stripes, 2px transparent / 2px `rgba(0,0,0,0.18)`, z-index 99
- **Vignette:** `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.65) 100%)`, z-index 98
- **Phosphor border glow:** `inset 0 0 0 2px rgba(255,223,0,0.35)`, z-index 100
- **Flicker animation:** subtle opacity flicker every ~6s
- **Film grain:** SVG turbulence noise filter at 4% opacity

### Orientation
**All screens are landscape/horizontal.** The game is designed to be played with the device held horizontally, like a handheld console or arcade cabinet. This gives maximum horizontal space for the pitch, stats panels, and side-by-side layouts.
- **Viewport:** `844×390px` (landscape mobile) — `width: 100dvw`, `height: 100dvh`, `orientation: landscape`
- Prompt all omma.build generations with `844×390px landscape`

### Layout Shell
- Full-screen landscape: `100dvw × 100dvh`
- `#cabinet`: black outer frame, 4px padding, flex row (left sidebar optional) or flex column
- `#crt-screen`: rounded-10px inner screen, dark navy BG, all effects stacked
- All content inside `#screen-content`: flex row or column depending on screen, fills viewport

### Component Patterns
- **Frosted glass pills/cards:** `background: rgba(0,18,8,0.72)`, `backdrop-filter: blur(14px)`, `border: 1px solid rgba(255,223,0,0.30)`, `border-radius: 7-10px`
- **Buttons:** Gold bordered, dark navy fill, gold text, hover → gold fill + navy text
- **Progress bars:** Green (home/positive) or Blue (away/secondary), height 6px, border-radius 1px
- **Section dividers:** `1px solid rgba(255,223,0,0.2)`
- **Glow text:** `text-shadow: 0 0 10px var(--gold), 0 0 22px rgba(255,215,0,0.5)`
- **Pixel icons:** Emoji or custom pixel art SVGs (no flat icon libraries)

### Language
All UI labels in **Portuguese (pt-BR)**.

---

## Screens Index

| # | Screen | Status | Priority |
|---|---|---|---|
| 01 | Match Simulation View | ✅ Done | — |
| 02 | Login / Splash | ⬜ Needed | P0 |
| 03 | Onboarding — Team Creation | ⬜ Needed | P0 |
| 04 | Dashboard | ⬜ Needed | P0 |
| 05 | App Shell (Header + Bottom Nav) | ⬜ Needed | P0 |
| 06 | Squad Management | ⬜ Needed | P0 |
| 07 | Player Detail Modal | ⬜ Needed | P0 |
| 08 | Match Preview (Pre-Match) | ⬜ Needed | P0 |
| 09 | Match Result Modal | ⬜ Needed | P0 |
| 10 | Transfer Market | ⬜ Needed | P1 |
| 11 | League Standings | ⬜ Needed | P1 |
| 12 | Stadium View | ⬜ Needed | P1 |
| 13 | Facilities View | ⬜ Needed | P1 |
| 14 | Youth Academy | ⬜ Needed | P1 |
| 15 | Staff Management | ⬜ Needed | P1 |
| 16 | Predictions / Apostas | ⬜ Needed | P1 |
| 17 | Investments / Investir | ⬜ Needed | P1 |
| 18 | Daily Reward Modal | ⬜ Needed | P2 |
| 19 | Achievement Toast / Notification | ⬜ Needed | P2 |
| 20 | Settings Panel | ⬜ Needed | P2 |
| 21 | Season End / Promotion Screen | ⬜ Needed | P2 |
| 22 | Phase Unlock Modal | ⬜ Needed | P2 |

---

---

## 01 — Match Simulation View ✅ DONE

**Status:** Generated and polished. Used as the design reference for all other screens.

**What it has:**
- Full-screen CRT cabinet frame with scanlines, vignette, phosphor glow
- Advertising billboard strip at top (ad boards scrolling)
- Canvas-rendered 2D football pitch (dark/light green stripes, white markings, goals)
- 22 pixel-art player dots with team colors (home green / away blue), animated movement
- Floating frosted-glass scoreboard overlay (team names, score digits, match clock)
- Live commentary caption pill floating below scoreboard (latest event, marquee scroll for long text, red live dot, gold glow text)
- Stats panel — slides in from the right over the pitch (possession, shots, corners, etc.)
- Goal celebration overlay (pulsing gold "GOOOOOL!" text + scorer name)
- Event flash (red card, yellow card, save — colored screen flash)
- Playback controls strip at bottom (Play/Pause, speed ×1/×2/×4, stats toggle, fullscreen)
- HUD hint tooltip

### Polish Suggestions
- [ ] Add halftime / fulltime whistle animation — brief white flash + "INTERVALO" or "FIM DE JOGO" text pill, then fade
- [ ] Substitution event: brief "+/-" player swap visual on pitch with number indicators
- [ ] Add team color dots to the scoreboard team names for visual association
- [ ] Commentary pill: add event-type icon prefix (⚽ goal, 🟡 yellow, 🟥 red, 🧤 save) before text
- [ ] Bottom controls: add a match timeline scrubber (thin gold progress bar) so user can see progress in the 90 minutes
- [ ] Stats panel: show team crests/colors at the top of the panel instead of just "ESTATÍSTICAS"

---

---

## 01b — Match Decision Turn Overlay ⬜ NEEDED

**Description:** In-match tactical decision overlay that appears at specific minutes (0', 15', 30', 45', 60', 75'). Shows the current match state, segment summary, and tactical options for the player to choose. Timer-based — auto-selects default if time expires.

**Layout:** Overlay on top of the match view. Frosted glass panel slides in from the right side (~45% screen width). Match continues dimly visible behind with reduced opacity.

**Content Sections:**
1. **Turn Header:** Turn label (e.g., "AVALIAÇÃO TÁTICA"), minute indicator ("30'"), countdown timer (30s circular or numeric)
2. **Segment Summary:** AI-generated text explaining what happened since last turn — score changes, dominance, cards, near-misses
3. **Score & Context Row:** Current score large, team names, red card warning icon if applicable, tired player alert
4. **Tactical Options Grid:** 2×3 or 2×4 grid of option cards:
   - Mentality shifts: attacking / balanced / defensive
   - Tactical instructions: high press, park the bus, tiki-taka, counter-attack, wing play, shoot on sight, etc.
   - Substitution slot (if tired player detected)
   - Each card shows: icon, label, brief description, stat effect preview (+pac, -def, etc.)
5. **Default Option Bar:** "Manter como está" — highlighted as fallback, auto-selected on timer expiry
6. **Confirm Button:** "CONFIRMAR" — disabled until an option is selected

**Key Interactions:**
- Timer counts down from 30s — pulsing red when under 10s
- Tap option card to select (gold border + glow), then tap confirm
- Option cards show risk indicator (low/medium/high) via colored dot
- Stat modifiers preview shown as mini +/- icons on each card
- On confirm: overlay slides out, match simulation resumes with new tactics applied

**States:**
- **Normal:** Full grid of options
- **Losing by 2+:** Offensive options prioritized (highlighted in green)
- **Red card:** Substitution option forced into grid
- **Low fitness:** Tired player highlighted with substitution suggestion

### omma.build Prompt

```
Design an in-match tactical decision overlay for "FalaMestre!" — retro arcade Brazilian football game. This appears as a frosted-glass panel sliding in from the right over the match view. Landscape 844×390px.

(Embed full Design System from DESIGN_SYSTEM.md here)

OVERLAY PANEL (slides from right, width 380px, full height, background rgba(0,10,5,0.94), backdrop-filter blur(20px), border-left 2px solid #FFDF00):

TURN HEADER (height ~70px, padding 16px):
  Left: turn label "AVALIAÇÃO TÁTICA" in Press Start 2P 7px gold
  Right: timer "⏱ 30" in Press Start 2P 8px, gold (pulses red under 10s)
  Below: minute badge "30'" in 5px cyan

SEGMENT SUMMARY (frosted strip, padding 12px, margin 12px):
  "Seu time domina mas precisa finalizar. Jogo equilibrado, 0x0." in Press Start 2P 5px white
  Auto-generated contextual text based on match events

SCORE ROW (centered, padding 12px):
  "FLAMENGO" 6px gold | "0 – 0" 14px gold glow | "PALMEIRAS" 6px muted gold

CONTEXT ALERTS (if applicable):
  Red card warning: "🟥 CARTÃO VERMELHO — PREENCHA A VAGA" in 5px red
  Tired player: "😓 R. NEYMAR CANSADO — CONSIDERE TROCA" in 5px orange

TACTICAL OPTIONS GRID (2×3 grid, 10px gap, padding 12px):
  Each option card (frosted glass, border-radius 8px, padding 10px, border 1px rgba(255,223,0,0.30)):
    - Selected state: gold border 2px + gold background glow
    - Icon: pixel emoji (e.g., ⚔️ for attack, 🛡️ for defense)
    - Label: "PARTIR P/ ATAQUE" 5px gold
    - Description: "Mais ofensivo, vulnerável no contra-ataque" 4px cyan
    - Stat preview: "+PAC +SHO | -DEF" 4px white
    - Risk dot: green (low) / orange (medium) / red (high)

  Options shown:
    Row 1: ATTACKING mentality | BALANCED mentality | DEFENSIVE mentality
    Row 2: HIGH PRESS | TIKI-TAKA | COUNTER-ATTACK
    Row 3: SUBSTITUTION (if tired player) | WING PLAY | SHOOT ON SIGHT

DEFAULT BAR (bottom of panel, padding 12px):
  "✓ Manter como está" in 5px muted gold, left
  "Opção padrão se o tempo acabar" in 4px muted cyan, right

CONFIRM BUTTON (full-width within panel, height 48px):
  "CONFIRMAR TÁTICA" — gold fill, navy text, Press Start 2P 6px, border-radius 6px
  Disabled until option selected (dimmed when disabled)

Behind the panel: match view at 40% opacity, still animating.
All pt-BR. CRT scanlines continue over the overlay.
```

---

---

## 02 — Login / Splash Screen

**Description:** Entry point to the game. Functions as both a splash/loading screen and the authentication gate. Shows the game brand identity, then prompts for sign-in.

**Layout:** Full-screen landscape (844×390px). Three visual layers: CRT cabinet → animated pitch background → centered content card.

**Content Sections:**
1. **Animated pixel pitch background** — subtle looping animation of a football bouncing on a pixel-art pitch
2. **Game logo block** — "FALA MESTRE!" in large Press Start 2P, gold glow, with a pixel football icon above it
3. **Tagline** — "O jogo de futebol com IA" (small, cyan, below logo)
4. **Auth options card** (frosted glass):
   - Google sign-in button (gold border, Google G pixel icon, "Entrar com Google")
   - Divider "ou"
   - Email input + "Entrar" button (two-step: email → password)
5. **Version number** — tiny, bottom right, muted gold
6. **Background:** static CRT frame with full scanlines/vignette/grain running

**Interactions:**
- Buttons have pixel-press effect (1px shadow offset on active)
- Input field: gold border on focus, scanline aesthetic
- On successful auth: brief white flash transition to Onboarding or Dashboard

### omma.build Prompt

```
Design a full-screen mobile login/splash screen (844×390px, landscape) for "FalaMestre!" — a retro arcade Brazilian football management game with AI. The screen must feel like it's running on a vintage CRT monitor.

(Embed full Design System from DESIGN_SYSTEM.md here)

VISUAL FRAME: The entire screen is a CRT cabinet (black outer, 4px padding), then a rounded inner screen (#00381a dark navy-green) with these layered effects: horizontal scanlines (2px repeating gradient at 18% opacity), edge vignette (radial gradient darkening corners), subtle phosphor glow (gold inner border glow), and slow flicker animation.

LAYOUT: Two-column horizontal split (landscape).
  LEFT HALF (~420px wide): full-height pixel-art football pitch animation — green stripes (#006600/#008800 alternating), white pixel pitch lines, a pixel football bouncing in a looping arc. Overlaid centered: game logo block (pixel football icon 40×40px above, "FALA MESTRE!" in Press Start 2P 20px gold glow, "O JOGO DE FUTEBOL COM IA" in 5px cyan below).
  RIGHT HALF (~420px wide): centered vertically, contains the auth card.

AUTH CARD (frosted-glass, width 340px, background rgba(0,18,8,0.80), blur 14px, 1px gold rgba(255,223,0,0.35) border, border-radius 12px, padding 28px 24px):
  1. "BEM-VINDO!" in Press Start 2P 8px gold, centered
  2. Vertical gap (16px)
  3. Google sign-in button: full-width, Press Start 2P 6px, dark navy fill (#00381a), gold border 1px (#FFDF00), white text "ENTRAR COM GOOGLE", pixel-art Google G logo on left, border-radius 6px, height 40px
  4. Divider row: thin gold lines left and right of the word "ou" (5px, muted gold)
  5. Email input field: full-width, height 36px, border-radius 4px, background rgba(255,223,0,0.08), border 1px solid rgba(255,223,0,0.40), Press Start 2P 5px text, gold placeholder "SEU EMAIL", gold caret
  6. Below the input: full-width button "ENTRAR" — gold fill (#FFDF00), navy text (#00381a), Press Start 2P 6px, height 40px, border-radius 6px, pixel shadow effect

BOTTOM RIGHT: Version text "v0.9.0" in Press Start 2P 4px, muted gold (rgba(255,223,0,0.45)), bottom-right of the auth card.

All fonts: Press Start 2P (Google Fonts). Language: pt-BR. No flat icons — use pixel-style emoji or custom pixel blocks. The aesthetic is "Game Boy meets World Cup 1994".
```

---

## 03 — Onboarding — Team Creation

**Description:** Multi-step wizard for new users to create their football club. Runs immediately after first login. Should feel exciting and ceremonial — like picking your team for the first time.

**Steps (3 screens or a single scroll):**
- **Step 1 — Club Name & Badge:** Text input for team name, color picker for primary/secondary colors (generates a simple pixel badge preview), country flag selector (Brazil default)
- **Step 2 — Starting Formation:** Visual formation selector — 4-3-3, 4-4-2, 4-2-4, 3-5-2. Show a mini pixel pitch with dots in position layout for each option. Tap to select.
- **Step 3 — Confirm & Kick Off:** Summary card with team name, badge preview, formation name. Big CTA "CRIAR TIME!" button.

**Layout:** Full-screen CRT cabinet. Progress indicator at top (3 dots or step numbers). Content centered.

**Key Components:**
- Step progress bar: 3 gold dots, active dot larger with glow
- Team name input: pixel-art text field with blinking cursor
- Color swatches: 8 selectable color options in pixel blocks (green, blue, red, black, white, yellow, purple, orange)
- Badge preview: live-updating pixel art badge (square badge with team initials and selected colors)
- Formation mini-pitch: 4 options in a 2×2 grid, each showing a 60×80px pixel pitch with white dots
- CTA button: large, full-width, gold fill, "CRIAR TIME!" with a pixel football emoji

### omma.build Prompt

```
Design a 3-step onboarding wizard screen for "FalaMestre!" — a retro arcade Brazilian football management game. Style matches a CRT arcade cabinet: full-screen mobile (844×390px landscape), dark navy-green background (#00381a), scanlines overlay, vignette, phosphor glow border, Press Start 2P pixel font throughout.

(Embed full Design System from DESIGN_SYSTEM.md here)

Show Step 2 of 3 (Formation Selection) as the primary render. Include a step indicator at the top: three gold dots (#FFDF00), with dot 2 larger and glowing, dots 1 and 3 smaller and dim.

HEADER SECTION (top 15% of screen):
  - Back arrow (left, pixel style, gold)
  - Step title "ESCOLHA SUA FORMAÇÃO" in Press Start 2P 8px, gold, centered
  - Step counter "PASSO 2 DE 3" in Press Start 2P 5px, #55e0a0 cyan

FORMATION GRID (center, 2×2 grid of cards, 16px gaps):
  Each card is a frosted-glass panel (rgba(0,18,8,0.72), blur 10px, 1px gold border, border-radius 8px, 80px × 100px):
    - Formation label at top: e.g. "4-3-3" in Press Start 2P 6px, gold
    - Mini pixel pitch inside: 60×70px, dark green (#004400) with thin white pitch lines
    - White pixel dots representing player positions (11 dots: 1 GK bottom, 4 defenders, 3/4 midfield, 3/2 forwards)
    - Selected card has gold border 2px + gold background glow effect
  Cards represent: 4-3-3 (selected), 4-4-2, 4-2-4, 3-5-2

DESCRIPTION AREA (below grid):
  - Small frosted-glass pill showing description of selected formation
  - "EQUILIBRADO — Bom ataque e defesa" in Press Start 2P 5px, cyan, centered
  - 3 pixel icon stats: ⚔️ Ataque ★★★★☆ | 🛡️ Defesa ★★★☆☆ | 🎯 Controle ★★★★☆ (rendered as pixel gold stars)

BOTTOM SECTION:
  - Full-width gold button "PRÓXIMO →" (Press Start 2P 7px, navy text, gold fill, height 44px, border-radius 6px)
  - Small back link "← Voltar" centered, muted gold 5px

CRT effects: scanlines at z-index 99, vignette at 98, phosphor border glow at 100. Pixel font only. Language pt-BR.
```

---

## 04 — Dashboard

**Description:** The main home screen after login. Acts as mission control for the whole game. Shows the most important info at a glance and surfaces key actions.

**Layout:** Full-screen CRT cabinet. Scrollable vertical content inside the CRT screen. Fixed header (team info strip) at top, fixed bottom navigation, scrollable cards in the middle.

**Content Sections (top to bottom):**
1. **Team Header Strip** — team badge (pixel art), team name, division badge (e.g. "Série D"), current round "Rodada 12/38"
2. **Resource Bar** — coins display (💰 12.500), morale bar, next match countdown pill
3. **Quick Stats Row** — 3 mini stat cards: W/D/L record, league position, team overall rating
4. **Next Match Card** — vs. opponent team name/badge, date, home/away indicator, "JOGAR AGORA" button
5. **Squad Health Panel** — horizontal scrollable player fitness bars (5-6 most critical players shown)
6. **AI Insights Card** — frosted glass card with 2-3 bullet points of AI tactical advice, cyan text, "🤖 ASSISTENTE" label
7. **Daily Reward Card** — compact, shows streak counter, reward preview, "RESGATAR" button
8. **League Mini Table** — top 5 teams in current standings, user's team highlighted in gold

**Key Interactions:**
- "JOGAR AGORA" button is the primary CTA — gold fill, pulsing glow animation
- Tapping any section navigates to the full view
- Scroll is momentum-based, smooth

### omma.build Prompt

```
Design the main Dashboard screen for "FalaMestre!" — a retro arcade Brazilian AI football management game. Full-screen mobile (844×390px landscape), CRT cabinet aesthetic with full scanlines, vignette, and phosphor glow effects. Font: Press Start 2P throughout.

(Embed full Design System from DESIGN_SYSTEM.md here)

COLORS: background #00381a, gold #FFDF00, cyan #55e0a0, green #00A859, navy card #004d23.

LAYOUT: Landscape two-column split inside the CRT screen.
  LEFT COLUMN (~300px wide, full height): fixed navigation sidebar
  RIGHT AREA (remaining width, ~540px): main content, scrollable vertically

LEFT SIDEBAR (background rgba(0,8,3,0.80), border-right 1px rgba(255,223,0,0.20)):
  TOP: team badge (40×40px pixel art) + "FLAMENGO FC" 6px gold + "SÉRIE D · RD.12/38" 4px cyan
  MIDDLE: vertical nav menu (5 items, full sidebar width each, 48px height):
    ⚽ JOGO (active: gold fill left bar 3px + gold text) | 👥 ELENCO | 🏪 MERCADO | 🏆 LIGA | ⚙️ MAIS
    Each item: pixel icon 18px + label in Press Start 2P 5px, spaced 12px from icon, left-padding 16px
    Active item: left border 3px solid gold, background rgba(255,223,0,0.08)
  BOTTOM: coin display "💰 12.500" in 6px gold, gold glow, centered

RIGHT CONTENT (scrollable, padding 12px):

SECTION 1 — Next Match Card (frosted glass, full-width, 80px tall):
  Left: "PRÓXIMA PARTIDA" label 4px cyan | team badges + VS + opponent | "SÁBADO · 20:00" in muted gold 4px
  Right: large gold button "⚡ JOGAR" (Press Start 2P 6px, height 40px, gold fill, navy text, pulsing box-shadow)

SECTION 2 — Stats Row (3 equal cards, 12px gap, full-width, 64px each):
  Card A: "W7 D3 P2" | "CAMPEONATO" 4px cyan
  Card B: "#3" | "POSIÇÃO" 4px cyan
  Card C: "74" | "OVERALL" 4px cyan
  (Frosted glass, 10px border-radius, gold number 12px Press Start 2P)

SECTION 3 — Squad Health (full-width frosted card, ~80px):
  "CONDIÇÃO DO ELENCO" 4px cyan title
  Row of 5 player mini-cards (horizontal): name 4px gold, position badge, fitness bar 4px height (green/orange/red)
  One card: red bar + ❌ (injured)

SECTION 4 — Bottom two-column row (full-width, 2 equal cards side by side):
  LEFT CARD — AI Insights (frosted glass):
    🤖 "IA ASSISTENTE" 4px cyan
    2 bullet points 4px gold
    "PERGUNTAR →" 4px cyan link
  RIGHT CARD — Liga Mini Tabela:
    "CLASSIFICAÇÃO" 4px cyan
    5 rows: rank | dot | name | pts
    User row gold highlighted

DAILY REWARD STRIP (full-width, 44px, bottom of content):
  🔥 "DIA 7 SEGUIDO" | "💰 +500" gold glow | "RESGATAR" button right

CRT effects applied to entire screen. All text pt-BR. This is the primary "home base" screen.
```

---

## 05 — App Shell (Header + Left Sidebar Navigation)

**Description:** The persistent chrome that wraps every game view. Defined once and reused. Two parts: the top team header (inside sidebar) and the left sidebar navigation.

**Left Sidebar Navigation (fixed, ~200px wide, full height):**
- **Top Section:** Team badge (pixel art, 40×40), team name, league + round info
- **Navigation Items (5):** Jogo (⚽) | Elenco (👥) | Mercado (🏪) | Liga (🏆) | Mais (☰)
  - Active state: gold left border + gold text + subtle gold background
  - Inactive state: muted gold text
- **Bottom Section:** Coin display with pixel coin icon, notification bell with badge counter
- Tap animations: pixel-press scale effect

### omma.build Prompt

```
Design the persistent app navigation shell for "FalaMestre!" — retro arcade football management game. Landscape orientation (844×390px). Show ONLY the navigation chrome rendered on a dark background.

(Embed full Design System from DESIGN_SYSTEM.md here)

The shell is a LEFT SIDEBAR (vertical) — landscape means navigation lives on the left edge, not top/bottom.

LEFT SIDEBAR (width 200px, full height, background rgba(0,8,3,0.92), backdrop-filter blur(10px), border-right: 1px solid rgba(255,223,0,0.20)):

  TOP SECTION (padding 14px 12px, border-bottom 1px rgba(255,223,0,0.15)):
    Team badge: 40×40px pixel-art shield, green/yellow, centered horizontally
    "FLAMENGO FC" in Press Start 2P 6px #FFDF00 gold, centered below badge
    "SÉRIE D · RD.14" in 4px #55e0a0 cyan, centered

  NAVIGATION ITEMS (flex column, full width, each 46px tall, left-padding 14px):
    Each item: left border 3px (active=gold, inactive=transparent) | pixel icon 18px | label Press Start 2P 5px, 10px from icon

    "JOGO" ⚽ — ACTIVE: gold icon + text, left border 3px #FFDF00, background rgba(255,223,0,0.08)
    "ELENCO" 👥 — inactive: rgba(255,223,0,0.40)
    "MERCADO" 🏪 — inactive
    "LIGA" 🏆 — inactive
    "MAIS" ☰ — inactive

  BOTTOM SECTION (pinned to bottom, padding 12px, border-top 1px rgba(255,223,0,0.15)):
    Coin display: pixel coin icon 14px + "12.500" in Press Start 2P 6px #FFDF00 gold glow, row layout
    Below: notification bell icon 14px white + red badge dot "3" (#FF3333)

Font: Press Start 2P. Gold active, muted-gold inactive. CRT phosphor glow on outer screen border. No scanlines on the sidebar itself — scanlines apply to the content area to the right.
```

---

## 06 — Squad Management

**Description:** Full roster view for managing your 11-player team. Landscape split: pitch formation on the left, scrollable player list on the right.

**Layout:** CRT frame, left sidebar nav, then two-column content: pitch panel (left ~45%) + player list (right ~55%).

**Content Sections:**
1. **Formation Panel (left column):** Full-height pixel-art pitch showing current formation with player position circles. Each circle shows player number + abbreviated name. Colored by position (GK=yellow, DEF=blue, MID=cyan, FWD=red). Formation selector chips along the bottom of the pitch. Tapping a position opens Player Detail modal.
2. **Player List (right column, scrollable):** One row per player. Shows: number, name, position badge, overall rating bar (5px), morale icon (😊/😐/😤), fitness bar, action arrow. Players in starting 11 have gold left border.

**Key Interactions:**
- Swap players by tapping a position on the pitch then a player in the list
- Long press on a player shows quick actions (Train, Sell, Details)
- Formation change shows brief animation of dots moving on the pitch

### omma.build Prompt

```
Design the Squad Management screen for "FalaMestre!" — retro arcade Brazilian football game. Full-screen 844×390px landscape, CRT cabinet with scanlines, vignette, phosphor glow. Font: Press Start 2P throughout.

(Embed full Design System from DESIGN_SYSTEM.md here)

COLORS: navy #00381a, gold #FFDF00, cyan #55e0a0.

LAYOUT: Left sidebar nav (200px) + two-column content area.
  LEFT CONTENT PANEL (~340px, full height): formation pitch display
  RIGHT CONTENT PANEL (~300px, full height): scrollable player list

LEFT PANEL — FORMATION PITCH:
  Full-height pixel-art football pitch (portrait orientation within the panel — attacking upward): dark/light green stripes (#006600/#008800), white pixel lines for penalty areas, center circle, halfway line.

  Overlay 11 player markers:
    Circle 22px diameter, position-colored (GK=gold, DEF=blue #3EA0D4, MID=cyan #55e0a0, FWD=red #FF3333), white Press Start 2P 5px jersey number inside.
    Below each circle: player surname in 4px white (e.g. "SILVA", "NETO").
    Formation 4-3-3: GK(1) bottom center, DEF(4) second row, MID(3) third row, FWD(3) top row.

  BOTTOM OF PITCH — formation selector chips (horizontal row, 28px height):
    "4-3-3" (active, gold fill) | "4-4-2" | "4-2-4" | "3-5-2" (gold border, 4px text, border-radius 3px)

RIGHT PANEL — PLAYER LIST (scrollable, border-left 1px rgba(255,223,0,0.20)):
  Panel header: "ELENCO" 5px cyan + "11/11 TITULARES" 4px muted gold, right-aligned

  11 starting rows + 3 bench rows. Starting rows: left border 2px gold.
  Each row (height 40px, border-bottom 1px rgba(255,223,0,0.12), padding 0 8px):
    Jersey # "10" — 7px gold — 24px wide
    Position badge "MEI"/"ATA"/"ZAG"/"GOL" — colored 18×12px — 4px white text
    Player name "R. NEYMAR" — 5px white — flex-1
    Overall "87⭐" — 6px gold — right
    Morale dot 8px (green/orange/red)
    Fitness bar 28px wide, 4px tall — bottom edge of row

  Bench rows: 40% opacity, "BANCO" 3px cyan label replacing position badge

All CRT effects. pt-BR.
```

---

## 07 — Player Detail Modal

**Description:** Bottom-sheet modal that slides up when a player is tapped anywhere in the app. Shows full stats, training options, and actions for a single player.

**Layout:** Slides up from bottom, covers 85% of screen height. Draggable handle at top. Dark frosted-glass background.

**Content Sections:**
1. **Player Header:** Large pixel avatar (jersey number + position color), full name, position pill, overall rating badge (gold)
2. **Attribute Bars (4 skills):** Technical, Physical, Tactical, Descanso — each with a bar (out of 100), current value, and a training "+" button
3. **Season Stats Row:** Jogos (games), Gols, Assistências, Cartões — 4 mini stat boxes
4. **Morale & Fitness Section:** Two horizontal bars with labels and % values
5. **Training Section:** 4 training buttons (one per attribute), each showing cost (💰 200) and effect (+2 técnico). Training costs multiply each use.
6. **Action Buttons Row:** "VENDER" (red border) | "DETALHES" (gold border)

### omma.build Prompt

```
Design a Player Detail bottom-sheet modal for "FalaMestre!" — retro arcade football game. Modal slides up from bottom, covers 85% of a 844×390px landscape screen. Background: full CRT screen behind it (dark navy, scanlines visible), modal itself is rgba(0,18,8,0.96) with backdrop-filter blur(20px), border-top: 2px solid #FFDF00, border-radius 14px 14px 0 0. Font: Press Start 2P throughout.

(Embed full Design System from DESIGN_SYSTEM.md here)

DRAG HANDLE: centered 32×4px rounded bar, rgba(255,223,0,0.40), 12px from top

PLAYER HEADER (height ~100px, padding 20px):
  Left: large pixel-art avatar block (56×56px) — colored square representing jersey (example: green jersey with "#10"), position-colored border (MID=cyan, FWD=red, DEF=blue, GK=yellow)
  Right of avatar:
    Full name "ROBERTO NEYMAR" in Press Start 2P 7px #FFDF00, glow
    Position row: pill "MEIA" in 5px white on cyan background + nationality flag emoji 🇧🇷
    Overall badge: gold diamond shape containing "87" in 8px Press Start 2P gold, bordered
    Age: "24 ANOS" in 4px cyan

SEASON STATS ROW (4 equal-width boxes, border-top 1px gold separator):
  Boxes: JOGOS "22" | GOLS "8" | ASSIST "5" | CARTÕES "2🟡 0🟥"
  Each: number in 10px Press Start 2P gold, label in 4px cyan below, no border between boxes

ATTRIBUTE BARS (4 rows, each 36px tall):
  Row layout: attribute name (5px cyan, 80px wide) | bar (flex-1, 6px tall, colored fill, rounded) | value number (5px gold, 28px wide) | "TREINAR" button (24×20px, gold border, "+" pixel icon, 4px, borderRadius 4px)

  Attributes:
    "TÉCNICO" — bar color #00A859 green — value "82" — treinar button
    "FÍSICO" — bar color #3EA0D4 blue — value "78"
    "TÁTICO" — bar color #55e0a0 cyan — value "85"
    "DESCANSO" — bar color #FFA500 orange — value "91"

MORALE & FITNESS:
  "MORAL" — large bar, gold fill, 70% — "70" right, green-to-gold gradient
  "PREPARO" — large bar, #00A859 fill — "88%" right

TRAINING COST HINT: "TREINAR CUSTA 💰 200 / SESSÃO" in 4px muted gold, centered

ACTION BUTTONS ROW (bottom, 12px gap):
  "VENDER" button: full-width 50%, height 40px, border 1px #FF3333, color #FF3333, background transparent, Press Start 2P 5px
  "FECHAR" button: full-width 50%, height 40px, border 1px rgba(255,223,0,0.40), color gold, background rgba(255,223,0,0.10)

Subtle pixel scanlines visible on the modal surface as well. All text pt-BR.
```

---

## 08 — Match Preview (Pre-Match)

**Description:** Shown when the user taps "JOGAR AGORA" from the Dashboard. The final confirmation screen before starting a match simulation. Creates anticipation and shows the matchup clearly.

**Layout:** Full-screen CRT. Centered content, dramatic presentation.

**Content Sections:**
1. **Venue Banner:** Stadium name, "CASA" or "FORA" label, round number pill
2. **Team Matchup Display:** Both team badges (large, pixel art) facing each other with "VS" between them in dramatic gold. Team names below badges.
3. **Team Stats Comparison:** Side-by-side bars for Overall Rating, Ataque, Defesa, Forma
4. **Match Prediction:** "Chance de vitória" — your team X% | empate Y% | opp Z% (shown as colored bar segments)
5. **Lineup Preview:** Your formation (mini pitch, same as Squad view but smaller)
6. **CTA buttons:** "SIMULAR PARTIDA" (primary, gold) and "VER ELENCO" (secondary)

### omma.build Prompt

```
Design the Pre-Match screen for "FalaMestre!" — retro arcade Brazilian AI football game. Full-screen mobile (844×390px landscape), CRT cabinet with scanlines, vignette, phosphor glow border. Font: Press Start 2P throughout.

(Embed full Design System from DESIGN_SYSTEM.md here)

COLORS: navy #00381a, gold #FFDF00, cyan #55e0a0.

TOP SECTION (height ~80px):
  Venue banner: full-width frosted glass strip (rgba(0,18,8,0.72), blur 10px)
  "ESTÁDIO MARACANÃ" in 6px gold centered
  Below: "RODADA 14 · MANDANTE" in 5px cyan
  Round pill on right: "RD. 14/38" gold pill

TEAM MATCHUP (height ~160px, centered, dramatic):
  Three-column layout:
    Left column: large team badge (64×64px pixel art, home team colors green/yellow shield), team name "FLAMENGO FC" in 7px gold below badge
    Center column: "VS" in 20px Press Start 2P gold with strong glow (text-shadow: 0 0 15px #FFDF00, 0 0 35px rgba(255,215,0,0.7)), a subtle gold star divider above and below
    Right column: opponent badge (64×64px, blue/white), "PALMEIRAS" in 7px gold below

STATS COMPARISON (frosted card, 4 rows):
  Title "COMPARAÇÃO" in 5px cyan, centered, border-bottom 1px gold separator
  Each row: home value (gold, right-aligned) | stat bar (center, split — left half home color green, right half away color blue, proportional to values) | away value (gold, left-aligned) | stat label (4px cyan, centered above or below bar)
  Stats: "OVERALL" 74 vs 71 | "ATAQUE" 78 vs 69 | "DEFESA" 71 vs 74 | "FORMA" ★★★★☆ vs ★★★☆☆

PREDICTION ROW (full-width, height 48px):
  Label "PREVISÃO" in 5px cyan, left
  Full-width segmented probability bar (height 20px, border-radius 4px):
    Left segment: home win 55% — green #00A859
    Center segment: draw 20% — muted gold rgba(255,223,0,0.5)
    Right segment: away win 25% — blue #3EA0D4
  Below bar: "55% VITÓRIA · 20% EMPATE · 25% DERROTA" in 4px white

FORMATION PREVIEW (small, centered, 100px tall):
  Mini pixel pitch (80×100px), 4-3-3 dot formation overlay, label "4-3-3" in 5px gold below

ACTION BUTTONS (bottom section, stacked):
  Primary: full-width "⚡ SIMULAR PARTIDA" in Press Start 2P 7px, gold fill #FFDF00, navy text, height 48px, border-radius 6px, pulsing box-shadow glow animation
  Secondary: full-width "VER ELENCO →" in 5px muted gold, transparent background, gold border, height 36px

All pt-BR text. CRT effects fully applied.
```

---

## 09 — Match Result Modal

**Description:** Appears at the end of a match simulation. Celebrates a win, commiserates a loss. Shows key stats and progression effects.

**Layout:** Full-screen overlay (covers the match canvas). Darkened backdrop, centered card.

**States:**
- **Win:** Gold confetti pixels raining down, "VITÓRIA!" header in animated gold glow
- **Draw:** Neutral silver/gold palette, "EMPATE" header
- **Loss:** Red-tinted background flash fading out, "DERROTA" header in subdued styling

**Content Sections:**
1. **Result Header:** "VITÓRIA! / EMPATE / DERROTA" with dynamic color
2. **Score Display:** Large score "3 – 1" in massive Press Start 2P
3. **Team Names Row:** Both teams with badges
4. **Match Stats Card:** Posse de bola, Finalizações, Escanteios, Cartões — 2-column comparison
5. **Player of the Match:** Highlighted player card (name, rating, goals/assists)
6. **Rewards Earned:** "💰 +1.200 arrecadados" + XP or points if applicable
7. **Next Actions:** "PRÓXIMA RODADA →" | "REVER PARTIDA"

### omma.build Prompt

```
Design a Match Result overlay modal for "FalaMestre!" — retro arcade football game. This is a full-screen overlay covering the game screen after a match ends. Background: the match pitch underneath, darkened with rgba(0,0,0,0.75) overlay. Center modal card is frosted glass: rgba(0,10,5,0.94), blur 20px, border 2px solid #FFDF00, border-radius 14px, width 90%, max-width 360px, padding 24px. Font: Press Start 2P throughout. Show the WIN state.

(Embed full Design System from DESIGN_SYSTEM.md here)

WINNER DECORATION: Pixel-art confetti animation — small 4×4px colored squares (#FFDF00, #00A859, #3EA0D4, #FF3333) scattered and falling from top of the modal.

RESULT HEADER:
  "⚽ VITÓRIA! ⚽" in Press Start 2P 14px, gold #FFDF00, centered
  Strong glow: text-shadow: 0 0 15px #FFDF00, 0 0 30px rgba(255,215,0,0.6)
  Subtle scale-pulse animation (1.0 → 1.04 → 1.0)

SCORE DISPLAY (centered, height ~80px):
  "3" in 36px Press Start 2P gold | "–" in 24px muted gold | "1" in 36px Press Start 2P rgba(255,255,255,0.60)

TEAM NAMES (below score):
  Left: badge circle 24px + "FLAMENGO" in 5px gold
  Right: badge circle 24px + "PALMEIRAS" in 5px muted

SEPARATOR (1px gold line)

MATCH STATS (2-column table, 4 rows):
  Left value (gold) | stat name centered (4px cyan) | right value (muted white)
  Rows: "62%" POSSE "38%" | "8" FINALIZAÇÕES "4" | "5" ESCANTEIOS "2" | "1🟡" CARTÕES "2🟡"
  Row height 28px, divider between each row at 20% opacity

PLAYER OF MATCH card (frosted mini-card, full-width):
  Left: jersey pixel art 36×36px, gold border
  Right: "CRAQUE DA PARTIDA" in 4px cyan | name "R. NEYMAR" in 7px gold | "2 GOLS · 1 ASSIST" in 5px white
  Gold star ★ rating "9.2" in 8px gold, right-aligned

REWARDS ROW:
  "💰 +1.200 ARRECADADOS" in 7px Press Start 2P, gold glow, centered
  Below: "+3 PONTOS NA CLASSIFICAÇÃO" in 5px cyan

ACTION BUTTONS (bottom, 8px gap):
  "PRÓXIMA RODADA →" — full-width, gold fill, navy text, 44px height, 6px border-radius, Press Start 2P 6px
  "REVER PARTIDA" — full-width, transparent, gold border, gold text, 36px height

CRT scanlines visible through the semi-transparent modal. pt-BR.
```

---

## 10 — Transfer Market

**Description:** Browse and buy available players, or list your own players for sale. The player marketplace of the game.

**Layout:** CRT frame, fixed header with search/filter bar, scrollable player list.

**Content Sections:**
1. **My Budget Header:** "💰 12.500 disponíveis" — current coins available
2. **Search & Filter Bar:** Search input, position filter chips (TODOS | GK | DEF | MEI | ATA), sort dropdown
3. **Player Cards List (scrollable):** Each card shows: player name, position badge, overall rating, age, value (price), "COMPRAR" button
4. **My Players For Sale Tab:** Second tab "MEU ELENCO" shows own players with "VENDER" action
5. **Transaction Toast:** Brief confirmation toast after buy/sell

### omma.build Prompt

```
Design the Transfer Market screen for "FalaMestre!" — retro arcade Brazilian football game. Full-screen mobile (844×390px landscape), CRT cabinet aesthetics, scanlines, vignette, phosphor glow. Font: Press Start 2P throughout.

(Embed full Design System from DESIGN_SYSTEM.md here)

COLORS: navy #00381a, gold #FFDF00, cyan #55e0a0.

FIXED HEADER (height ~70px):
  Title "🏪 MERCADO DE TRANSFERÊNCIAS" in 6px gold, centered
  Below title: budget pill "💰 12.500 DISPONÍVEIS" in Press Start 2P 6px gold, frosted glass pill, centered

TAB ROW (height 36px, 2 tabs):
  "DISPONÍVEIS" (active, gold fill) | "MEU ELENCO" (inactive, gold border)
  Tabs: Press Start 2P 5px, full-width split, border-bottom 2px gold active indicator

SEARCH & FILTER SECTION (height ~72px):
  Search bar: full-width, height 36px, gold border, navy background rgba(255,223,0,0.08), Press Start 2P 5px, gold placeholder "BUSCAR JOGADOR...", pixel search icon 🔍 gold
  Filter chips row (horizontal scroll): "TODOS" (active gold) | "GOL" | "ZAG" | "LAT" | "MEI" | "ATA" (Press Start 2P 4px, height 24px, border-radius 4px, gold border)

PLAYER LIST (scrollable, full remaining height):
  Each player row card (height 64px, margin-bottom 8px, frosted glass rgba(0,18,8,0.72), blur 10px, gold border 1px, border-radius 8px, padding 10px 12px):
    LEFT: position badge (18×22px colored rectangle): "MEI" cyan | "ATA" red | "ZAG" blue | "GOL" gold — in 4px white
    CENTER:
      Player name "A. GABRIEL" in 6px gold Press Start 2P
      Below: "24 ANOS" in 4px cyan + overall rating "⭐ 81" in 4px gold
    RIGHT SIDE:
      Price "💰 3.500" in 6px gold
      Below price: "COMPRAR" button (height 28px, gold border, gold text, navy fill, 4px Press Start 2P, border-radius 4px)

  Show 6 player rows. One row highlighted (special player): gold background glow, "🔥 DESTAQUE" badge in 3px gold at top-right corner

BOTTOM PAGINATION/LOAD: "VER MAIS JOGADORES ↓" in 5px muted gold, centered, at list bottom

All CRT effects. pt-BR. Show the DISPONÍVEIS tab active.
```

---

## 11 — League Standings

**Description:** Full league table for the current division season. Shows all teams, their record, and the promotion/relegation zones.

**Layout:** CRT frame, header with season info, full scrollable table.

**Content Sections:**
1. **Season Header:** "SÉRIE D — TEMPORADA 2024", round indicator "Rodada 14/38"
2. **Table:** Rank | Team Badge + Name | P (points) | J (played) | V-E-D | Gols | Saldo. User's team row highlighted.
3. **Zone Legend:** Green zone (promotion), red zone (relegation), blue zone (playoffs)
4. **Your Team Spotlight:** A card below the table showing user's team stats in detail

### omma.build Prompt

```
Design the League Standings screen for "FalaMestre!" — retro arcade football game. Full-screen mobile (844×390px landscape), CRT cabinet with scanlines, vignette. Font: Press Start 2P throughout.

(Embed full Design System from DESIGN_SYSTEM.md here)

COLORS: background #00381a, gold #FFDF00, cyan #55e0a0.

HEADER (height ~70px):
  "🏆 CLASSIFICAÇÃO" in 7px gold centered
  "SÉRIE D · TEMPORADA 2024" in 5px cyan centered
  "RODADA 14/38" pill on right: frosted glass, gold text 5px

TABLE COLUMN HEADER ROW (height 24px, border-bottom 2px gold, background rgba(0,18,8,0.80)):
  "#" (24px) | "TIME" (flex) | "PTS" (32px) | "J" (24px) | "V" (24px) | "E" (24px) | "D" (24px) | "SG" (28px)
  All in Press Start 2P 4px, cyan color

TABLE ROWS (each 44px height, alternating backgrounds rgba(0,18,8,0.30) / rgba(0,18,8,0.50)):
  Show 10 rows representing 10 teams.

  USER'S TEAM ROW (#3):
    Background: rgba(255,223,0,0.12), left border 3px solid #FFDF00
    All text in gold instead of white
    "3" rank in 7px gold

  PROMOTION ZONE (rows 1-4): thin green left accent (#00A859) 2px, very subtle green row tint
  RELEGATION ZONE (rows 7-10): thin red left accent (#FF3333), subtle red row tint

  Each row columns:
    Rank: Press Start 2P 6px gold (or white for others)
    Team: 20×20px colored dot (team color) + team name in 5px (truncated to 10 chars)
    PTS: 7px gold, bold
    J/V/E/D: 5px white
    SG: 5px (green if positive, red if negative)

ZONE LEGEND (below table, frosted glass, height ~40px, horizontal):
  🟢 "PROMOÇÃO (1-4)" | 🔵 "PLAYOFF (5-6)" | 🔴 "REBAIXAMENTO (7-10)" in 4px Press Start 2P

YOUR TEAM CARD (frosted glass, full-width, below legend, ~80px):
  Team badge 32px + "FLAMENGO FC · 3° LUGAR" in 6px gold
  Stats row: "33 PTS" | "8V-9E-3D" | "+12 SG" in equal boxes, gold numbers

All CRT effects. pt-BR.
```

---

## 12 — Stadium View

**Description:** View and upgrade your football stadium. Shows current stadium info, capacity, revenue effects, and upgrade options.

**Layout:** CRT frame, hero image (pixel art stadium), upgrade cards below.

**Content Sections:**
1. **Stadium Hero:** Large pixel-art stadium top-down or isometric view (just decorative illustration)
2. **Stadium Info Card:** Name, capacity (seating), current revenue modifier, level badge
3. **Upgrade Cards (vertical list):** Each upgrade card shows: upgrade name, current level (e.g. 2/5), description of effect, cost, "MELHORAR" button (disabled if can't afford)
4. **Revenue Preview:** After upgrade, projected revenue change "+💰 200/partida"

### omma.build Prompt

```
Design the Stadium View screen for "FalaMestre!" — retro arcade football management game. Full-screen mobile (844×390px landscape), CRT cabinet aesthetics, scanlines, vignette, phosphor glow. Font: Press Start 2P throughout.

(Embed full Design System from DESIGN_SYSTEM.md here)

COLORS: navy #00381a, gold #FFDF00, cyan #55e0a0.

HEADER:
  "🏟️ ESTÁDIO" in 7px gold, centered
  Current budget "💰 12.500" pill top-right

STADIUM HERO (height ~160px, full-width):
  A large pixel-art illustration of a football stadium viewed from above/slightly isometric.
  Style: pixel art, 4-5 color palette (green pitch #006600, grey concrete stands #888888, white lines, dark shadows #333333, gold highlight accents)
  Stadium name "ARENA FALANTE" overlaid in Press Start 2P 8px gold with glow, centered over the image
  Capacity badge: "👥 12.000 TORCEDORES" pill in 5px cyan, frosted glass, centered below name

STADIUM STATS ROW (3 boxes below hero, equal width):
  "NÍVEL 2" | "RECEITA +20%" | "CAPACIDADE"
  Each: label in 4px cyan, value in 8px gold, frosted glass box, border-radius 6px

UPGRADES SECTION (scrollable list, full remaining height):
  Title "MELHORIAS DISPONÍVEIS" in 5px cyan, left-aligned

  UPGRADE CARD 1 — "ARQUIBANCADA NORTE" (can afford — green CTA):
    Frosted glass card (rgba(0,18,8,0.72), border 1px rgba(255,223,0,0.30), border-radius 8px, padding 12px):
    Left: pixel-art icon (stadium section, grey/gold blocks, 40×40px)
    Right:
      "ARQUIBANCADA NORTE" in 6px gold
      "Aumenta capacidade em +3.000" in 4px cyan
      Level indicator "NÍVEL ●●○○○" (2 filled gold dots, 3 empty)
      BOTTOM ROW: "💰 5.000" cost in 5px gold | "MELHORAR →" button (green #00A859 fill, white text, 4px, height 28px)

  UPGRADE CARD 2 — "CAMAROTES VIP" (already at max level):
    Same structure but "NÍVEL ●●●●●" full gold, button replaced by "✓ MÁXIMO" in 4px cyan, no CTA

  UPGRADE CARD 3 — "SISTEMA DE SOM" (can't afford — dimmed CTA):
    Same structure, "💰 8.000" cost in red (too expensive), "SEM FUNDOS" button (dimmed, gold border, muted text)

REVENUE PREVIEW (bottom strip, frosted glass):
  "RECEITA ATUAL: 💰 800/PARTIDA" | "APÓS MELHORIA: 💰 1.100/PARTIDA" in 4px in green, centered

All CRT effects. pt-BR.
```

---

## 13 — Facilities View

**Description:** Manage and upgrade your club's training facilities. Directly impacts player development speed during training sessions.

**Layout:** Similar to Stadium View — header, 4 facility cards (one per training type: Technical, Physical, Tactical, Rest), each upgradeable.

**Content Sections:**
1. **Header:** "INSTALAÇÕES DE TREINO" + budget
2. **Facility Cards (4 total):** Each card: facility name, training type icon, current level (1-5), effect description (+X% training gain), upgrade cost and button
3. **Training Efficiency Preview:** Brief summary of how current facilities affect weekly training

### omma.build Prompt

```
Design the Training Facilities screen for "FalaMestre!" — retro arcade football game. Full-screen mobile (844×390px landscape), CRT cabinet aesthetics. Font: Press Start 2P throughout.

(Embed full Design System from DESIGN_SYSTEM.md here)

COLORS: navy #00381a, gold #FFDF00, cyan #55e0a0.

HEADER (height ~70px):
  "⚙️ INSTALAÇÕES" in 7px gold, centered
  "Potencialize o desenvolvimento do elenco" in 5px cyan, centered
  Budget pill: "💰 12.500" top-right

FACILITIES GRID (2×2 grid, 16px gap, full remaining height):
  Each facility card (frosted glass, border-radius 10px, border 1px rgba(255,223,0,0.30), padding 14px, aspect-ratio roughly equal):

  CARD 1 — "TÉCNICO" (green accent):
    Top: pixel-art icon of football being juggled (30×30px, white pixels on transparent)
    Title "CT TÉCNICO" in 6px gold
    Level bar: 5 segments, 3 filled gold, 2 empty grey, label "NÍVEL 3/5" 4px cyan
    Effect: "+15% GANHO TÉCNICO" in 4px white
    Cost + button: "💰 3.000 MELHORAR" button (full-width, green border, cyan text, 4px, height 28px)

  CARD 2 — "FÍSICO" (blue accent):
    Icon: pixel dumbbell/running figure
    "CT FÍSICO" gold
    Level: 2/5 (2 filled)
    "+10% GANHO FÍSICO"
    Button: blue border, same style

  CARD 3 — "TÁTICO" (cyan accent):
    Icon: pixel tactics board/whiteboard
    "SALA TÁTICA" gold
    Level: 4/5
    "+20% GANHO TÁTICO"
    Button: cyan border, "MELHORAR"

  CARD 4 — "DESCANSO" (orange accent):
    Icon: pixel bed/recovery symbol
    "CENTRO DE RECUPERAÇÃO" gold
    Level: 1/5 (only 1 filled)
    "+5% RECUPERAÇÃO"
    "💰 1.500 MELHORAR" button orange border

EFFICIENCY SUMMARY (bottom, frosted strip, ~60px):
  "EFICIÊNCIA GLOBAL DO TREINO: 75%" in 6px gold, centered
  Below: thin bar full-width (green #00A859, at 75% width), 6px height, border-radius 3px

CRT effects. pt-BR.
```

---

## 14 — Youth Academy

**Description:** View and manage your youth team. Discover young talents, train them, and promote the best to the main squad.

**Layout:** CRT frame, two tabs: "REVELAÇÕES" (prospects) and "EM FORMAÇÃO" (in development). List of youth player cards.

**Content Sections:**
1. **Tab Bar:** REVELAÇÕES | EM FORMAÇÃO
2. **Generate Prospect Button:** "DESCOBRIR JOVEM TALENTO" — calls the API, shows a new youth player
3. **Youth Player Cards:** Smaller version of player card — name, age (16-19), potential rating (shown as ★ out of 5), current overall, position, and "TREINAR" / "PROMOVER" buttons

### omma.build Prompt

```
Design the Youth Academy screen for "FalaMestre!" — retro arcade football game. Full-screen mobile (844×390px landscape), CRT aesthetics. Font: Press Start 2P throughout.

(Embed full Design System from DESIGN_SYSTEM.md here)

COLORS: navy #00381a, gold #FFDF00, cyan #55e0a0.

HEADER:
  "🌟 ACADEMIA DE JOVENS" in 7px gold, centered
  "Descubra os talentos do futuro" in 5px cyan

TABS (2 tabs, full-width split):
  "REVELAÇÕES" (active, gold fill, navy text) | "EM FORMAÇÃO" (inactive, gold border)
  Press Start 2P 5px, height 36px

DISCOVER BUTTON (full-width, below tabs, height 44px):
  Dashed gold border (2px dashed #FFDF00), transparent background, gold text "🔍 DESCOBRIR JOVEM TALENTO"
  Cost: "💰 500" in 4px cyan below button text
  Press Start 2P 5px

YOUTH PLAYERS LIST (scrollable):
  Each youth player card (frosted glass, full-width, height 80px, border 1px rgba(255,223,0,0.30), border-radius 8px, padding 10px 12px, margin-bottom 8px):
    LEFT: pixel avatar (jersey, 40×40px, colored by potential — gold for high, cyan for medium, muted for low)
    CENTER:
      Name "M. ENDRICK" in 6px gold
      Age + position: "17 ANOS · ATACANTE" in 4px cyan
      Potential: gold stars "★★★★☆" (4/5 — pixel gold stars, 10px each) + label "POTENCIAL" in 3px muted
      Current rating bar: "OVR 62 ————————— 62/100" (thin bar, 4px, green fill proportional)
    RIGHT:
      "TREINAR" button (height 28px, cyan border, cyan text, 4px, border-radius 4px)
      Below: "PROMOVER" button (height 28px, gold border, gold text, 4px, border-radius 4px) — dimmed if not high enough overall

  Show 4-5 youth player cards.
  One card HIGHLIGHTED with "⚡ PRONTO PARA PROMOVER" gold badge top-right (glowing), gold border 2px

EMPTY STATE (if no youth players):
  Centered message with pixel star icon: "NENHUM JOVEM EM FORMAÇÃO" in 6px muted gold, "CLIQUE ACIMA PARA DESCOBRIR TALENTOS" in 4px cyan

CRT effects. pt-BR.
```

---

## 15 — Staff Management

**Description:** Hire and manage coaching staff who boost specific training areas. Each staff member has specialties that improve player development.

**Layout:** CRT frame. "MEU STAFF" tab showing current staff, "CONTRATAR" tab showing available staff for hire.

**Content Sections:**
1. **Current Staff List:** Each staff card: name, role/title, specialties (4 skill area icons + level), salary (💰/rodada), "DEMITIR" button
2. **Available Staff to Hire:** Same card layout but with "CONTRATAR" button and cost instead
3. **Staff Capacity Indicator:** "3/5 VAGAS OCUPADAS"

### omma.build Prompt

```
Design the Staff Management screen for "FalaMestre!" — retro arcade football game. Full-screen mobile (844×390px landscape), CRT cabinet aesthetics. Font: Press Start 2P throughout.

(Embed full Design System from DESIGN_SYSTEM.md here)

COLORS: navy #00381a, gold #FFDF00, cyan #55e0a0.

HEADER:
  "👔 COMISSÃO TÉCNICA" in 7px gold, centered
  Capacity indicator: "3/5 VAGAS" in frosted pill, cyan text 5px, gold border

TABS: "MEU STAFF" (active) | "CONTRATAR" — same styling as other screens

STAFF CARDS LIST (scrollable):
  Each staff card (frosted glass, full-width, height ~100px, border 1px rgba(255,223,0,0.30), border-radius 8px, padding 12px, margin-bottom 10px):

    TOP ROW:
      Staff name "CARLOS ALBERTÃO" in 6px gold
      Role badge pill: "PREPARADOR FÍSICO" in 3px white on blue background, border-radius 3px

    SPECIALTY BARS (4 compact rows, 8px height each):
      "TÉC" — bar (flex, fill gold or muted) — value "7/10" in 4px gold
      "FÍS" — bar green — "9/10" (this is their specialty, highlighted brighter)
      "TÁT" — bar muted — "4/10"
      "DES" — bar orange — "6/10"

    BOTTOM ROW:
      "💰 -200/RODADA" salary in 5px red (showing ongoing cost)
      "DEMITIR" button right (height 24px, red border #FF3333, red text, transparent fill, 4px Press Start 2P)

  Show 3 current staff members. One staff card with specialty "TÉC" highlighted with a small "⭐ ESPECIALISTA" badge.

AVAILABLE STAFF (shown in CONTRATAR tab, same structure):
  Replace salary with hire cost "💰 3.000"
  Replace "DEMITIR" with "CONTRATAR" (green border, green text)
  Add "SALÁRIO: 💰 300/RODADA" in 4px cyan

CRT effects. pt-BR.
```

---

## 16 — Predictions / Apostas

**Description:** Bet on upcoming and live match results using in-game coins. The game's prediction/betting system.

**Layout:** CRT frame. Three tabs: ABERTAS (open bets), ATIVAS (active), HISTÓRICO (history).

**Content Sections:**
1. **Balance + Stats Row:** Current bet balance, win rate, total won
2. **Prediction Cards:** Each card shows: match (team vs team with badges), prediction odds for each outcome (Casa/Empate/Fora), stake input, "APOSTAR" button
3. **Active Bets:** Cards showing bets placed, waiting for outcome
4. **History:** Past bets — green for win, red for loss, with amounts

### omma.build Prompt

```
Design the Predictions / Betting screen (Apostas) for "FalaMestre!" — retro arcade Brazilian football game. Full-screen mobile (844×390px landscape), CRT cabinet, scanlines, vignette. Font: Press Start 2P throughout.

(Embed full Design System from DESIGN_SYSTEM.md here)

COLORS: navy #00381a, gold #FFDF00, cyan #55e0a0.

HEADER:
  "🎯 APOSTAS" in 7px gold, centered
  Balance + stats row (frosted glass, full-width, height 44px, 3 equal sections):
    "💰 4.500 SALDO" in 6px gold | "62% APROVEIT." in 5px cyan | "💰 12K GANHOS" in 5px gold

TABS (3 tabs): "ABERTAS" (active gold) | "ATIVAS" | "HISTÓRICO" — Press Start 2P 4px, height 36px

PREDICTION CARDS LIST (scrollable):
  Each prediction card (frosted glass, full-width, border-radius 8px, border 1px rgba(255,223,0,0.30), padding 12px, margin-bottom 10px):

    MATCH HEADER (row):
      Left badge (20×20px home team dot) + "FLAMENGO" in 5px white
      "VS" in 5px muted gold, centered
      Right badge (20×20px away team dot) + "PALMEIRAS" in 5px white
      Round label: "RD. 15 · DOM 15H" in 3px cyan, right-aligned or below

    ODDS ROW (3 equal buttons, full-width, 8px gap):
      Each odds button (height 44px, border-radius 6px):
        SELECTED state: gold fill, navy text, gold box-shadow glow
        UNSELECTED: rgba(255,223,0,0.08) fill, gold border, gold text
        Layout: outcome label in 4px (top center) + odds value in 9px bold (bottom center)
        Casa: "CASA" / "1.85" (selected)
        Empate: "EMPATE" / "3.20"
        Fora: "FORA" / "2.40"

    STAKE SECTION (row):
      "VALOR:" in 4px cyan | coin input field (60px wide, gold border, number, right-aligned) | "💰" pixel icon
      Quick amount chips: "500" "1000" "2000" — small gold-bordered chips, 24px height

    POTENTIAL WIN (right-aligned):
      "GANHO POTENCIAL: 💰 925" in 4px gold

    APOSTAR button (full-width, height 36px, gold fill, navy text, "APOSTAR →" 5px):
      If no selection: disabled (muted)

  Show 2-3 prediction cards.

HISTORY TAB (show as secondary view):
  Each history row: match name | outcome badge ("✓ VITÓRIA" green or "✗ DERROTA" red) | bet amount | win/loss amount (green positive, red negative)

CRT effects. pt-BR.
```

---

## 17 — Investments / Investir

**Description:** In-game investment system. Invest in-game coins for daily yield returns. Multiple investment tiers with different rates.

**Layout:** CRT frame. Investment portfolio overview + tier selection cards.

**Content Sections:**
1. **Portfolio Summary:** Total invested, daily yield, total earned
2. **Investment Tiers Grid:** 4 tier cards (Standard, Silver, Gold, Platinum) — each showing rate/day, min investment, lock period, "INVESTIR" button
3. **My Investments:** List of active investments with daily claim buttons
4. **Claim All Button:** "RESGATAR TODOS OS RENDIMENTOS" if any are ready to claim

### omma.build Prompt

```
Design the Investments screen (Investir) for "FalaMestre!" — retro arcade football game. Full-screen mobile (844×390px landscape), CRT cabinet. Font: Press Start 2P throughout.

(Embed full Design System from DESIGN_SYSTEM.md here)

COLORS: navy #00381a, gold #FFDF00, cyan #55e0a0.

HEADER:
  "📈 INVESTIMENTOS" in 7px gold, centered
  "Investimentos & Rendimentos" in 5px cyan

PORTFOLIO SUMMARY (frosted glass card, full-width, ~90px, 3-column):
  "💰 25.000 INVESTIDO" in 5px gold | "💰 +350/DIA RENDIMENTO" in 5px cyan | "💰 8.200 TOTAL GANHO" in 5px gold
  Below: thin green horizontal bar showing "Portfólio saudável" at 80% fill

INVESTMENT TIERS (2×2 grid, 16px gap):
  TIER 1 — "STANDARD" (bronze accent):
    Border: rgba(205,127,50,0.5) (bronze)
    Top: "STANDARD" in 5px gold | "⭐" rating indicator
    Rate: "1.2%/DIA" in 10px gold glow
    Min: "💰 MIN. 500" in 4px cyan
    Period: "SEM BLOQUEIO" in 4px white
    Button: "INVESTIR" bronze-border, gold text

  TIER 2 — "PRATA" (silver accent):
    Border silver rgba(192,192,192,0.5)
    "PRATA" | "⭐⭐"
    "1.8%/DIA" bigger font
    "💰 MIN. 2.000" | "30 DIAS"
    Button "INVESTIR" silver-border

  TIER 3 — "OURO" (gold, highlighted):
    Border bright gold #FFDF00, box-shadow: 0 0 12px rgba(255,223,0,0.4)
    "OURO" in gold | "⭐⭐⭐" | "POPULAR" badge (red pill, top-right)
    "2.5%/DIA" in 14px gold strong glow
    "💰 MIN. 5.000" | "60 DIAS"
    Button "INVESTIR" gold-fill, navy text

  TIER 4 — "PLATINA" (teal/cyan accent):
    Border cyan #55e0a0
    "PLATINA" | "⭐⭐⭐⭐"
    "3.5%/DIA" in 12px cyan glow
    "💰 MIN. 10.000" | "90 DIAS"
    Button "INVESTIR" cyan-border

MY INVESTMENTS SECTION (below grid):
  Title "MEUS INVESTIMENTOS" 5px cyan
  Active investment row: "OURO · 💰 10.000 · +250 HOJE" | "RESGATAR" button (green, if available) or "AGUARDAR 28D" (muted, if locked)

CLAIM ALL BUTTON (if any claimable): full-width gold fill "🎁 RESGATAR TODOS · 💰 +350", pulsing glow

CRT effects. pt-BR.
```

---

## 18 — Daily Reward Modal

**Description:** A celebratory popup that appears once per day when the user logs in. Shows the current streak and the reward being claimed.

**Layout:** Centered modal overlay, ~70% of screen height. Dramatic presentation with animation.

**Content Sections:**
1. **Streak Visual:** "DIA 7 DE 7" flame icon, animated streak counter
2. **Reward Display:** Large animated coin pile or chest pixel art, "💰 +500" in large gold
3. **Streak Calendar:** 7 small boxes showing the week, days earned checkmarked in gold
4. **"RESGATAR" CTA Button**
5. **Bonus Multiplier Note:** "🔥 BÔNUS DE SEQUÊNCIA ×2 ATIVO" if streak bonus active

### omma.build Prompt

```
Design a Daily Reward Modal for "FalaMestre!" — retro arcade football game. Centered overlay modal (width 85%, max 340px, height auto ~520px) on a darkened CRT screen background (scanlines visible behind). Modal: frosted glass rgba(0,10,5,0.96), border 2px solid #FFDF00, border-radius 14px, padding 24px. Font: Press Start 2P throughout.

(Embed full Design System from DESIGN_SYSTEM.md here)

HEADER:
  "🎁 RECOMPENSA DIÁRIA" in 7px gold, centered, glow
  "Dia 7 de sequência" in 5px cyan below

STREAK CALENDAR ROW (7 boxes, full-width, equal spacing):
  Each box (32×32px, border-radius 4px):
    Completed days: gold fill #FFDF00, white check pixel ✓, day label "SEG" in 3px navy below
    Today (day 7): pulsing gold border + glow, gold fill, ✓
    Future days: muted border rgba(255,223,0,0.20), dark fill

REWARD DISPLAY (centered, height ~120px):
  Large pixel-art treasure chest (60×60px) — golden chest, pixel art style, lid slightly open, gold particles floating upward (animated particles)
  "💰 +500" in 20px Press Start 2P gold, strong glow (text-shadow: 0 0 15px #FFDF00, 0 0 30px rgba(255,215,0,0.6))
  Below: "MOEDAS DO JOGO" in 5px cyan

BONUS BANNER (frosted glass pill, full-width):
  "🔥 BÔNUS DE SEQUÊNCIA ×2 ATIVO!" in 5px gold
  Background: rgba(255,100,0,0.15) orange tint, border 1px rgba(255,165,0,0.5)

PROGRESS TO NEXT BONUS:
  "PRÓXIMO BÔNUS EM: DIA 14" in 4px cyan
  Progress bar: gold fill at 50% (7/14 days), 6px height, full-width

CTA BUTTON:
  "✨ RESGATAR 💰 500" — full-width, 48px height, gold fill #FFDF00, navy text, Press Start 2P 7px, border-radius 6px, pulsing glow box-shadow

CLOSE: "✕" icon top-right corner, 4px muted gold

CRT grain + vignette visible behind the modal. pt-BR.
```

---

## 19 — Achievement Toast / Notification

**Description:** Non-blocking notification popups that appear at the top or bottom of any screen. Used for achievements unlocked, match events, rewards received, and system messages.

**Layout:** Fixed position overlay, does not block interaction, auto-dismisses after 3-4 seconds.

**Types:**
- **Achievement Unlocked:** Trophy icon, achievement name, brief description — slides in from top
- **Reward Received:** Coin icon, amount, source — compact, bottom
- **Warning/Error:** Red accent, error message — top

### omma.build Prompt

```
Design a set of Toast Notification components for "FalaMestre!" — retro arcade football game. Show 3 variants stacked vertically (with space between them), positioned in the top area of a 844×390px landscape screen. CRT game background visible behind. Font: Press Start 2P throughout.

(Embed full Design System from DESIGN_SYSTEM.md here)

TOAST 1 — ACHIEVEMENT UNLOCKED (slides in from top, gold accent):
  Width: 90% screen width, centered
  Background: rgba(0,18,8,0.95), blur 14px, border 1px solid #FFDF00, border-radius 8px, padding 10px 14px
  Left: pixel trophy icon 🏆 (24px, gold glow)
  Right of icon:
    "CONQUISTA DESBLOQUEADA!" in 5px cyan
    "ARTILHEIRO: 10 GOLS NA TEMPORADA" in 6px gold, glow
  Right edge: gold particle burst animation (small ✦ pixels radiating out)
  Bottom: thin gold progress bar fading (shows time until dismiss, 4 seconds)

TOAST 2 — REWARD RECEIVED (compact, simpler):
  Width: 70%, right-aligned
  Background: rgba(0,18,8,0.90), border 1px solid rgba(255,223,0,0.40), border-radius 6px, padding 8px 12px
  "💰 +500 RECEBIDOS" in 6px gold, single line
  Subtle coin pixel animation on left

TOAST 3 — WARNING/ERROR:
  Width: 90%, centered
  Background: rgba(40,0,0,0.95), border 1px solid #FF3333, border-radius 8px, padding 10px 14px
  Left: pixel ⚠️ warning icon, red (#FF3333)
  "JOGADOR LESIONADO!" in 5px #FF3333
  "ROBERTO NEYMAR — 2 RODADAS" in 6px white

All toasts have: Press Start 2P font, pixel-art icons (no flat icons), CRT scanline texture visible through the semi-transparent backgrounds. Shown entering from the top with a slide-down animation (translateY: -100% → 0).
```

---

## 20 — Settings Panel

**Description:** A slide-in side drawer or bottom sheet with game preferences. Sound, notifications, language, account info.

**Layout:** Slides in from the right (drawer). ~85% screen width. Dark frosted glass.

**Content Sections:**
1. **Profile Header:** Avatar (pixel art), username, team badge, email
2. **Game Settings:** Sound toggle, Music toggle, Notification toggle, Match Speed default (×1/×2/×4)
3. **Account Section:** "Sair da Conta" button
4. **Version Info + Credits**

### omma.build Prompt

```
Design a Settings Drawer panel for "FalaMestre!" — retro arcade football game. Slides in from the right side of a 844×390px landscape screen. Width: 85% (331px), full height, background rgba(0,8,3,0.97) backdrop-filter blur(20px), left border 2px solid rgba(255,223,0,0.35), shadow on left. Font: Press Start 2P throughout. CRT scanlines subtly visible over the panel.

(Embed full Design System from DESIGN_SYSTEM.md here)

DRAG HANDLE: small 4×32px rounded bar, rgba(255,223,0,0.40), centered vertically on the left edge

PROFILE HEADER (padding 24px, border-bottom 1px rgba(255,223,0,0.20)):
  Pixel avatar: 48×48px green circle with jersey number "10" or user initials, gold border 2px
  "VICTOR BENDAS" in 7px gold, glow
  "FLAMENGO FC" in 5px cyan below name
  "victor@email.com" in 4px muted gold

SETTINGS SECTIONS:

  Section "JOGO" — label in 4px cyan, uppercase, border-bottom 1px muted:
    Toggle row: "SOM" label 5px gold | toggle switch (gold when ON: solid gold track, gold knob; OFF: muted track) — right-aligned
    Toggle row: "MÚSICA"
    Toggle row: "NOTIFICAÇÕES"

  Section "PARTIDA":
    "VELOCIDADE PADRÃO" 5px gold label
    Speed selector: 3 pill buttons "×1" | "×2" | "×4" — active pill gold fill, inactive gold border, Press Start 2P 5px, height 28px

  Section "VR MODE":
    Toggle: "MODO VR" — same toggle style
    Note: "REQUER CÂMERA" in 4px cyan

DIVIDER (1px rgba(255,223,0,0.15))

DANGER ZONE:
  "SAIR DA CONTA" button — full-width, height 40px, border 1px #FF3333, color #FF3333, transparent background, Press Start 2P 5px
  "RESETAR PROGRESSO" button — full-width, height 40px, muted styling (rgba(255,223,0,0.15) border, muted text), very subtle

VERSION (bottom, centered):
  "FALA MESTRE! v0.9.0" in 4px muted gold
  "Feito com ❤️ para o futebol" in 3px muted cyan

CRT scanlines over the drawer. pt-BR.
```

---

## 21 — Season End / Promotion Screen

**Description:** Full-screen dramatic presentation shown at the end of the 38-game season. Celebrates promotion, relegation, or season completion. One of the most important emotional moments in the game.

**Layout:** Full-screen CRT. Pure celebration/result screen — no navigation chrome.

**States:**
- **Promotion:** Gold confetti, "PROMOVIDO!" in massive text, fireworks animation
- **Relegation:** Somber dark screen, "REBAIXADO" in subdued red
- **Stayed Up:** Neutral congratulation

### omma.build Prompt

```
Design the Season End / Promotion screen for "FalaMestre!" — retro arcade Brazilian football game. Full-screen mobile (844×390px landscape), CRT cabinet, but MORE dramatic than usual. Show the PROMOTION state. Font: Press Start 2P throughout.

(Embed full Design System from DESIGN_SYSTEM.md here)

BACKGROUND: The usual CRT navy #00381a base but with animated gold pixel-art confetti raining down: small 4×4px and 6×6px colored squares in gold #FFDF00, green #00A859, cyan #55e0a0, falling at different speeds. Scanlines still present but lighter (10% opacity).

FIREWORKS: Pixel-art firework bursts at top corners — radiating pixel dots in gold and green, animated expanding rings of pixels.

CENTER CONTENT (full-height flex, centered):
  TOP SECTION (spacing):
    League badge pill: "SÉRIE D" in 5px, gold border, muted fill (the old league)
    Arrow down: large pixel "↓" in gold (pointing to new league)

  MAIN CELEBRATION (center):
    Team badge (large, 80×80px pixel art, gold border, gold glow)
    "PROMOVIDO!" in 28px Press Start 2P gold — strong glow: text-shadow: 0 0 20px #FFDF00, 0 0 50px rgba(255,215,0,0.5)
    Pulsing scale animation (1.0 → 1.06 → 1.0, 0.8s loop)

    New league: "SÉRIE C" in 14px gold below
    Season record: "TEMPORADA 2024 · W22 E8 P8" in 5px cyan

  STATS CARDS ROW (3 mini cards, frosted glass):
    "1° ARTILHEIRO: R. NEYMAR 18 GOLS" | "MELHOR VITÓRIA: 5-0" | "INVICTO: 8 PARTIDAS"
    Each in 4px gold/cyan

  REWARDS SECTION:
    "RECOMPENSAS DA TEMPORADA" in 5px cyan
    "💰 +15.000" in 14px gold glow | "3 JOGADORES BÔNUS" in 6px cyan | "🏆 TÍTULO: CAMPEÃO SÉRIE D" in 6px gold

ACTIONS (bottom section):
  "CONTINUAR PARA SÉRIE C →" — full-width, 48px, gold fill, navy text, Press Start 2P 6px, glow
  "VER ESTATÍSTICAS COMPLETAS" — transparent, gold border, 36px

All pt-BR. Maximum drama. This screen should feel like winning the World Cup.
```

---

## 22 — Phase Unlock Modal

**Description:** Appears when the user unlocks a new game phase or feature. Explains what was unlocked and shows new capabilities.

**Layout:** Centered modal overlay, ~75% screen height. Dark dramatic background.

**Content Sections:**
1. **Phase Badge:** Large animated pixel badge with new phase name
2. **"NOVA FASE DESBLOQUEADA" header**
3. **What's New:** List of newly unlocked features with pixel icons
4. **CTA:** "EXPLORAR AGORA →"

### omma.build Prompt

```
Design a Phase/Feature Unlock Modal for "FalaMestre!" — retro arcade football game. Centered modal on darkened CRT screen (background rgba(0,0,0,0.80), scanlines behind). Modal: frosted glass rgba(0,10,5,0.96), border 2px solid #FFDF00, border-radius 14px, width 88%, padding 24px, height auto. Font: Press Start 2P throughout.

(Embed full Design System from DESIGN_SYSTEM.md here)

GLOW AURA: Modal has strong gold outer glow: box-shadow: 0 0 40px rgba(255,223,0,0.25), 0 0 80px rgba(255,223,0,0.10)

TOP BADGE (centered):
  Large hexagonal pixel badge (80×80px) — gold hexagon outline, dark navy fill, centered icon inside (pixel star or lightning bolt), animated rotation: subtle 360° spin over 8s.
  Phase label below badge: "FASE 3" in 8px gold glow

HEADER:
  "🔓 NOVA FASE" in 6px cyan, centered
  "DESBLOQUEADA!" in 14px Press Start 2P gold, centered, strong glow
  Horizontal gold separator line

PHASE NAME:
  "MODO TORNEIO" in 9px gold, centered (example feature name)

FEATURES LIST (what's now unlocked):
  Each feature row (height 36px, border-bottom 1px rgba(255,223,0,0.10)):
    Left: pixel icon (16×16px) in gold — unique per feature
    Text: feature name in 5px white | short description in 4px cyan below name
    Right: "NOVO" gold badge (3px, gold fill, navy text, border-radius 3px)

  Feature 1: "⚽ TORNEIO ELIMINATÓRIO — Dispute copas com outros times"
  Feature 2: "📊 ESTATÍSTICAS AVANÇADAS — Análise detalhada do elenco"
  Feature 3: "🌟 MERCADO ELITE — Acesso a jogadores 85+ overall"

CTA BUTTON:
  "EXPLORAR AGORA →" — full-width, 48px, gold fill, navy text, Press Start 2P 6px, border-radius 6px
  Pulsing glow animation

CLOSE: small "DEPOIS" text link, muted gold 4px, centered below button

CRT scanlines through modal. pt-BR.
```

---

## Summary & Workflow

### Generation Order (by dependency)
1. **App Shell (05)** — defines nav chrome reused everywhere
2. **Login (02)** — first user touchpoint
3. **Onboarding (03)** — second touchpoint
4. **Dashboard (04)** — main hub
5. **Squad (06) + Player Modal (07)** — core game loop
6. **Match Preview (08)** — leads into Match Simulation
7. **Match Result (09)** — ends match flow
8. **Transfer Market (10) + Standings (11)** — secondary game loop
9. **Stadium (12) + Facilities (13) + Youth (14) + Staff (15)** — management views
10. **Predictions (16) + Investments (17)** — engagement
11. **Modals & overlays (18, 19, 22)** — polish
12. **Season End (21)** — special moment
13. **Settings (20)** — utility

### Integration Notes
- All screens output pure HTML/CSS/JS from omma.build
- CRT effects are defined once in a shared CSS file and imported
- The `Press Start 2P` font link is in every HTML `<head>`
- Each screen lives in `screens/<ScreenName>/index.html`
- Design tokens (CSS variables) should be extracted to `screens/shared/tokens.css`
- Animation keyframes shared in `screens/shared/animations.css`
