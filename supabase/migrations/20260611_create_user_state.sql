-- Per-account cloud save: mirrors each user's full local game state so progress
-- follows the account across devices. One row per user, owner-only access.

create table if not exists public.user_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

-- A user may only read/write their own row.
create policy "user_state owner select"
  on public.user_state for select
  using (auth.uid() = user_id);

create policy "user_state owner insert"
  on public.user_state for insert
  with check (auth.uid() = user_id);

create policy "user_state owner update"
  on public.user_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
