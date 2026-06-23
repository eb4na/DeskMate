-- Study Buddy: ghost auto-dissolve.
--
-- A "ghost" buddy is one who has neither opened the buddy screen NOR studied for
-- GHOST_DAYS (3) days — i.e. genuinely disengaged (studying-but-not-opening does
-- NOT count as a ghost, since studying is the whole point). When a member ghosts,
-- the pairing dissolves so the active user isn't stuck and can re-match.
--
-- Run AFTER 20260622b_study_buddies.sql. Safe to re-run.

-- Per-member "last active on the buddy screen" timestamps (default to now so brand-new
-- pairs are never instantly ghosts). buddy_status() bumps the caller's column each call.
alter table public.buddy_pairs
  add column if not exists a_last_seen timestamptz not null default now(),
  add column if not exists b_last_seen timestamptz not null default now();

-- buddy_status return type gains ended_reason, so the screen can tell the user WHY a
-- match ended (ghost / left / expired). Changing the TABLE return type needs a drop.
drop function if exists public.buddy_status(uuid);

create or replace function public.buddy_status(p_pair uuid)
returns table (
  ends_at timestamptz,
  pair_status text,
  ended_reason text,
  partner_name text,
  partner_companion text,
  partner_skin text,
  partner_background text,
  partner_streak int,
  partner_studied_today boolean,
  i_want_friend boolean,
  partner_wants_friend boolean
)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  bp public.buddy_pairs;
  partner uuid;
  pday text;
  ptz text;
  pupd timestamptz;
  ptoday text;
  partner_seen timestamptz;
begin
  select * into bp from public.buddy_pairs where id = p_pair;
  if not found or (bp.user_a <> me and bp.user_b <> me) then
    raise exception 'not your buddy';
  end if;
  partner := case when bp.user_a = me then bp.user_b else bp.user_a end;
  partner_seen := case when bp.user_a = me then bp.b_last_seen else bp.a_last_seen end;

  -- Mark ME active right now (this is what keeps the OTHER side from ghosting me).
  if bp.user_a = me then
    update public.buddy_pairs set a_last_seen = now() where id = p_pair;
  else
    update public.buddy_pairs set b_last_seen = now() where id = p_pair;
  end if;

  select last_study_date, tz, updated_at into pday, ptz, pupd
    from public.study_days where user_id = partner;

  -- Ghost: partner hasn't opened the buddy screen OR studied in 3 days → dissolve now.
  if bp.status = 'active'
     and greatest(partner_seen, coalesce(pupd, bp.started_at)) < now() - interval '3 days' then
    update public.buddy_pairs set status = 'ended', ended_reason = 'ghost'
      where id = p_pair and status = 'active';
    bp.status := 'ended';
    bp.ended_reason := 'ghost';
  end if;

  -- partner's "today" in THEIR timezone (they store last_study_date the same way)
  begin
    ptoday := to_char((now() at time zone coalesce(nullif(ptz, ''), 'UTC')), 'YYYY-MM-DD');
  exception when others then
    ptoday := to_char(now() at time zone 'UTC', 'YYYY-MM-DD');
  end;

  return query
    select bp.ends_at,
           bp.status,
           bp.ended_reason,
           p.display_name,
           p.companion_id,
           coalesce(nullif(p.skin_id, ''), 'classic'),
           coalesce(nullif(p.background_id, ''), 'cozy'),
           coalesce(p.current_streak, 0),
           (pday is not null and pday <> '' and pday = ptoday),
           case when bp.user_a = me then bp.a_wants_friend else bp.b_wants_friend end,
           case when bp.user_a = me then bp.b_wants_friend else bp.a_wants_friend end
    from public.profiles p
    where p.user_id = partner;
end;
$$;

-- match_study_buddy gains ghost cleanup in its lazy housekeeping, so a ghosted user's
-- partner can immediately re-match. Same return signature → create or replace is fine.
create or replace function public.match_study_buddy()
returns table (status text, pair_id uuid, ends_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_band int;
  partner uuid;
  new_id uuid;
  new_ends timestamptz;
  existing public.buddy_pairs;
begin
  if me is null then raise exception 'not authenticated'; end if;

  -- Lazy housekeeping: end pairs whose week is up …
  update public.buddy_pairs
    set status = 'ended', ended_reason = coalesce(ended_reason, 'expired')
    where status = 'active' and ends_at <= now();

  -- … or where EITHER member has ghosted (no screen-open AND no study) for 3 days.
  update public.buddy_pairs bp
    set status = 'ended', ended_reason = 'ghost'
    where bp.status = 'active'
      and (
        greatest(bp.a_last_seen, coalesce((select updated_at from public.study_days s where s.user_id = bp.user_a), bp.started_at)) < now() - interval '3 days'
        or
        greatest(bp.b_last_seen, coalesce((select updated_at from public.study_days s where s.user_id = bp.user_b), bp.started_at)) < now() - interval '3 days'
      );

  -- Already paired? Return the existing pair.
  select * into existing from public.buddy_pairs
    where status = 'active' and (user_a = me or user_b = me)
    limit 1;
  if found then
    return query select 'matched'::text, existing.id, existing.ends_at;
    return;
  end if;

  my_band := public.age_band_from_birthday((select birthday from public.profiles where user_id = me));
  if my_band is null then raise exception 'birthday required'; end if;

  if public.buddy_report_count(me) >= 3 then
    raise exception 'account restricted';
  end if;

  select q.user_id into partner
  from public.buddy_queue q
  where q.age_band = my_band
    and q.user_id <> me
    and public.buddy_report_count(q.user_id) < 3
    and not exists (
      select 1 from public.blocked_codes b
      join public.profiles p on p.friend_code = b.blocked_code
      where b.user_id = me and p.user_id = q.user_id)
    and not exists (
      select 1 from public.blocked_codes b
      join public.profiles p on p.friend_code = b.blocked_code
      where b.user_id = q.user_id and p.user_id = me)
    and not exists (
      select 1 from public.buddy_pairs bp
      where bp.status = 'active' and (bp.user_a = q.user_id or bp.user_b = q.user_id))
  order by q.enqueued_at asc
  for update skip locked
  limit 1;

  if partner is not null then
    delete from public.buddy_queue where user_id in (me, partner);
    new_ends := now() + interval '7 days';
    insert into public.buddy_pairs (user_a, user_b, ends_at)
      values (me, partner, new_ends)
      returning id into new_id;
    return query select 'matched'::text, new_id, new_ends;
    return;
  else
    insert into public.buddy_queue (user_id, age_band)
      values (me, my_band)
      on conflict (user_id) do update set age_band = excluded.age_band;
    return query select 'waiting'::text, null::uuid, null::timestamptz;
    return;
  end if;
end;
$$;

grant execute on function public.match_study_buddy() to authenticated;
grant execute on function public.buddy_status(uuid) to authenticated;
