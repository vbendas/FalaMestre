# Fala Mestre! - MVP Technical Spike

This is the working implementation of the Fala Mestre! conversational football management game.

## What's Built

✅ **Working Features:**
- Next.js 14 app with TypeScript
- Neon PostgreSQL database with Drizzle ORM
- Chat interface with message history
- Match simulation engine (hardcoded)
- AI integration (mock mode for testing)
- User state persistence
- Points/rewards system
- Brazilian football context

✨ **Layout Enhancement (NEW):**
- **Team Branding:** Dynamic team badges, colors, and stadium info
- **Animated Header:** Pulsing notifications, gradient accents, animated counters
- **Enhanced Chat:** Message avatars, action buttons with icons, typing indicators
- **Squad Dashboard:** Stat cards with trends, player cards with ratings, formation view
- **Match Experience:** VS screen with team comparison, animated result modal with confetti
- **Smooth Animations:** Framer Motion throughout for polished UX
- **Responsive Design:** Mobile-optimized with touch-friendly targets

## Architecture

```
app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── conversation/     # AI chat endpoint
│   │   │   └── match/            # Match simulation endpoint
│   │   ├── page.tsx              # Main UI (thin shell)
│   │   ├── layout.tsx            # Root layout with metadata
│   │   └── globals.css           # Global styles
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   └── game/                 # Game-specific components
│   │       ├── Header.tsx        # Team header with badge
│   │       ├── ViewTabs.tsx      # Navigation tabs
│   │       ├── ChatView.tsx      # Chat interface
│   │       ├── SquadView.tsx     # Squad dashboard
│   │       ├── MatchView.tsx     # Match preview
│   │       ├── MatchResultModal.tsx  # Match result overlay
│   │       ├── LoadingScreen.tsx     # Loading state
│   │       └── Footer.tsx        # App footer
│   ├── hooks/
│   │   └── useGameState.ts       # Game state management
│   ├── db/
│   │   ├── schema.ts             # Database tables
│   │   └── index.ts              # Drizzle client
│   └── lib/
│       ├── ai-service.ts         # AI integration (mock/real)
│       ├── game-engine.ts        # Match simulation
│       ├── types.ts              # TypeScript types
│       └── team-data.ts          # Team assets & colors
├── public/
│   └── teams/                    # Team badge SVGs
│       ├── leoes.svg
│       ├── falcoes.svg
│       ├── trovao.svg
│       ├── mare.svg
│       ├── serra.svg
│       └── estrela.svg
├── drizzle/                      # Database migrations
└── .env.example                  # Environment variables
```

## Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Animation:** Framer Motion for smooth transitions and micro-interactions
- **Charts:** Recharts for data visualization (future)
- **Backend:** Next.js API Routes (serverless)
- **Database:** Neon PostgreSQL (serverless)
- **ORM:** Drizzle ORM
- **AI:** OpenRouter (zhipu/glm-4.7) - Mock mode for testing
- **Deployment:** Vercel

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file:

```env
# Database
DATABASE_URL=your_neon_database_url

# AI API (optional for mock mode)
OPENROUTER_API_KEY=your_openrouter_key
```

Get your DATABASE_URL from [Neon Console](https://console.neon.tech/).

### 3. Set Up Database

```bash
# Generate migrations
npm run db:generate

# Run migrations
npm run db:migrate
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Usage

1. **First Visit:** The app creates a user ID and stores it in localStorage
2. **Chat:** Type "Olá!" or any message to start
3. **Play Match:** Click the "Jogo" tab and press "JOGAR AGORA"
4. **View Squad:** Click the "Elenco" tab to see team stats
5. **Earn Points:** Win matches to earn points

## API Endpoints

### POST /api/conversation
Send a message to the AI assistant.

**Request:**
```json
{
  "userId": "user_abc123",
  "message": "Quero jogar uma partida",
  "useMock": true
}
```

**Response:**
```json
{
  "response": "⚽ Vamos jogar! Seu time está pronto...",
  "actions": ["play_match", "view_squad"],
  "intent": "play_match",
  "cost": 0,
  "latency": 245,
  "gameState": { ... }
}
```

### GET /api/conversation?userId=...
Get current game state and conversation history.

### POST /api/match
Simulate a football match.

**Request:**
```json
{
  "userId": "user_abc123"
}
```

**Response:**
```json
{
  "result": {
    "homeScore": 2,
    "awayScore": 1,
    "winner": "Dragões do Cerrado",
    "events": ["12' - João Silva marca!"]
  },
  "pointsEarned": 3,
  "pointsChange": 100,
  "narration": "Seu time venceu por 2x1...",
  "nextMatch": { ... },
  "updatedGameState": { ... }
}
```

## Database Schema

### users
- `id` (UUID, primary key)
- `email` (TEXT, unique)
- `username` (TEXT)
- `onboarding_completed` (BOOLEAN)
- `created_at` (TIMESTAMP)

### game_states
- `user_id` (UUID, primary key, references users)
- `team` (TEXT)
- `current_state` (JSONB) - Complete game state
- `conversation_history` (JSONB[]) - Message history
- `statistics` (JSONB)
- `updated_at` (TIMESTAMP)

### conversations
- `id` (UUID, primary key)
- `user_id` (UUID, references users)
- `message_type` (TEXT) - 'user' or 'ai'
- `content` (TEXT)
- `intent` (TEXT)
- `game_state_snapshot` (JSONB)
- `created_at` (TIMESTAMP)

### analytics_events
- `id` (UUID, primary key)
- `user_id` (UUID, references users)
- `event_type` (TEXT)
- `properties` (JSONB)
- `session_id` (TEXT)
- `created_at` (TIMESTAMP)

## Game Mechanics

### Match Simulation
```
Team Power = Σ(Player Attributes × Position Weight × Morale)
Goal Probability = (Attack / Defense) + Random + Home Advantage
```

### Points System
- Win: +100 points, +3 league points
- Draw: +50 points, +1 league point
- Loss: +20 points, +0 league points

### Teams (Fictional - IP-Safe)
**User-created teams:** Players create their own team with custom name, colors, and badge

**PvE Opponents:**
- Leões do Norte (Gold/Green - Traditional powerhouse)
- Falcões de Aço (Silver/Black - Defensive, disciplined)
- Trovão FC (Purple/White - Fast, aggressive)
- Maré Alta (Blue/Cyan - Possession-based)
- Serra Brava (Red/Orange - Physical, passionate)
- Estrela do Sul (White/Gold - Technical, elegant)

*Note: Fictional teams avoid using any real club's trademarks.*

## Next Steps for Production

### 1. Enable Real AI
- Set `useMock: false` in API calls
- Add OpenRouter API key to `.env`
- Implement caching (Redis/Vercel KV)

### 2. Add Features
- Transfer market
- Training system
- Player development
- Season progression
- Leaderboards

### 3. Improve UX
- Rive animations for characters
- Sound effects
- Push notifications
- Social sharing

### 4. Analytics
- First-party gameplay analytics (stored in the app database)
- A/B testing framework

### 5. Legal & Compliance
- GDPR consent flow
- Terms of service
- Privacy policy
- Age verification

## Cost Estimates

### Development
- MVP: $15,000 (estimated)
- Timeline: 8-10 weeks

### Monthly Operating (1000 users)
- AI API: $100-200 (with caching)
- Database: $20-50
- Hosting: $20-50
- Analytics: $50-100
- **Total: $200-400/month**

### Cost Per User
- Acquisition: $0.50-1.00
- API Usage: $0.10-0.20/month
- Infrastructure: $0.05/month
- **Total: $0.15-0.25/month**

## Testing

### Manual Testing
1. Start app: `npm run dev`
2. Open browser: http://localhost:3000
3. Test chat flow
4. Test match simulation
5. Test state persistence (refresh page)

### API Testing
```bash
# Test conversation endpoint
curl -X POST http://localhost:3000/api/conversation \
  -H "Content-Type: application/json" \
  -d '{"userId": "test_123", "message": "Olá!", "useMock": true}'

# Test match endpoint
curl -X POST http://localhost:3000/api/match \
  -H "Content-Type: application/json" \
  -d '{"userId": "test_123"}'
```

## Known Limitations (MVP)

1. **Mock AI Mode:** Uses simulated responses (no API key needed)
2. **Hardcoded Teams:** Only 5 Brazilian teams available
3. **Simple Match Engine:** Basic probability-based simulation
4. **No Animations:** Text-only interface
5. **No Real Token Integration:** Points are gamified only
6. **Basic Analytics:** Session-level tracking only

## Success Metrics

### MVP Goals
- ✅ Working conversational interface
- ✅ Match simulation with AI narration
- ✅ Points/rewards system
- ✅ User state persistence
- ✅ Brazilian football context

### Beta Targets (100 users)
- D7 Retention: 35%+
- Session Length: 15+ minutes
- Match Completion: 50%+
- Positive Feedback: 70%+

### Production Targets (10,000 users)
- CAC: <$1
- LTV: >$20
- Token Conversion: 15-20%
- Viral Coefficient: >1.0

## Support

For questions or issues:
- Check the PRD in parent directory
- Review Documentation folder
- Contact: Victor Bendas

---

**Status:** MVP Technical Spike - Ready for Testing  
**Version:** 0.1.0  
**Last Updated:** January 2026
