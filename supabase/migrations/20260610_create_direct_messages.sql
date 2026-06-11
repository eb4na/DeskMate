-- Direct messages: 1-to-1 chat between friends. History lives here (so messages
-- sent while the recipient is offline are delivered on next open); live updates
-- ride on a Supabase Realtime broadcast channel, so the table itself does not
-- need to be in the realtime publication.
--
-- `kind` is 'text' for a normal message or 'invite' for a study/game invite, in
-- which case `invite` holds { game, room }. `body` is already profanity-masked
-- by the client before insert.
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  from_code text not null,
  to_code text not null,
  kind text not null default 'text', -- text | invite
  body text,
  invite jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists dm_pair_idx on public.direct_messages (from_user, to_user, created_at);
create index if not exists dm_unread_idx on public.direct_messages (to_user, read_at);

alter table public.direct_messages enable row level security;

-- Either party in the conversation can read it.
drop policy if exists "dm_select" on public.direct_messages;
create policy "dm_select" on public.direct_messages for select
  using (auth.uid() = from_user or auth.uid() = to_user);

-- You can only send a message as yourself.
drop policy if exists "dm_insert" on public.direct_messages;
create policy "dm_insert" on public.direct_messages for insert
  with check (auth.uid() = from_user);

-- Only the recipient marks messages read (sets read_at).
drop policy if exists "dm_update" on public.direct_messages;
create policy "dm_update" on public.direct_messages for update
  using (auth.uid() = to_user)
  with check (auth.uid() = to_user);

-- Either party can delete messages in their conversation.
drop policy if exists "dm_delete" on public.direct_messages;
create policy "dm_delete" on public.direct_messages for delete
  using (auth.uid() = from_user or auth.uid() = to_user);
