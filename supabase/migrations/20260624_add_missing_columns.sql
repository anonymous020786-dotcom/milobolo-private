-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Settings: all 8 user preferences stored as JSONB for cross-device sync
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT NULL;

-- Welcome modal: track whether the user has seen the onboarding carousel
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_seen BOOLEAN DEFAULT false NOT NULL;

-- College mode: institutional email verification
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS college_verified BOOLEAN DEFAULT false NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS college_email TEXT DEFAULT NULL;

-- Reports: link a report to a Supabase auth user (not just a socket ID)
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS reported_user_id UUID DEFAULT NULL
  REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Index for report lookups by user
CREATE INDEX IF NOT EXISTS idx_reports_reported_user
  ON public.reports(reported_user_id);

-- Index for settings lookup
CREATE INDEX IF NOT EXISTS idx_profiles_college_verified
  ON public.profiles(college_verified) WHERE college_verified = true;
