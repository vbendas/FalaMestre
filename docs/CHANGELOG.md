# Changelog

All notable changes to the Fala Mestre! project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- **Tactical instruction system**: 12 tactical instructions that directly affect match simulation outcomes through player stat modifiers, team power multipliers, and risk factors
  - Instructions: Pressão alta, Bloco baixo, Tique-taque, Contra-ataque, Bolas longas, Jogo pelas laterais, Finalizar de qualquer posição, Cera, Jogo no pivô, Liberdade total, Marcação individual, Sobreposição
  - Each instruction modifies specific player attributes (pac/sho/pas/dri/def/phy) before team power calculation
  - Team/opponent power multipliers adjust goal probability
  - Risk factor increases both teams' goal chance (high-risk = more exciting matches)
- **Cluster-based DecisionPrompt UI**: Decision options organized into expandable categories (Mentalidade, Formação, Táticas) instead of flat list
- **Client-side first decision**: Pre-game decision (minute 0) built client-side with zero API calls — instant display, no loading spinner
- **Richer decision options**: Always ≥2 meaningful options per turn, guaranteed mentality alternative + formation alternative + multiple tactical instructions
- **TurnBasedMatchFlow orchestrator**: State machine that chains 6 decision turns into a complete match flow (Decision → Segment → Summary → Decision → ... → Match End)
- **6 decision turns**: Pre-jogo (0'), Primeiros 15 min (15'), Avaliação tática (30'), Intervalo (45'), Segundo tempo (60'), Retas finais (75')

### Changed
- **Match simulation engine**: `simulateMatchSegment()` now applies tactical instruction stat modifiers to squad copy before calculating team power, plus team/opponent power multipliers and risk factor on goal probability
- **Decision engine**: `generateDecisionOptions()` returns 7-8 options per turn (1 mentality + 1 formation + 4-6 tactical instructions + keep setup)
- **Decision turn config**: MAX_OPTIONS increased from 3 to 8, TOTAL_TURNS remains 6
- **MatchView**: Removed `isCalculating` loading phase — clicking "JOGAR" instantly starts turn-based flow
- **DecisionPrompt**: Redesigned from flat option list to cluster-based expandable UI with animated category headers
- **TurnResult**: Extended with `tacticalInstruction` field carrying full instruction data
- **DecisionOption**: Extended with `tacticalInstruction?: TacticalInstructionType` field
- **DecisionCategory**: Added `'instruction'` category
- **TurnAction**: Added `'tactical_instruction'` action type

### Fixed
- **Single option bug**: At 0-0 with balanced mentality + 4-3-3 formation, `generateDecisionOptions` previously returned only "Manter como está" — now always offers meaningful alternatives
- **Double-simulation bug**: Each match segment was being simulated twice — fixed flow so each segment is simulated exactly once with the user's decision applied
- **Loading spinner before first decision**: Removed two unnecessary loading phases (isCalculating + processTurn API call) — first decision now appears instantly

## [0.1.0] - 2026-01-18

### Added
- Initial MVP release
- Next.js 14 app with TypeScript
- Neon PostgreSQL database with Drizzle ORM
- Chat interface with message history
- Match simulation engine (hardcoded)
- AI integration (mock mode for testing)
- User state persistence
- Points/rewards system
- Brazilian football context
- Team branding with dynamic badges and colors
- Animated header with pulsing notifications
- Enhanced chat with message avatars and action buttons
- Squad dashboard with stat cards and player ratings
- Match experience with VS screen and animated result modal
- Framer Motion animations throughout
- Responsive mobile-optimized design
