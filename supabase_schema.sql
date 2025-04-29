-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User profiles (extends the auth.users data)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    is_guest BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User stats
CREATE TABLE user_stats (
    user_id UUID REFERENCES profiles(id) PRIMARY KEY,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    rating INTEGER DEFAULT 1000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game lobbies
CREATE TABLE lobbies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    host_id UUID REFERENCES profiles(id) NOT NULL,
    max_players INTEGER DEFAULT 4,
    is_private BOOLEAN DEFAULT FALSE,
    invite_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(3), 'hex'),
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'full', 'in_progress', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Games table
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lobby_id UUID REFERENCES lobbies(id),
    status TEXT DEFAULT 'setup' CHECK (status IN ('setup', 'hukum_selection', 'playing', 'round_end', 'completed')),
    current_player INTEGER DEFAULT 0,
    hukum_suit TEXT,
    starting_suit TEXT,
    current_round INTEGER DEFAULT 1,
    team_a_score INTEGER DEFAULT 0,
    team_b_score INTEGER DEFAULT 0,
    round_winner UUID,
    game_winner TEXT CHECK (game_winner IN ('A', 'B')),
    round_start_time TIMESTAMP WITH TIME ZONE,
    turn_start_time TIMESTAMP WITH TIME ZONE,
    turn_max_seconds INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game players (connects users to games)
CREATE TABLE game_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES games(id) NOT NULL,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    player_position INTEGER NOT NULL CHECK (player_position >= 0 AND player_position < 4),
    team TEXT NOT NULL CHECK (team IN ('A', 'B')),
    is_connected BOOLEAN DEFAULT TRUE,
    last_action_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (game_id, player_position),
    UNIQUE (game_id, user_id)
);

-- Player hands
CREATE TABLE player_hands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES games(id) NOT NULL,
    player_id UUID REFERENCES game_players(id) NOT NULL,
    cards JSONB NOT NULL DEFAULT '[]',
    UNIQUE (game_id, player_id)
);

-- Cards on table
CREATE TABLE table_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES games(id) NOT NULL,
    player_id UUID REFERENCES game_players(id) NOT NULL,
    card JSONB NOT NULL,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (game_id, player_id)
);

-- Game history
CREATE TABLE game_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES games(id) NOT NULL,
    winner_team TEXT NOT NULL CHECK (winner_team IN ('A', 'B')),
    team_a_score INTEGER NOT NULL,
    team_b_score INTEGER NOT NULL,
    hukum_suit TEXT NOT NULL,
    duration_seconds INTEGER,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game invitations
CREATE TABLE game_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lobby_id UUID REFERENCES lobbies(id) NOT NULL,
    sender_id UUID REFERENCES profiles(id) NOT NULL,
    recipient_email TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Matchmaking queue
CREATE TABLE matchmaking_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) NOT NULL,
    rating INTEGER DEFAULT 1000,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id)
);

-- Add temporary_guest_users table for web guest sessions
CREATE TABLE temp_guest_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id TEXT NOT NULL,
    username TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Function to update 'last_seen' timestamp
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_seen = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating last seen
CREATE TRIGGER update_profile_last_seen
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_last_seen();

-- Function to end turns if time limit is reached
CREATE OR REPLACE FUNCTION check_turn_timeout()
RETURNS TRIGGER AS $$
BEGIN
    -- If current player hasn't acted within turn_max_seconds
    IF OLD.turn_start_time + (OLD.turn_max_seconds * interval '1 second') < NOW() THEN
        -- Auto-play a valid card (implement this logic or skip turn)
        -- This is simplified - would need more complex logic in production
        NEW.current_player := (OLD.current_player + 1) % 4;
        NEW.turn_start_time := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for turn timeout
CREATE TRIGGER check_game_turn_timeout
BEFORE UPDATE ON games
FOR EACH ROW
WHEN (OLD.status = 'playing')
EXECUTE FUNCTION check_turn_timeout();

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_hands ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE USING (auth.uid() = id);

-- User stats policies
CREATE POLICY "Stats are viewable by everyone" 
ON user_stats FOR SELECT USING (true);

CREATE POLICY "Only system can update stats" 
ON user_stats FOR UPDATE USING (false);

-- Lobbies policies
CREATE POLICY "Lobbies are viewable by everyone" 
ON lobbies FOR SELECT USING (
    status <> 'completed' OR 
    host_id = auth.uid()
);

CREATE POLICY "Users can create lobbies" 
ON lobbies FOR INSERT WITH CHECK (host_id = auth.uid());

CREATE POLICY "Hosts can update own lobbies" 
ON lobbies FOR UPDATE USING (host_id = auth.uid());

-- Games policies
CREATE POLICY "Games are viewable by participants" 
ON games FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM lobbies
        WHERE id = games.lobby_id
        AND (host_id = auth.uid() OR NOT is_private)
    ) OR
    EXISTS (
        SELECT 1 FROM game_players
        WHERE game_id = games.id
        AND user_id = auth.uid()
    )
);

CREATE POLICY "Games can be created by lobby hosts" 
ON games FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM lobbies WHERE id = lobby_id AND host_id = auth.uid()
    )
);

-- Game players policies
CREATE POLICY "Player info viewable by game participants" 
ON game_players FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM games 
        WHERE id = game_players.game_id
        AND EXISTS (
            SELECT 1 FROM game_players p
            WHERE p.game_id = games.id
            AND p.user_id = auth.uid()
        )
    )
);

CREATE POLICY "Users can join games with available slots" 
ON game_players FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM games g 
        JOIN lobbies l ON g.lobby_id = l.id 
        WHERE g.id = game_id 
        AND g.status = 'setup'
        AND (l.is_private = false OR l.host_id = auth.uid())
    ) 
    AND user_id = auth.uid()
);

-- Player hands policies
CREATE POLICY "Players can view all hands in their game"
ON player_hands FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM game_players 
        WHERE game_id = player_hands.game_id AND user_id = auth.uid()
    )
);

-- Table cards policies
CREATE POLICY "Table cards visible to all game participants"
ON table_cards FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM game_players 
        WHERE game_id = table_cards.game_id AND user_id = auth.uid()
    )
);

-- Function for matchmaking
CREATE OR REPLACE FUNCTION match_players()
RETURNS VOID AS $$
DECLARE
    matched_players UUID[];
    new_lobby_id UUID;
    new_game_id UUID;
    player_record RECORD;
    player_count INTEGER := 0;
    player_position INTEGER;
BEGIN
    -- Find players to match (simple first 4 in queue approach)
    SELECT ARRAY_AGG(user_id) INTO matched_players
    FROM (
        SELECT user_id FROM matchmaking_queue
        ORDER BY joined_at
        LIMIT 4
    ) sq;
    
    -- If we have 4 players, create a game
    IF ARRAY_LENGTH(matched_players, 1) = 4 THEN
        -- Create lobby
        INSERT INTO lobbies (name, host_id, is_private)
        VALUES ('Matchmaking Game', matched_players[1], false)
        RETURNING id INTO new_lobby_id;
        
        -- Create game
        INSERT INTO games (lobby_id, status)
        VALUES (new_lobby_id, 'setup')
        RETURNING id INTO new_game_id;
        
        -- Add players to game
        FOR player_record IN 
            SELECT unnest(matched_players) AS user_id, 
                  generate_series(0, 3) AS position
        LOOP
            -- Assign teams (0,2 -> Team A, 1,3 -> Team B)
            INSERT INTO game_players (
                game_id, 
                user_id, 
                player_position, 
                team
            )
            VALUES (
                new_game_id, 
                player_record.user_id, 
                player_record.position, 
                CASE WHEN player_record.position IN (0, 2) THEN 'A' ELSE 'B' END
            );
        END LOOP;
        
        -- Remove matched players from queue
        DELETE FROM matchmaking_queue
        WHERE user_id = ANY(matched_players);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create realtime publications
BEGIN;
    DROP PUBLICATION IF EXISTS supabase_realtime;
    CREATE PUBLICATION supabase_realtime FOR TABLE 
        profiles, 
        lobbies, 
        games, 
        game_players, 
        player_hands, 
        table_cards;
COMMIT; 