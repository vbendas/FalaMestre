# IP Protection & Team Naming Strategy

---
tags: #business #legal #ip #naming #strategy #clubs #players
status: complete
priority: critical
phase: mvp
last_updated: 2026-02-07
---

## Executive Summary

Fala Mestre! operates with **zero third-party intellectual property exposure**. We avoid all real football club names, logos, player names, and likenesses. This is not a temporary workaround—it's a core strategic decision that:

1. **Eliminates all IP liability** from clubs, leagues, and players
2. **Enables immediate launch** without licensing negotiations
3. **Lets the code and assets be shared openly**, since nothing in them belongs to a club, league or player

---

## The Problem We're Solving

### Why Brasfoot/Elifoot Approach Doesn't Work for Us

Indie games like Brasfoot and Elifoot have used real team names for decades without legal action. However:

- **They operate on tolerance, not legality** — clubs choose not to sue, but legally could at any moment
- **Public code matters** — club names and badges committed to an open repository would be redistributed with every copy
- **Clean by default** — avoiding real branding from day one is cheaper than removing it later

**The test courts apply:** *Would a reasonable person identify which club/player is being referenced?*

Using "Mengão" + red/black stripes clearly = Flamengo. Using "Vinicius Jr" in a football context = the Real Madrid player. Both infringe.

---

## Our Three-Layer IP Protection Strategy

### Layer 1: User Teams (Fully Customizable)

Every player creates their own team:

1. **Team Name** — Free text input with suggestions
2. **Primary & Secondary Colors** — Color picker or preset options
3. **Badge Shape** — Generic templates (shield, circle, diamond, crest)
4. **Mascot Archetype** (Optional) — Eagle, lion, bull, jaguar, wolf, dragon

**Example:**
> Player creates "Dragões do Cerrado" — colors: red/black, badge: shield, mascot: dragon

This is the player's IP, not ours, not any club's.

### Layer 2: PvE Opponents (Fictional Teams)

We created 6 original fictional teams for the game:

| Team Name | Colors | Play Style | Archetype |
|-----------|--------|------------|-----------|
| **Leões do Norte** | Gold/Green | Traditional powerhouse | Northern pride |
| **Falcões de Aço** | Silver/Black | Defensive, disciplined | Industrial strength |
| **Trovão FC** | Purple/White | Fast, aggressive | Storm/electric |
| **Maré Alta** | Blue/Cyan | Possession-based | Coastal |
| **Serra Brava** | Red/Orange | Physical, passionate | Mountain/fire |
| **Estrela do Sul** | White/Gold | Technical, elegant | Southern star |

These are original creations with no real-world club associations.

### Layer 3: PvP Matches (Custom vs Custom)

When players compete against each other, it's:
- Player A's custom team vs Player B's custom team
- Zero third-party IP involved

---

## Player Name Generation

### The Rule

**NO real footballer names or likenesses, ever.**

### Implementation

We use pools of common Brazilian names (already implemented in `game-engine.ts`):

**First names:** João, Pedro, Lucas, Gabriel, Matheus, Rafael, Diego, Felipe, André, Bruno, Carlos, Marcos, Thiago, Vinícius, Anderson, Wellington, José, Antônio, Francisco, Luiz

**Last names:** Silva, Santos, Oliveira, Souza, Rodrigues, Ferreira, Alves, Pereira, Lima, Costa, Gomes, Martins, Ribeiro, Almeida, Cardoso, Pinto, Carvalho, Melo, Dias, Nascimento

### Star Player Nicknames (Archetypes)

For standout players, we use evocative archetype nicknames:

| Nickname | Meaning | Archetype |
|----------|---------|-----------|
| **Raio** | Lightning | Fast striker |
| **O Mago** | The Magician | Creative playmaker |
| **Trovão** | Thunder | Powerful midfielder |
| **Paredão** | The Wall | Dominant goalkeeper |
| **Capitão** | Captain | Leader, defensive anchor |
| **Sombra** | Shadow | Defensive midfielder |
| **Foguete** | Rocket | Fast winger |
| **Muralha** | Fortress | Strong defender |
| **Pantera** | Panther | Agile striker |
| **Titan** | Titan | Physical midfielder |
| **Relâmpago** | Flash | Super fast player |

**Format in game:**
> "Lucas Ferreira 'Raio' (87 ST) — O artilheiro do seu time!"

---

## User Team Creation Flow

### Step 1: Choose Your Team Name

```
AI: "👋 E aí! Vamos começar.

Primeiro, qual vai ser o nome do seu time?

💡 Pode ser qualquer nome! Exemplos:
• Dragões do Cerrado
• Águias da Liberdade  
• Os Invencíveis do Sul

Ou digite o nome que quiser!"
```

### Step 2: Pick Your Colors

```
AI: "Show! Agora escolha as cores do seu time:

[🔴⚫ Vermelho e Preto]  [⚪🟢 Branco e Verde]
[🔵⚪ Azul e Branco]     [💛🟢 Amarelo e Verde]
[⚫⚪ Preto e Branco]     [🎨 Escolher outras cores]"
```

### Step 3: Choose Your Badge Style

```
AI: "Perfeito! Escolha o estilo do escudo:

[🛡️ Escudo Clássico]  [⭕ Círculo Moderno]
[🔷 Losango]          [🏛️ Brasão Elegante]"
```

### Step 4: Optional Mascot

```
AI: "Quer adicionar um mascote ao seu escudo?

[🦅 Águia]    [🦁 Leão]     [🐂 Touro]
[🐆 Onça]     [🐺 Lobo]     [🐉 Dragão]
[⏭️ Pular esta etapa]"
```

**Result:** Player has a unique, personalized team with zero IP risk.

---

## Comparison with Prior Art

### Brasfoot / Elifoot Model

| Aspect | Brasfoot Approach | Our Approach |
|--------|-------------------|--------------|
| Distribution | Closed binary | Public source repository |
| Risk tolerance | Can be shut down | Must be legally sound to share openly |
| Legal basis | Tolerance, not legality | Zero IP exposure strategy |

### PES / eFootball Model

Konami's Pro Evolution Soccer shipped for years with:
- "North London FC" (clearly Arsenal)
- "Man Blue" (clearly Man City)
- Generic kits and badges

**What happened:** The community created and distributed "option files" that restored real names. Konami stayed legally clean; fans got what they wanted.

**Our version:** Ship with fictional teams and user-created custom teams only. No official branding is planned.

---

## Legal Framework

### Trademarks We Avoid

| Category | Examples | Risk Level |
|----------|----------|------------|
| **Club logos** | Flamengo crest, Palmeiras badge, etc. | High — heavily trademarked |
| **Club names** | "Flamengo", "Corinthians", "São Paulo FC" | High — wordmarks protected |
| **Club slangs** | "Mengão", "Porco", "Timão", "Tricolor" | Medium-High — dilution claims |
| **Color + context** | Red/black stripes + football team | Medium — can imply association |
| **League names** | "Brasileirão", "Série A" | Medium — check specific jurisdictions |

### Image Rights We Avoid

| Category | Examples | Risk Level |
|----------|----------|------------|
| **Player names** | "Neymar", "Gabriel Barbosa", "Vinicius Jr." | High — image rights are strict |
| **Player nicknames** | "Gabigol", "O Fenômeno" | High — identify specific individuals |
| **Player likenesses** | Pixel art that looks like a real player | High — image right violations |
| **Stats + name combo** | "87 ST named Gabigol" | High — clear reference |

### What IS Safe

| Category | Examples | Why Safe |
|----------|----------|----------|
| **Fictional team names** | "Leões do Norte" | Original creation |
| **Generic color schemes** | Red/black, blue/white | Not protectable alone |
| **Common names** | "Lucas Ferreira", "João Silva" | No individual identification |
| **Archetype nicknames** | "Raio", "O Mago", "Paredão" | Not specific individuals |
| **City names** | "Rio de Janeiro" | Not trademarked |
| **Neighborhood names** | "Gávea", "Tatuapé" | Clubs don't own neighborhoods |

---

## Risk Mitigation Summary

| Risk | Mitigation | Residual Risk |
|------|------------|---------------|
| Trademark infringement | Zero real club names/logos/slangs | None |
| Image rights violation | Generated fictional player names only | None |
| Passing off claims | Fictional teams don't resemble real clubs | Low |

---

## Related Documents

- [[00-Core-Concept]] — Updated core concept with custom teams
- [[02-Onboarding-Flow]] — User team creation flow

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-07 | Adopt zero real IP strategy | Eliminate all liability |
| 2026-02-07 | Create 6 fictional PvE teams | Provide variety without real club references |
| 2026-02-07 | User-created custom teams | Player ownership, zero third-party IP |
| 2026-02-07 | Generated player names only | Avoid image rights violations |
| 2026-02-07 | Archetype nicknames for stars | Maintain emotional connection without real players |

---

*"We don't compete with clubs for their IP. We compete with boring onboarding experiences for players' attention."*