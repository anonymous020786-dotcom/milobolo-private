-- ═══════════════════════════════════════════════════════════
-- MiloBolo Schema v2 — Advanced Features
-- Run AFTER schema.sql in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ─── CHAT HISTORY (metadata only, no message content) ──────
create table public.chat_history (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  mode text not null check (mode in ('video', 'text')),
  room_id text,
  duration_seconds integer default 0,
  message_count integer default 0,
  matched_interest text,
  started_at timestamptz default now(),
  ended_at timestamptz
);

create index idx_chat_history_user on chat_history(user_id, started_at desc);
alter table public.chat_history enable row level security;

create policy "Users can manage own history" on chat_history
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── FRIENDS / CONNECTIONS ─────────────────────────────────
create table public.connections (
  id uuid default uuid_generate_v4() primary key,
  requester_id uuid references profiles(id) on delete cascade not null,
  receiver_id uuid references profiles(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'declined', 'blocked')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (requester_id, receiver_id)
);

create index idx_connections_receiver on connections(receiver_id, status);
create index idx_connections_requester on connections(requester_id, status);
alter table public.connections enable row level security;

create policy "Users can view own connections" on connections
  using (auth.uid() = requester_id or auth.uid() = receiver_id);

create policy "Users can insert connections" on connections
  for insert with check (auth.uid() = requester_id);

create policy "Users can update own connections" on connections
  for update using (auth.uid() = receiver_id or auth.uid() = requester_id);

-- ─── BAN FINGERPRINTS ──────────────────────────────────────
create table public.banned_fingerprints (
  fingerprint text primary key,
  reason text,
  banned_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.banned_fingerprints enable row level security;
create policy "Admins can manage fingerprint bans" on banned_fingerprints
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin','superadmin')));

-- ─── ADD screenshot column to reports ──────────────────────
alter table public.reports add column if not exists screenshot_b64 text;

-- ─── ADD interests to profiles ─────────────────────────────
alter table public.profiles add column if not exists interests text[] default '{}';
alter table public.profiles add column if not exists last_seen timestamptz default now();
alter table public.profiles add column if not exists notification_token text;

-- ─── ADD new feature flags ─────────────────────────────────
insert into feature_flags (key, enabled, label, description) values
  ('e2e_encryption',     true,  'E2E Encryption',       'End-to-end encrypt all text messages'),
  ('interest_matching',  true,  'Interest Matching',    'Match users by shared interests'),
  ('chat_history',       true,  'Chat History',         'Save session metadata for logged-in users'),
  ('screen_sharing',     true,  'Screen Sharing',       'Allow screen share during video chat'),
  ('virtual_bg',         true,  'Virtual Background',   'Background blur/color in video chat'),
  ('friend_requests',    true,  'Friend Requests',      'Allow users to connect with strangers'),
  ('pwa',                true,  'PWA Install',          'Show install app prompt')
on conflict (key) do nothing;

-- ─── TRIGGER: update last_seen ─────────────────────────────
create or replace function update_last_seen()
returns trigger language plpgsql security definer as $$
begin
  update public.profiles set last_seen = now() where id = new.user_id;
  return new;
end;
$$;

create trigger chat_history_last_seen
  after insert on chat_history
  for each row execute procedure update_last_seen();
