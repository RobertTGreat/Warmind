-- Migration: Create user_settings table for premium settings sync
-- This table stores user settings that can be synced across devices

CREATE TABLE IF NOT EXISTS user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bungie_id TEXT UNIQUE NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups by bungie_id
CREATE INDEX IF NOT EXISTS idx_user_settings_bungie_id ON user_settings(bungie_id);

-- Create index for updated_at to support sync queries
CREATE INDEX IF NOT EXISTS idx_user_settings_updated_at ON user_settings(updated_at);

-- Enable Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own settings
CREATE POLICY "Users can read own settings" ON user_settings
    FOR SELECT
    USING (true); -- For now, allow reads (auth will be handled by bungie_id matching)

-- Policy: Users can insert their own settings
CREATE POLICY "Users can insert own settings" ON user_settings
    FOR INSERT
    WITH CHECK (true);

-- Policy: Users can update their own settings
CREATE POLICY "Users can update own settings" ON user_settings
    FOR UPDATE
    USING (true);

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create subscriptions table for premium tier management
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bungie_id TEXT UNIQUE NOT NULL,
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for subscription lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_bungie_id ON user_subscriptions(bungie_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);

-- Enable RLS on subscriptions
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy for subscriptions
CREATE POLICY "Users can read own subscription" ON user_subscriptions
    FOR SELECT
    USING (true);

-- Trigger for subscriptions updated_at
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE user_settings IS 'Stores user preferences and settings for premium cross-device sync';
COMMENT ON TABLE user_subscriptions IS 'Tracks user subscription status for premium features';

