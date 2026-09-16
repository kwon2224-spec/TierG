-- Tier Golf (TierG) Database Schema & Mock Data Setup
-- Copy and run this script in your Supabase SQL Editor.

-- 1. Create custom enum type for Tiers
CREATE TYPE golf_tier AS ENUM (
  'Iron', 
  'Bronze', 
  'Silver', 
  'Gold', 
  'Platinum', 
  'Emerald', 
  'Diamond', 
  'Master', 
  'Challenger'
);

-- 2. Create players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  tier golf_tier NOT NULL DEFAULT 'Iron',
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  base_handicap INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create games table
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  played_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create game_results table
CREATE TABLE IF NOT EXISTS game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  raw_score INTEGER NOT NULL,
  adjusted_score INTEGER NOT NULL,
  rank INTEGER NOT NULL CHECK (rank >= 1),
  points_changed INTEGER NOT NULL,
  tier_after golf_tier NOT NULL,
  points_after INTEGER NOT NULL,
  cost_paid INTEGER NOT NULL DEFAULT 0 CHECK (cost_paid >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Enable Row Level Security (RLS) - Optional but useful
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (Simple mode for friend groups)
CREATE POLICY "Allow public read players" ON players FOR SELECT USING (true);
CREATE POLICY "Allow public insert players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update players" ON players FOR UPDATE USING (true);

CREATE POLICY "Allow public read games" ON games FOR SELECT USING (true);
CREATE POLICY "Allow public insert games" ON games FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read game_results" ON game_results FOR SELECT USING (true);
CREATE POLICY "Allow public insert game_results" ON game_results FOR INSERT WITH CHECK (true);

-- 6. Insert 10 initial players with realistic tiers & handicaps
INSERT INTO players (name, tier, points, base_handicap) VALUES
  ('부성훈', 'Challenger', 0, 0), 
  ('이평화', 'Challenger', 0, 0),  
  ('최문규', 'Master', 0, 5),  
  ('김창범', 'Emerald', 0, 10),   
  ('권기원', 'Emerald', 0, 10),     
  ('안재민', 'Platinum', 0, 12),   
  ('이승무', 'Platinum', 0, 12),   
  ('황지운', 'Gold', 0, 15),    
  ('나용성', 'Gold', 0, 15),     
  ('이창훈', 'Silver', 0, 20),       
  ('박진범', 'Silver', 0, 20)        
ON CONFLICT (name) DO NOTHING;
