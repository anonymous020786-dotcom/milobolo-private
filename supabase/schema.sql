-- ═══════════════════════════════════════════════════════════
-- MiloBolo Database Schema
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── PROFILES ───────────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  display_name text,
  bio text check (char_length(bio) <= 300),
  avatar_url text,
  gender text check (gender in ('male', 'female', 'other', 'prefer_not_to_say')),
  country text,
  is_banned boolean default false,
  ban_reason text,
  is_verified boolean default false,
  role text default 'user' check (role in ('user', 'moderator', 'admin', 'superadmin')),
  total_chats integer default 0,
  report_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- ─── OTP CODES ──────────────────────────────────────────────
create table public.otp_codes (
  id uuid default uuid_generate_v4() primary key,
  email text not null,
  otp_hash text not null,
  type text not null check (type in ('verify', 'reset', 'delete', 'change_email')),
  expires_at timestamptz not null,
  used boolean default false,
  created_at timestamptz default now()
);

create index idx_otp_email_type on otp_codes(email, type);
alter table public.otp_codes enable row level security;

-- Only service role can access OTPs
create policy "Service role only" on otp_codes
  using (false) with check (false);

-- ─── REPORTS ────────────────────────────────────────────────
create table public.reports (
  id uuid default uuid_generate_v4() primary key,
  reporter_id uuid references profiles(id) on delete set null,
  reporter_socket text,
  reported_id uuid references profiles(id) on delete set null,
  reported_socket text,
  room_id text,
  reason text not null,
  status text default 'pending' check (status in ('pending', 'reviewed', 'actioned', 'dismissed')),
  admin_note text,
  reviewed_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.reports enable row level security;
create policy "Admins can manage reports" on reports
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','superadmin','moderator'))
  );
create policy "Users can insert reports" on reports for insert with check (true);

-- ─── FEATURE FLAGS ──────────────────────────────────────────
create table public.feature_flags (
  key text primary key,
  enabled boolean default true,
  label text,
  description text,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz default now()
);

alter table public.feature_flags enable row level security;
create policy "Anyone can read feature flags" on feature_flags for select using (true);
create policy "Only superadmin can modify flags" on feature_flags
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'superadmin')
  );

-- Seed default feature flags
insert into feature_flags (key, enabled, label, description) values
  ('video_chat',       true,  'Video Chat',         'Enable video chat mode'),
  ('text_chat',        true,  'Text Chat',          'Enable text-only chat mode'),
  ('google_auth',      true,  'Google OAuth',       'Allow sign in with Google'),
  ('email_auth',       true,  'Email Auth',         'Allow email/password signup'),
  ('guest_mode',       true,  'Guest Mode',         'Allow chatting without account'),
  ('google_ads',       true,  'Google AdSense',     'Show AdSense advertisements'),
  ('google_analytics', true,  'Google Analytics',   'Track page analytics'),
  ('recaptcha',        true,  'reCAPTCHA v3',       'Bot protection on forms'),
  ('whatsapp_button',  true,  'WhatsApp Button',    'Show WhatsApp support button'),
  ('user_reports',     true,  'User Reports',       'Allow users to report others'),
  ('registration',     true,  'New Registrations',  'Allow new user signups'),
  ('profile_pictures', true,  'Profile Pictures',   'Allow avatar uploads');

-- ─── ADMIN ACTIVITY LOG ─────────────────────────────────────
create table public.admin_logs (
  id uuid default uuid_generate_v4() primary key,
  admin_id uuid references profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb,
  created_at timestamptz default now()
);

alter table public.admin_logs enable row level security;
create policy "Superadmin can view logs" on admin_logs
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin','superadmin')));

-- ─── CHAT STATS (aggregate) ─────────────────────────────────
create table public.chat_stats (
  date date primary key default current_date,
  total_sessions integer default 0,
  video_sessions integer default 0,
  text_sessions integer default 0,
  unique_users integer default 0,
  reports_filed integer default 0
);

alter table public.chat_stats enable row level security;
create policy "Admins can view stats" on chat_stats
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin','superadmin','moderator')));

-- ─── TRIGGERS ───────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at before update on profiles
  for each row execute procedure update_updated_at();
create trigger reports_updated_at before update on reports
  for each row execute procedure update_updated_at();
