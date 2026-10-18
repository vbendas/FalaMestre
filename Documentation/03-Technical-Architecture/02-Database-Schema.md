# Database Schema

---
tags: #technical #database #schema #supabase #postgresql
status: complete
priority: critical
phase: mvp
last_updated: 2026-01-18
---

## Overview

The database is built on PostgreSQL via Supabase, using a JSON-heavy approach for game state to reduce complexity while maintaining relational integrity for core entities.

> [!important] Design Philosophy
> Store structured data relationally, store game state as JSON for flexibility.

> [!note] Implemented schema
> This page records the original schema design. The schema the app actually uses is defined with Drizzle in `app/src/db/schema.ts`. Fala Mestre! is a standalone game; the database holds no crypto, ad-platform or user-profiling tables.

---

## Entity Relationship Diagram

```
+------------------+       +-------------------+
|      users       |       |    game_states    |
+------------------+       +-------------------+
| id (PK)          |<----->| user_id (PK, FK)  |
| email            |       | team              |
| username         |       | current_state     |
| points           |       | squad (JSON)      |
|                  |       | season_progress   |
| created_at       |       +-------------------+
+------------------+              |
       |                          |
       |                          v
       |                 +-------------------+
       |                 |     matches       |
       |                 +-------------------+
       |                 | id (PK)           |
       +---------------->| user_id (FK)      |
       |                 | home_team         |
       |                 | away_team         |
       |                 | score             |
       |                 | events (JSON)     |
       |                 +-------------------+
       |
       |                 +-------------------+
       |                 |  conversations    |
       |                 +-------------------+
       +---------------->| id (PK)           |
       |                 | user_id (FK)      |
       |                 | session_id        |
       |                 | messages (JSON)   |
       |                 +-------------------+
       |
       |                 +-------------------+
       |                 |     rewards       |
       +---------------->+-------------------+
                         | id (PK)           |
                         | user_id (FK)      |
                         | type              |
                         | amount            |
                         | claimed           |
                         +-------------------+


+-------------------+
|     players       |  (Reference data - shared)
+-------------------+
| id (PK)           |
| name              |
| team              |
| position          |
| attributes (JSON) |
| value             |
+-------------------+
```

---

## Core Tables

### users

Primary user account table.

```sql
CREATE TABLE users (
    -- Identity
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    
    -- Profile
    favorite_team TEXT,
    country TEXT DEFAULT 'BR',
    language TEXT DEFAULT 'pt-BR',
    avatar_url TEXT,
    
    -- Game Stats
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    total_matches INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    
    -- Premium
    is_premium BOOLEAN DEFAULT FALSE,
    premium_until TIMESTAMPTZ,
    
    -- Flags
    onboarding_completed BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    
    -- Referral
    referred_by UUID REFERENCES users(id),
    referral_code TEXT UNIQUE
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_referral_code ON users(referral_code);

-- Triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### game_states

Current game state for each user (single row per user).

```sql
CREATE TABLE game_states (
    -- Primary Key (one game state per user)
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- Team Selection
    team TEXT NOT NULL,
    team_logo_url TEXT,
    
    -- Season Progress
    season INTEGER DEFAULT 1,
    week INTEGER DEFAULT 1,
    league TEXT DEFAULT 'Liga Mestre A',
    league_position INTEGER,
    league_points INTEGER DEFAULT 0,
    
    -- Squad (JSON for flexibility)
    squad JSONB NOT NULL DEFAULT '[]',
    formation TEXT DEFAULT '4-3-3',
    tactics JSONB DEFAULT '{"mentality": "balanced", "pressing": "medium"}',
    
    -- Finances
    budget BIGINT DEFAULT 10000000, -- R$ 10M in centavos
    weekly_income INTEGER DEFAULT 500000,
    weekly_expenses INTEGER DEFAULT 300000,
    
    -- Team Stats
    matches_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    goals_scored INTEGER DEFAULT 0,
    goals_conceded INTEGER DEFAULT 0,
    
    -- Dynamic Stats
    team_morale INTEGER DEFAULT 75,
    fan_mood INTEGER DEFAULT 70,
    
    -- State Snapshots
    next_match JSONB,
    last_match_result JSONB,
    transfer_targets JSONB DEFAULT '[]',
    injuries JSONB DEFAULT '[]',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for updated_at
CREATE TRIGGER update_game_states_updated_at
    BEFORE UPDATE ON game_states
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

**Squad JSON Structure:**

```typescript
interface SquadPlayer {
  id: string;
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  
  // Attributes (1-99)
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  overall: number;
  
  // Dynamic
  morale: number;
  fitness: number;
  form: number;
  
  // Status
  isStarter: boolean;
  isCaptain: boolean;
  isInjured: boolean;
  injuryWeeksLeft?: number;
  
  // Career
  matches: number;
  goals: number;
  assists: number;
  
  // Contract
  value: number;
  wage: number;
  contractYears: number;
}
```

### players

Reference table for all players in the game.

```sql
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic Info
    name TEXT NOT NULL,
    short_name TEXT,
    team TEXT NOT NULL,
    position TEXT NOT NULL,
    age INTEGER NOT NULL,
    nationality TEXT DEFAULT 'BR',
    
    -- Attributes (1-99)
    pac INTEGER NOT NULL CHECK (pac BETWEEN 1 AND 99),
    sho INTEGER NOT NULL CHECK (sho BETWEEN 1 AND 99),
    pas INTEGER NOT NULL CHECK (pas BETWEEN 1 AND 99),
    dri INTEGER NOT NULL CHECK (dri BETWEEN 1 AND 99),
    def INTEGER NOT NULL CHECK (def BETWEEN 1 AND 99),
    phy INTEGER NOT NULL CHECK (phy BETWEEN 1 AND 99),
    
    -- Overall (calculated)
    overall INTEGER GENERATED ALWAYS AS (
        CASE position
            WHEN 'GK' THEN (pac*5 + sho*0 + pas*10 + dri*5 + def*65 + phy*15) / 100
            WHEN 'DEF' THEN (pac*15 + sho*5 + pas*10 + dri*10 + def*45 + phy*15) / 100
            WHEN 'MID' THEN (pac*15 + sho*10 + pas*30 + dri*20 + def*10 + phy*15) / 100
            WHEN 'FWD' THEN (pac*25 + sho*35 + pas*10 + dri*20 + def*0 + phy*10) / 100
            ELSE (pac + sho + pas + dri + def + phy) / 6
        END
    ) STORED,
    
    -- Hidden Attributes
    potential INTEGER DEFAULT 75,
    consistency INTEGER DEFAULT 50,
    injury_prone INTEGER DEFAULT 20,
    big_match INTEGER DEFAULT 50,
    
    -- Market
    value BIGINT NOT NULL, -- Base value in centavos
    wage INTEGER NOT NULL, -- Weekly wage
    
    -- Metadata
    image_url TEXT,
    is_legend BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_players_team ON players(team);
CREATE INDEX idx_players_position ON players(position);
CREATE INDEX idx_players_overall ON players(overall DESC);
CREATE INDEX idx_players_value ON players(value DESC);
```

### matches

Historical record of all matches played.

```sql
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Match Context
    season INTEGER NOT NULL,
    week INTEGER NOT NULL,
    competition TEXT DEFAULT 'league',
    competition_round TEXT,
    
    -- Teams
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    is_user_home BOOLEAN NOT NULL,
    
    -- Lineups (snapshot at match time)
    home_lineup JSONB NOT NULL,
    away_lineup JSONB NOT NULL,
    home_formation TEXT NOT NULL,
    away_formation TEXT NOT NULL,
    
    -- Result
    home_score INTEGER NOT NULL,
    away_score INTEGER NOT NULL,
    
    -- Statistics
    stats JSONB NOT NULL DEFAULT '{
        "home_possession": 50,
        "away_possession": 50,
        "home_shots": 0,
        "away_shots": 0,
        "home_shots_on_target": 0,
        "away_shots_on_target": 0
    }',
    
    -- Events (goals, cards, injuries, subs)
    events JSONB NOT NULL DEFAULT '[]',
    
    -- Narrative
    commentary TEXT,
    
    -- Player Ratings
    player_ratings JSONB DEFAULT '{}',
    
    -- Rewards
    points_earned INTEGER DEFAULT 0,
    
    -- Timestamps
    played_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_matches_user ON matches(user_id);
CREATE INDEX idx_matches_user_season ON matches(user_id, season, week);
CREATE INDEX idx_matches_played_at ON matches(played_at DESC);
```

**Events JSON Structure:**

```typescript
interface MatchEvent {
  minute: number;
  type: 'goal' | 'yellow_card' | 'red_card' | 'injury' | 'substitution' | 'var';
  team: 'home' | 'away';
  player: string;
  assistBy?: string;
  description: string;
}
```

### conversations

Chat history for AI interactions.

```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    
    -- Message
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    
    -- Rich Content
    cards JSONB DEFAULT '[]',
    actions JSONB DEFAULT '[]',
    
    -- Context
    intent TEXT,
    game_context TEXT,
    
    -- AI Metadata
    model_used TEXT,
    tokens_input INTEGER,
    tokens_output INTEGER,
    latency_ms INTEGER,
    
    -- Analytics
    sentiment TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_conversations_user_session ON conversations(user_id, session_id);
CREATE INDEX idx_conversations_created ON conversations(created_at DESC);

-- Partition by month for large scale (future)
-- CREATE TABLE conversations_2026_01 PARTITION OF conversations
--     FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

### rewards

In-game points and achievement tracking.

```sql
CREATE TABLE rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Reward Details
    type TEXT NOT NULL CHECK (type IN ('points', 'achievement', 'bonus')),
    amount INTEGER NOT NULL,
    description TEXT,
    
    -- Source
    source TEXT NOT NULL,
    source_id UUID,
    
    -- Status
    claimed BOOLEAN DEFAULT FALSE,
    claimed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_rewards_user ON rewards(user_id);
CREATE INDEX idx_rewards_unclaimed ON rewards(user_id) WHERE claimed = FALSE;
```

### analytics_events

First-party gameplay event tracking (kept in this database, never exported).

```sql
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Event
    event_name TEXT NOT NULL,
    event_properties JSONB DEFAULT '{}',
    
    -- Context
    session_id TEXT,
    page_path TEXT,
    referrer TEXT,
    
    -- Device
    device_type TEXT,
    browser TEXT,
    os TEXT,
    screen_size TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_analytics_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_event ON analytics_events(event_name);
CREATE INDEX idx_analytics_created ON analytics_events(created_at DESC);

-- Consider partitioning for scale
-- CREATE INDEX idx_analytics_created_brin ON analytics_events 
--     USING BRIN (created_at);
```

---

## Helper Functions

### Update Timestamp Trigger

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Add Points to User

```sql
CREATE OR REPLACE FUNCTION add_points(
    p_user_id UUID,
    p_amount INTEGER,
    p_source TEXT,
    p_source_id UUID DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    new_balance INTEGER;
BEGIN
    -- Update user balance
    UPDATE users 
    SET points = points + p_amount
    WHERE id = p_user_id
    RETURNING points INTO new_balance;
    
    -- Log reward
    INSERT INTO rewards (user_id, type, amount, description, source, source_id, claimed, claimed_at)
    VALUES (p_user_id, 'points', p_amount, 'Points earned', p_source, p_source_id, TRUE, NOW());
    
    RETURN new_balance;
END;
$$ LANGUAGE plpgsql;
```

---

## Row Level Security

```sql
-- Enable RLS on all user-specific tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- Game states policies
CREATE POLICY "Users can manage own game state"
    ON game_states FOR ALL
    USING (auth.uid() = user_id);

-- Matches policies
CREATE POLICY "Users can view own matches"
    ON matches FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own matches"
    ON matches FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Players table (public read)
CREATE POLICY "Anyone can read players"
    ON players FOR SELECT
    USING (true);

-- Conversations policies
CREATE POLICY "Users can manage own conversations"
    ON conversations FOR ALL
    USING (auth.uid() = user_id);

-- Rewards policies
CREATE POLICY "Users can view own rewards"
    ON rewards FOR SELECT
    USING (auth.uid() = user_id);
```

---

## Migrations

### Initial Migration (V001)

```sql
-- V001_initial_schema.sql

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create all tables (see above)
-- Create all indexes
-- Create all functions
-- Create all triggers
-- Create all RLS policies

-- Seed initial player data
INSERT INTO players (name, team, position, age, pac, sho, pas, dri, def, phy, value, wage)
VALUES 
    ('Lucas Ferreira', 'Dragões do Cerrado', 'FWD', 28, 88, 91, 78, 85, 35, 81, 45000000, 500000),
    ('Rafael Santos', 'Dragões do Cerrado', 'MID', 30, 75, 82, 88, 87, 42, 68, 35000000, 450000),
    -- ... more players
;
```

---

## Related Documents

- [[00-System-Overview]] - Architecture overview
- [[01-Tech-Stack]] - Technology choices
- [[03-API-Design]] - API contracts
- [[04-AI-LLM-Strategy]] - AI integration

---

*"Data is the new oil, but PostgreSQL is the refinery."*
