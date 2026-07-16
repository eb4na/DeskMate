-- Broadcast mail / inbox.
--
-- The founder sends a piece of mail to EVERYONE by inserting one row here (via the
-- Supabase SQL editor / dashboard — the service role bypasses RLS). Every signed-in
-- or guest client reads active, non-expired mail and can claim its reward once.
-- "Claimed" state lives per-device in the app's persisted state (claimedMailIds),
-- synced to the cloud like the rest of the player's save — so no per-user mail rows
-- are needed for a simple broadcast.

create table if not exists public.mail (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  title       text not null,
  body        text not null default '',
  coins       integer not null default 0,   -- coins granted on claim (0 = none)
  item_id     text,                          -- optional shop item id to unlock (skin/companion/desk/…)
  expires_at  timestamptz,                   -- optional; hidden after this time
  active      boolean not null default true  -- flip to false to retract a mail
);

alter table public.mail enable row level security;

-- Anyone (guests included — they use the anon key) can read live mail. There is
-- deliberately NO insert/update/delete policy, so only the service role (you, in
-- the Supabase SQL editor) can write. Players can never grant themselves rewards.
drop policy if exists mail_read on public.mail;
create policy mail_read on public.mail
  for select
  to anon, authenticated
  using (active and (expires_at is null or expires_at > now()));

-- ─────────────────────────────────────────────────────────────────────────────
-- HOW TO SEND MAIL (run in the Supabase SQL editor):
--
--   -- Give everyone 500 coins:
--   insert into public.mail (title, body, coins)
--   values ('A little gift!', 'Thanks for studying with us. Enjoy some coins!', 500);
--
--   -- Give everyone coins + unlock a shop item (use the item''s shop id):
--   insert into public.mail (title, body, coins, item_id)
--   values ('Surprise outfit!', 'A new look, on the house.', 200, 'outfit_bunny_palace');
--
--   -- Announcement only (no reward): coins 0, item_id null.
--   insert into public.mail (title, body) values ('Update 1.2 is here', 'New games + skins added!');
--
--   -- Time-limited mail (auto-hides after the date):
--   insert into public.mail (title, body, coins, expires_at)
--   values ('Weekend bonus', 'Claim before Monday!', 300, now() + interval '3 days');
--
--   -- Retract a mail you already sent:  update public.mail set active = false where id = '<uuid>';
-- ─────────────────────────────────────────────────────────────────────────────
