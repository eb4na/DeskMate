-- Lock down the `profiles` table. Until now the SELECT policy was
-- `to authenticated using (true)` (see 20260622d_profiles_authed_read.sql), so ANY
-- signed-in account could `select * from profiles` and harvest EVERY user's birthday
-- (DOB), friend_code, and stats — i.e. scrape the whole user base, including the ages
-- of minors. For a 13+ app that's a privacy + minor-safety problem.
--
-- Fix: remove the blanket read. Profile cards are now fetched through a SECURITY
-- DEFINER RPC that returns only SAFE fields (display name, companion, stats, and the
-- birthday's MONTH/DAY with the year masked) on an EXACT friend-code match. The owner
-- can still read/write their own row (profiles_owner_write, FOR ALL). The real DOB year
-- stays server-side only; it's consumed by the age-band RPCs (suggested_players /
-- match_study_buddy), which run as definer and read profiles directly.
--
-- This mirrors the approach already used by suggested_players() in
-- 20260624b_suggested_players.sql. Run in Supabase (SQL editor, service role).
-- Safe to re-run.

-- 0. Make sure the columns the RPC returns all exist (some projects may not have had
--    every later profile migration applied). All `if not exists`, so a no-op when present.
alter table public.profiles add column if not exists avatar_frame   text not null default 'none';
alter table public.profiles add column if not exists card_color     text not null default 'pink';
alter table public.profiles add column if not exists top_chef_level int  not null default 1;

-- 1. Drop the blanket authenticated read. Owner read/write remains via
--    profiles_owner_write (a FOR ALL policy, which covers SELECT of one's own row).
drop policy if exists "profiles_authed_read" on public.profiles;
drop policy if exists "profiles_public_read" on public.profiles;

-- 2. Safe profile lookup by friend code. Returns at most one row, only the fields a
--    friend card displays — and `user_id` so the friend-request / DM flows can resolve
--    a code to a user.
--    The `birthday` returned here is YEAR-MASKED to a fixed year (2000): the friend
--    card only ever shows month + day (a "happy birthday" cue), so we deliberately
--    never expose the real year — that's what would let anyone infer a user's age. The
--    true DOB stays server-side, read only by the age-band RPCs (definer).
create or replace function public.get_profile_by_code(p_code text)
returns table (
  user_id text,
  friend_code text,
  display_name text,
  description text,
  birthday text,
  companion_id text,
  skin_id text,
  background_id text,
  avatar_frame text,
  card_color text,
  current_streak int,
  longest_streak int,
  total_minutes int,
  top_chef_level int
)
language sql security definer set search_path = public stable as $$
  select p.user_id::text, p.friend_code, p.display_name, p.description,
         -- month/day only, with the year forced to 2000 (no real-age leak).
         case when p.birthday ~ '^\d{4}-\d{2}-\d{2}' then '2000-' || substr(p.birthday, 6, 5)
              else '' end as birthday,
         p.companion_id, p.skin_id, p.background_id, p.avatar_frame, p.card_color,
         p.current_streak, p.longest_streak, p.total_minutes,
         coalesce(p.top_chef_level, 1)
  from public.profiles p
  where p.friend_code = upper(trim(p_code))
  limit 1;
$$;

-- Only signed-in users can look up profiles (no anonymous scraping). The RPC still
-- exposes one row per known code, but it omits DOB and requires knowing the code.
revoke all on function public.get_profile_by_code(text) from public;
grant execute on function public.get_profile_by_code(text) to authenticated;
