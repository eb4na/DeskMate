-- Per-user block list. Blocking a friend removes the friendship and adds the
-- other player's friend_code here; the client then filters blocked codes out of
-- incoming friend requests and direct messages ("hide them"). Owner-only.

create table if not exists public.blocked_codes (
  user_id uuid not null references auth.users(id) on delete cascade,
  blocked_code text not null,
  created_at timestamptz default now(),
  primary key (user_id, blocked_code)
);

alter table public.blocked_codes enable row level security;

create policy "own blocks"
  on public.blocked_codes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
