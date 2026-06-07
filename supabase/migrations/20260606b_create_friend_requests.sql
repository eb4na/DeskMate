-- Friend requests: you send a request by code; the other person accepts or
-- declines. Both sides become friends only after acceptance.
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  from_code text not null,
  to_user uuid not null references auth.users (id) on delete cascade,
  to_code text not null,
  status text not null default 'pending', -- pending | accepted | declined
  created_at timestamptz not null default now(),
  unique (from_user, to_user)
);

alter table public.friend_requests enable row level security;

-- Either party can see a request that involves them.
drop policy if exists "fr_select" on public.friend_requests;
create policy "fr_select" on public.friend_requests for select
  using (auth.uid() = from_user or auth.uid() = to_user);

-- You can only create a request as yourself.
drop policy if exists "fr_insert" on public.friend_requests;
create policy "fr_insert" on public.friend_requests for insert
  with check (auth.uid() = from_user);

-- The recipient accepts/declines; either party can update (e.g. re-send).
drop policy if exists "fr_update" on public.friend_requests;
create policy "fr_update" on public.friend_requests for update
  using (auth.uid() = from_user or auth.uid() = to_user)
  with check (auth.uid() = from_user or auth.uid() = to_user);

-- Either party can remove the relationship.
drop policy if exists "fr_delete" on public.friend_requests;
create policy "fr_delete" on public.friend_requests for delete
  using (auth.uid() = from_user or auth.uid() = to_user);
