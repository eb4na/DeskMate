-- Study Buddy: fix "column reference \"status\" is ambiguous" on Find a buddy.
--
-- match_study_buddy() RETURNS TABLE (status text, pair_id uuid, ends_at timestamptz),
-- so `status` and `ends_at` are output variables in scope inside the body. Two
-- queries referenced `status` / `ends_at` UNqualified against public.buddy_pairs, so
-- Postgres couldn't tell the output variable from the table column and raised
-- "column reference \"status\" is ambiguous", which surfaced as "Something went wrong".
--
-- Fix: alias buddy_pairs and fully qualify those column references. The return shape
-- (status / pair_id / ends_at) is unchanged, so the client contract is untouched.
--
-- Run AFTER 20260622b + 20260622c. Safe to re-run (create or replace only).

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

  -- Lazy housekeeping: end pairs whose week is up … (aliased so `status`/`ends_at`
  -- bind to the table column, not this function's same-named OUT variables).
  update public.buddy_pairs bp
    set status = 'ended', ended_reason = coalesce(bp.ended_reason, 'expired')
    where bp.status = 'active' and bp.ends_at <= now();

  -- … or where EITHER member has ghosted (no screen-open AND no study) for 3 days.
  update public.buddy_pairs bp
    set status = 'ended', ended_reason = 'ghost'
    where bp.status = 'active'
      and (
        greatest(bp.a_last_seen, coalesce((select updated_at from public.study_days s where s.user_id = bp.user_a), bp.started_at)) < now() - interval '3 days'
        or
        greatest(bp.b_last_seen, coalesce((select updated_at from public.study_days s where s.user_id = bp.user_b), bp.started_at)) < now() - interval '3 days'
      );

  -- Already paired? Return the existing pair (aliased to avoid the same ambiguity).
  select * into existing from public.buddy_pairs bp
    where bp.status = 'active' and (bp.user_a = me or bp.user_b = me)
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
