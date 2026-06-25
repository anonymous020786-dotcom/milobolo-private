-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Adds columns required by MiloBolo features added in June 2026

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS settings          JSONB,
  ADD COLUMN IF NOT EXISTS welcome_seen      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS college_verified  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS college_email     TEXT,
  ADD COLUMN IF NOT EXISTS ban_reason        TEXT,
  ADD COLUMN IF NOT EXISTS allow_friend_requests BOOLEAN NOT NULL DEFAULT true;

-- Index for leaderboard query (excludes banned, orders by total_chats desc)
CREATE INDEX IF NOT EXISTS idx_profiles_leaderboard
  ON profiles (total_chats DESC, created_at ASC)
  WHERE is_banned = false AND total_chats > 0;

-- RLS: users can only read/write their own settings + welcome_seen
-- (existing RLS policy on profiles already covers this if you have
--  "Users can update their own profile" enabled — no extra policy needed)

-- reported_user_id column for reports table (for auto-ban traceability)
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS reported_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
