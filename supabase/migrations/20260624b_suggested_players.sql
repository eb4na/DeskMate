-- Suggested players: replaces the removed Study Buddy matcher with a "people you can
-- friend" list. Returns a random sample of OTHER players in the caller's own age band
-- (minor-safety: minors only see minors), excluding anyone already connected.
--
-- SECURITY DEFINER so it can read across profiles for the match WITHOUT loosening the
-- profiles RLS (which is authed-only, to stop client-side scraping of the user base).
-- Self-contained: its own age-band helper + ensures blocked_codes exists, so it does
-- NOT depend on the study-buddy or block-friend migrations being applied first.
--
-- Run in Supabase (SQL editor, service role). Safe to re-run.

-- Per-user block list (from the block-friend feature). Created here too so this RPC's
-- "exclude blocked accounts" check works even if that migration wasn't applied yet.
-- `if not exists` / `drop policy if exists` keep it a no-op when it already exists.
create table if not exists public.blocked_codes (
  user_id uuid not null references auth.users(id) on delete cascade,
  blocked_code text not null,
  created_at timestamptz default now(),
  primary key (user_id, blocked_code)
);
alter table public.blocked_codes enable row level security;
drop policy if exists "own blocks" on public.blocked_codes;
create policy "own blocks"
  on public.blocked_codes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Age band from a stored YYYY-MM-DD birthday: <13 → null (shouldn't exist, 13+ app),
-- 13–15 → 1, 16–17 → 2, 18+ → 3. Mirrors the app's age gate.
create or replace function public.suggest_age_band(bday text)
returns int language plpgsql stable as $$
declare y int;
begin
  if bday is null or length(trim(bday)) < 10 then return null; end if;
  begin
    y := date_part('year', age(current_date, bday::date))::int;
  exception when others then
    return null;
  end;
  if y < 13 then return null;
  elsif y <= 15 then return 1;
  elsif y <= 17 then return 2;
  else return 3;
  end if;
end;
$$;

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
    select user_id, friend_code, public.suggest_age_band(birthday) as band
    from public.profiles where user_id = auth.uid()
  )
  select p.friend_code, p.display_name, p.companion_id, p.skin_id, p.background_id,
         p.avatar_frame, p.card_color, p.current_streak, p.longest_streak, p.total_minutes
  from public.profiles p, me
  where p.user_id <> me.user_id
    and me.band is not null
    and public.suggest_age_band(p.birthday) = me.band
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
