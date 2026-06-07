-- Shareable profile cards, looked up by friend code so a friend's app can show
-- the character/outfit/stats they actually chose. Public-readable; only the
-- owner can write their own row.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  friend_code text unique not null,
  display_name text not null default '',
  description text not null default '',
  birthday text not null default '',
  companion_id text not null default '',
  skin_id text not null default 'classic',
  background_id text not null default 'cozy',
  current_streak int not null default 0,
  longest_streak int not null default 0,
  total_minutes int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone (incl. anon) can read a profile — that's how friends fetch your card.
drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read"
  on public.profiles for select
  using (true);

-- A signed-in user can only create/update/delete their own row.
drop policy if exists "profiles_owner_write" on public.profiles;
create policy "profiles_owner_write"
  on public.profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
