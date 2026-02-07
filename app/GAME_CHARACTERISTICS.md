# Fala Mestre! - Game Characteristics Prompt

## Core Concept
**Fala Mestre!** is a conversational AI-driven football management game where players manage a Brazilian football team through a season in the Brasileirão Serie A. The game combines natural language interaction with deep simulation mechanics, allowing players to chat with an AI coach, make strategic decisions, and watch their team compete in matches.

---

## Game Identity & Tone
- **Setting:** Brazilian football (futebol brasileiro)

## User Team Creation

Players create their own team with:
1. **Custom team name** - Free text input (e.g., "Dragões do Cerrado")
2. **Primary & secondary colors** - Color picker with presets
3. **Badge style** - Shield, circle, diamond, or crest templates
4. **Optional mascot** - Eagle, lion, bull, jaguar, dragon, wolf

All player teams are fictional/user-created with zero third-party IP.
- **Language:** Brazilian Portuguese (passionate, authentic, emotional)
- **Vibe:** Like having a conversation with a passionate football coach
- **Visual Style:** Dark theme with team colors, dynamic badges, smooth animations

---

## Core Game Mechanics

### 1. **Conversational Management**
Players interact with the game primarily through chat:
- Type natural language commands ("Quero jogar uma partida", "Mostrar meu elenco")
- AI responds with narrative context, advice, and available actions
- Context-aware responses based on game state (morale, position, next opponent)

### 2. **Match Simulation System**
- **Duration:** 90-minute matches with minute-by-minute probability calculations
- **Algorithm:** Probabilistic goal scoring based on team power comparison
- **Events:** Goals (forwards have higher chance), yellow cards, match narrative
- **Home Advantage:** 10% power boost for home team
- **Visual:** VS screen pre-match, animated result modal with confetti on win

### 3. **Team Power Calculation**
```
Team Power = Σ(Player Attributes × Position Weight) × Morale × Fitness

Position Weights:
- Goalkeeper (GK): 0.8
- Defender (DEF): 1.0  
- Midfielder (MID): 1.1
- Forward (FWD): 1.2
```

### 4. **Player System**
Each player has FIFA-style attributes (50-99 range):
- **Core:** Pace, Shooting, Passing, Dribbling, Defending, Physical
- **Hidden:** Potential, Consistency, Big Match Player, Leadership, Injury Proneness
- **Generation:** Random Brazilian names with position-appropriate base ratings

---

## Squad Management

### Formation & Structure
- **Default Formation:** 4-3-3 (1 GK, 4 DEF, 3 MID, 3 FWD)
- **Squad Size:** 11 players
- **Metrics:** 
  - Morale (0-100%): Affects team performance, changes based on results
  - Fitness (0-100%): Physical condition (future feature)

### Management Actions
1. **View Squad** - See player cards with ratings and attributes
2. **Formation View** - Visual pitch with player positions
3. **Training** (placeholder) - Improve player attributes
4. **Transfer Market** (placeholder) - Buy/sell players

---

## Progression & Rewards

### Season Structure
- **League:** Brasileirão Serie A
- **Timeline:** Week-by-week progression
- **Starting Point:** Week 1, Position 10th, 0 points
- **Opponents:** 6 fictional teams (Leões do Norte, Falcões de Aço, Trovão FC, Maré Alta, Serra Brava, Estrela do Sul)

### Points System
**Socios Points (in-game currency):**
- Win: +100 points
- Draw: +50 points
- Loss: +20 points

**League Points:**
- Win: 3 points
- Draw: 1 point
- Loss: 0 points

### Season Flow
1. View next match opponent
2. Make tactical decisions (via chat)
3. Play match
4. See results and earn points
5. Morale updates (wins boost, losses hurt)
6. Next match scheduled randomly
7. Repeat

---

## AI Coach Features

### Personality
- Passionate Brazilian football coach persona
- Uses emojis for visual appeal
- Provides 2-4 contextual action options after each message
- Tracks player behavior patterns (playing style, spending, engagement)

### Intent Recognition
The AI understands:
- Match commands ("jogar", "partida")
- Squad queries ("elenco", "time")
- Tactical preferences ("agressivo", "defensivo", "equilibrado")
- Transfer interest ("comprar", "vender", "mercado")

### Behavioral Analytics
Tracks and classifies:
- Playing style (aggressive/defensive/balanced)
- Spending behavior (conservative/aggressive)
- Engagement level (casual/regular/hardcore)
- Decision speed (quick/thoughtful/analytical)

---

## User Experience

### Visual Design
- **Header:** Team badge, animated points counter, week/position display
- **Navigation:** Chat / Squad / Match tabs with icons
- **Chat Interface:** Avatar bubbles, action buttons with icons, typing indicators
- **Squad View:** Stat cards with trends, player cards with mini attribute bars, formation pitch
- **Match View:** VS screen with team badges, comparison bars, pulsing play button
- **Results:** Full-screen modal with animated scoreboard, goal timeline, confetti

### Animations & Polish
- Framer Motion throughout for smooth transitions
- Animated counters for stats and points
- Pulsing notifications for pending matches
- Confetti celebration on match wins
- Loading screen with progress bar

---

## Technical Highlights

- **State Persistence:** Game state saved to database, survives page refresh
- **Mock AI Mode:** Works without API keys for testing
- **Responsive:** Mobile-optimized with touch-friendly targets
- **Performance:** Server-side rendering with client-side hydration

---

## Demo-Ready Features (Current)

✅ Full conversational interface  
✅ Match simulation with events  
✅ Squad management with visual formation  
✅ Points and progression system  
✅ Animated UI with team branding  
✅ Match result celebrations  
✅ Brazilian football authenticity  

---

## Summary

This game offers a unique blend of **conversational AI** and **football management simulation**, making complex management games accessible through natural language while maintaining depth in the simulation mechanics.

---

## IP Protection Note

This game uses **zero third-party intellectual property**. All teams, player names, and stadiums are either user-created or fictional. This design eliminates all licensing risks and positions official branding as a premium upgrade through Socios.com partnership. See `Documentation/04-Business/19-IP-Protection-Team-Naming-Strategy.md` for details.
