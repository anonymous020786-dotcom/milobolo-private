-- ═══════════════════════════════════════════════════════════
-- MiloBolo — hardening + social features (Sep 2026)
-- Run AFTER schema.sql, schema_v2.sql and the earlier migrations.
-- Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════════════

-- ─── PROFILES: new columns ─────────────────────────────────
alter table public.profiles add column if not exists karma integer not null default 0;
alter table public.profiles add column if not exists allow_friend_requests boolean not null default true;

-- Usernames: lowercase, 3–20 chars, letters/digits/underscore
do $$ begin
  alter table public.profiles add constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9_]{3,20}$');
exception when duplicate_object then null; end $$;

-- ─── PROFILES: admins can moderate other users ─────────────
-- The original schema only allowed users to update their OWN row, so bans
-- issued from the admin dashboard silently updated 0 rows.
drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile" on public.profiles
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('moderator','admin','superadmin'))
  );

-- ─── PROFILES: protect privileged columns ──────────────────
-- "Users can update own profile" has no column restriction, so without this
-- any user could set role = 'superadmin' or clear their own ban.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor_role text;
begin
  -- service role (signaling server / API routes), SQL editor, and internal triggers are trusted
  if auth.role() = 'service_role' or auth.uid() is null
     or current_setting('milobolo.internal', true) = '1' then
    return new;
  end if;

  select role into actor_role from public.profiles where id = auth.uid();
  actor_role := coalesce(actor_role, 'user');

  if new.role is distinct from old.role and actor_role <> 'superadmin' then
    raise exception 'Only a superadmin can change roles';
  end if;

  if (new.is_banned is distinct from old.is_banned or new.ban_reason is distinct from old.ban_reason)
     and actor_role not in ('moderator','admin','superadmin') then
    raise exception 'Not allowed to change ban status';
  end if;

  if (new.college_verified is distinct from old.college_verified
      or new.college_email is distinct from old.college_email
      or new.is_verified is distinct from old.is_verified
      or new.total_chats is distinct from old.total_chats
      or new.report_count is distinct from old.report_count
      or new.karma is distinct from old.karma)
     and actor_role not in ('admin','superadmin') then
    raise exception 'Not allowed to change protected profile fields';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_columns on public.profiles;
create trigger profiles_protect_columns before update on public.profiles
  for each row execute procedure public.protect_profile_columns();

-- ─── OTP CODES: hashed codes, college type, attempt limit ──
alter table public.otp_codes drop constraint if exists otp_codes_type_check;
alter table public.otp_codes add constraint otp_codes_type_check
  check (type in ('verify', 'reset', 'delete', 'change_email', 'college_verify'));
alter table public.otp_codes add column if not exists attempts integer not null default 0;
-- Old plaintext codes are useless after the hashing change
delete from public.otp_codes where length(otp_hash) <> 64;

-- ─── CHAT HISTORY: written by the signaling server only ────
alter table public.chat_history drop constraint if exists chat_history_mode_check;
alter table public.chat_history add constraint chat_history_mode_check
  check (mode in ('video', 'text', 'voice', 'spy', 'speed_dating'));

-- Clients could previously insert fake rows to inflate total_chats / leaderboard.
drop policy if exists "Users can manage own history" on public.chat_history;
drop policy if exists "Users can view own history" on public.chat_history;
drop policy if exists "Users can delete own history" on public.chat_history;
create policy "Users can view own history" on public.chat_history
  for select using (auth.uid() = user_id);
create policy "Users can delete own history" on public.chat_history
  for delete using (auth.uid() = user_id);

create or replace function public.bump_total_chats()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('milobolo.internal', '1', true);
  update public.profiles set total_chats = total_chats + 1 where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists chat_history_bump_total on public.chat_history;
create trigger chat_history_bump_total after insert on public.chat_history
  for each row execute procedure public.bump_total_chats();

-- ─── REPORTS: details + reporter ───────────────────────────
alter table public.reports add column if not exists details text check (char_length(details) <= 500);
alter table public.reports add column if not exists reporter_key text;
create index if not exists idx_reports_status on public.reports(status, created_at desc);

-- ─── CHAT RATINGS → KARMA ──────────────────────────────────
create table if not exists public.chat_ratings (
  id uuid default uuid_generate_v4() primary key,
  rater_id uuid references public.profiles(id) on delete cascade not null,
  rated_id uuid references public.profiles(id) on delete cascade not null,
  room_id text not null,
  score smallint not null check (score in (-1, 1)),
  created_at timestamptz default now(),
  unique (rater_id, room_id)
);
create index if not exists idx_chat_ratings_rated on public.chat_ratings(rated_id);
alter table public.chat_ratings enable row level security;
drop policy if exists "Users can view ratings they gave" on public.chat_ratings;
create policy "Users can view ratings they gave" on public.chat_ratings
  for select using (auth.uid() = rater_id);
-- inserts happen through the signaling server (service role), which verifies the room

create or replace function public.apply_karma()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('milobolo.internal', '1', true);
  update public.profiles set karma = karma + new.score where id = new.rated_id;
  return new;
end;
$$;

drop trigger if exists chat_ratings_apply_karma on public.chat_ratings;
create trigger chat_ratings_apply_karma after insert on public.chat_ratings
  for each row execute procedure public.apply_karma();

-- ─── USER BLOCKS (strangers you never want to match again) ─
create table if not exists public.user_blocks (
  blocker_id uuid references public.profiles(id) on delete cascade not null,
  blocked_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
drop policy if exists "Users manage own blocks" on public.user_blocks;
create policy "Users manage own blocks" on public.user_blocks
  using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

-- ─── DIRECT MESSAGES (between accepted friends) ────────────
create table if not exists public.direct_messages (
  id uuid default uuid_generate_v4() primary key,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  receiver_id uuid references public.profiles(id) on delete cascade not null,
  body text not null check (char_length(body) between 1 and 1000),
  read_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_dm_pair on public.direct_messages(sender_id, receiver_id, created_at desc);
create index if not exists idx_dm_receiver_unread on public.direct_messages(receiver_id) where read_at is null;
alter table public.direct_messages enable row level security;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.connections
    where status = 'accepted'
      and ((requester_id = a and receiver_id = b) or (requester_id = b and receiver_id = a))
  );
$$;

drop policy if exists "Participants can read DMs" on public.direct_messages;
create policy "Participants can read DMs" on public.direct_messages
  for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
drop policy if exists "Friends can send DMs" on public.direct_messages;
create policy "Friends can send DMs" on public.direct_messages
  for insert with check (auth.uid() = sender_id and public.are_friends(sender_id, receiver_id));
drop policy if exists "Receiver can mark read" on public.direct_messages;
create policy "Receiver can mark read" on public.direct_messages
  for update using (auth.uid() = receiver_id);
drop policy if exists "Participants can delete DMs" on public.direct_messages;
create policy "Participants can delete DMs" on public.direct_messages
  for delete using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- ─── NOTIFICATIONS ─────────────────────────────────────────
create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('friend_request', 'friend_accepted', 'dm', 'system')),
  title text not null,
  body text,
  link text,
  actor_id uuid references public.profiles(id) on delete set null,
  read boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, read, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications
  for select using (auth.uid() = user_id);
drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications" on public.notifications
  for update using (auth.uid() = user_id);
drop policy if exists "Users delete own notifications" on public.notifications;
create policy "Users delete own notifications" on public.notifications
  for delete using (auth.uid() = user_id);

create or replace function public.notify_connection()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor_name text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select coalesce(display_name, username, 'Someone') into actor_name from public.profiles where id = new.requester_id;
    insert into public.notifications (user_id, type, title, body, link, actor_id)
    values (new.receiver_id, 'friend_request', actor_name || ' sent you a friend request', null, '/friends', new.requester_id);
  elsif new.status = 'accepted' and (tg_op = 'INSERT' or old.status is distinct from 'accepted') then
    select coalesce(display_name, username, 'Someone') into actor_name from public.profiles where id = new.receiver_id;
    insert into public.notifications (user_id, type, title, body, link, actor_id)
    values (new.requester_id, 'friend_accepted', actor_name || ' is now your friend', null, '/messages', new.receiver_id);
  end if;
  return new;
end;
$$;

drop trigger if exists connections_notify on public.connections;
create trigger connections_notify after insert or update on public.connections
  for each row execute procedure public.notify_connection();

-- One unread DM notification per sender (don't spam the bell)
create or replace function public.notify_dm()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor_name text;
begin
  select coalesce(display_name, username, 'A friend') into actor_name from public.profiles where id = new.sender_id;
  if not exists (
    select 1 from public.notifications
    where user_id = new.receiver_id and type = 'dm' and actor_id = new.sender_id and read = false
  ) then
    insert into public.notifications (user_id, type, title, body, link, actor_id)
    values (new.receiver_id, 'dm', 'New message from ' || actor_name, left(new.body, 120), '/messages?with=' || new.sender_id, new.sender_id);
  end if;
  return new;
end;
$$;

drop trigger if exists direct_messages_notify on public.direct_messages;
create trigger direct_messages_notify after insert on public.direct_messages
  for each row execute procedure public.notify_dm();

-- ─── CONNECTIONS: no duplicate pairs in either direction ───
-- The old chat flow inserted the same friendship from both clients; keep the oldest row.
delete from public.connections a
  using public.connections b
  where least(a.requester_id, a.receiver_id) = least(b.requester_id, b.receiver_id)
    and greatest(a.requester_id, a.receiver_id) = greatest(b.requester_id, b.receiver_id)
    and (a.created_at, a.id) > (b.created_at, b.id);
create unique index if not exists idx_connections_pair
  on public.connections (least(requester_id, receiver_id), greatest(requester_id, receiver_id));

-- ─── CHAT STATS: signaling server upserts daily totals ─────
alter table public.chat_stats add column if not exists voice_sessions integer default 0;
alter table public.chat_stats add column if not exists total_duration_seconds bigint default 0;

-- ─── ADMIN LOGS: admins can write ──────────────────────────
drop policy if exists "Admins can write logs" on public.admin_logs;
create policy "Admins can write logs" on public.admin_logs
  for insert with check (
    admin_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator','admin','superadmin'))
  );

-- ─── NEW FEATURE FLAGS ─────────────────────────────────────
insert into public.feature_flags (key, enabled, label, description) values
  ('voice_notes',     true, 'Voice Notes',      'Send short recorded voice messages in chat'),
  ('mini_games',      true, 'Mini Games',       'Play tic-tac-toe with your stranger'),
  ('direct_messages', true, 'Direct Messages',  'Private messaging between friends'),
  ('karma',           true, 'Karma Ratings',    'Rate strangers after a chat'),
  ('icebreakers',     true, 'Icebreakers',      'Suggest conversation starters')
on conflict (key) do nothing;
