-- Schema for ArcLauncher Indexer

-- Table for tracking Token Launches
CREATE TABLE IF NOT EXISTS token_launches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_address TEXT NOT NULL,
    token_address TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    ticker TEXT NOT NULL,
    supply NUMERIC NOT NULL,
    image_url TEXT,
    is_pinned BOOLEAN DEFAULT FALSE,
    badge_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for tracking Swaps (Volume)
CREATE TABLE IF NOT EXISTS token_swaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_address TEXT NOT NULL,
    token_address TEXT NOT NULL,
    usdc_amount NUMERIC NOT NULL,
    token_amount NUMERIC NOT NULL,
    is_buy BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to calculate Global Market Volume (Total USDC traded + Launch fees)
CREATE OR REPLACE FUNCTION get_global_market_volume()
RETURNS NUMERIC AS $$
DECLARE
    total_launch_fees NUMERIC;
    total_swap_volume NUMERIC;
BEGIN
    -- Each launch is 4 USDC (4,000,000 with 6 decimals)
    SELECT COALESCE(COUNT(*) * 4000000, 0) INTO total_launch_fees FROM token_launches;
    
    -- Total swap volume in USDC
    SELECT COALESCE(SUM(usdc_amount), 0) INTO total_swap_volume FROM token_swaps;
    
    RETURN total_launch_fees + total_swap_volume;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate Daily New Launches
CREATE OR REPLACE FUNCTION get_daily_new_launches()
RETURNS INTEGER AS $$
DECLARE
    daily_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO daily_count
    FROM token_launches
    WHERE created_at >= NOW() - INTERVAL '24 hours';
    
    RETURN daily_count;
END;
$$ LANGUAGE plpgsql;

-- Listeners / Triggers for real-time updates
-- Supabase real-time is enabled on these tables
ALTER PUBLICATION supabase_realtime ADD TABLE token_launches;
ALTER PUBLICATION supabase_realtime ADD TABLE token_swaps;

-- Table for Persistent Social Profiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet TEXT NOT NULL UNIQUE,
    name TEXT,
    avatar TEXT,
    discord TEXT,
    twitter TEXT,
    is_affiliate BOOLEAN DEFAULT FALSE,
    checkin_count INTEGER DEFAULT 0,
    streak_count INTEGER DEFAULT 0,
    missed_count INTEGER DEFAULT 0,
    last_checkin TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for User Stats (ARCL Points & Leaderboard)
CREATE TABLE IF NOT EXISTS user_stats (
    wallet TEXT PRIMARY KEY,
    points NUMERIC DEFAULT 0,
    total_volume NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Supabase real-time on new tables
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE user_stats;

-- Table for tracking Liquidity Locks
CREATE TABLE IF NOT EXISTS liquidity_locks (
    id TEXT PRIMARY KEY, -- Supports custom alphanumeric IDs securely
    wallet TEXT NOT NULL,
    asset_type TEXT NOT NULL, -- 'USDC' or 'TOKEN'
    token_address TEXT,
    token_ticker TEXT,
    amount NUMERIC NOT NULL,
    locked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unlock_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_withdrawn BOOLEAN DEFAULT FALSE
);

-- Enable Supabase real-time on locks
ALTER PUBLICATION supabase_realtime ADD TABLE liquidity_locks;

-- Table for tracking Social Pay Transactions
CREATE TABLE IF NOT EXISTS social_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_wallet TEXT NOT NULL,
    receiver_wallet TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    asset_type TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Supabase real-time on social transactions
ALTER PUBLICATION supabase_realtime ADD TABLE social_transactions;
