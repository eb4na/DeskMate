-- Suggested players: drop the age-band requirement.
-- Approved by the founder on 2026-09-16 after the root cause below was explained,
-- including that the age band no longer reflects anyone's real age.
--
-- WHY: the original (20260624b) only suggested people in the caller's own age band,
-- derived from `profiles.birthday` via suggest_age_band(). That worked while sign-up
-- collected a date of birth. App Review rejected the DOB wheel under guideline
-- 5.1.1(v) and it was removed on 2026-09-02 (commit 8c1219b) — sign-up now only
-- affirms 13+ and stores nothing. Since then `profiles.birthday` is empty for every
-- new account, `me.band` is null, and the RPC returns ZERO rows for everyone, so the
-- Friends screen hides the Suggested row entirely (it hides when the list is empty).
--
-- The band was already unreliable in any case: the only birthday left is the OPTIONAL
-- month/day set in Settings, whose picker HIDES the year and seeds 2008 — so the band
-- reflects whatever year happened to be stored, not a real age nobody was asked for.
-- Measured on 2026-09-16: of 18 profiles, 7 had no band at all, 9 computed as 18+ and
-- 2 as 16–17.
--
-- WHAT CHANGES: suggestions are now drawn from all other players. Everything else is
-- untouched — self, any existing friend_request in either direction (pending,
-- accepted or declined), and blocks in either direction are still excluded, and
-- friend requests still have to be accepted before anyone is connected.
--
-- suggest_age_band() is deliberately LEFT IN PLACE: other RPCs still reference it.
--
-- Run in Supabase (SQL editor, service role). Safe to re-run.

create or replace function public.suggested_players(p_limit int default 12)
returns table (
  friend_code text,
  display_name text,
  companion_id text,
  skin_id text,
  background_id text,
  avatar_frame text,
  card_color text,
  current_streak int,
  longest_streak int,
  total_minutes int
)
language sql security definer set search_path = public volatile as $$
  with me as (
    select user_id, friend_code
    from public.profiles where user_id = auth.uid()
  )
  select p.friend_code, p.display_name, p.companion_id, p.skin_id, p.background_id,
         p.avatar_frame, p.card_color, p.current_streak, p.longest_streak, p.total_minutes
  from public.profiles p, me
  where p.user_id <> me.user_id
    -- no existing relationship (pending/accepted/declined), either direction
    and not exists (
      select 1 from public.friend_requests fr
      where (fr.from_user = me.user_id and fr.to_user = p.user_id)
         or (fr.to_user = me.user_id and fr.from_user = p.user_id))
    -- neither has blocked the other
    and not exists (
      select 1 from public.blocked_codes b
      where b.user_id = me.user_id and b.blocked_code = p.friend_code)
    and not exists (
      select 1 from public.blocked_codes b
      where b.user_id = p.user_id and b.blocked_code = me.friend_code)
  order by random()
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;

grant execute on function public.suggested_players(int) to authenticated;
