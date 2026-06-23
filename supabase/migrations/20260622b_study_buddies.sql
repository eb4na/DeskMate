-- Study Buddy Matching: randomly pair a user with a stranger accountability
-- partner for one week, with a daily "did your buddy study today?" check-in.
--
-- SAFETY MODEL (this is a 13+ app, so pairing is the highest-risk social surface):
--   • Age-band matching only — a 13-year-old is never paired with an adult. Band is
--     computed SERVER-SIDE from profiles.birthday, never trusted from the client.
--   • The waiting pool (buddy_queue) is NEVER client-readable; matching happens only
--     inside the SECURITY DEFINER match_study_buddy() RPC.
--   • No free text between buddies — only "studied today" status + a few canned cheers.
--   • The partner's friend_code is never exposed to the client; it is revealed ONLY
--     when BOTH tap "become friends" (buddy_become_friends).
--   • Report writes to the existing user_reports moderation table, blocks the partner,
--     and ends the pairing; repeatedly-reported accounts are auto-excluded from matching.
--
-- The founder runs this migration (service role); like the other social features it
-- needs no app rebuild, just the SQL applied to Supabase.

-- ── Tables ───────────────────────────────────────────────────────────────────

-- Per-user most-recent completed-session date, stored as the account-timezone ISO
-- string the app already uses for streaks (todayISO()). This is the daily-study
-- signal a buddy's check-in reads — it did not exist server-side before.
create table if not exists public.study_days (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_study_date text not null, -- YYYY-MM-DD in the account's captured timezone
  tz text not null default 'UTC', -- the account's IANA timezone (so a buddy can ask "did they study on THEIR today")
  updated_at timestamptz not null default now()
);

-- Opted-in users waiting for a match. The pool is hidden: no SELECT policy, and
-- inserts happen only inside match_study_buddy(). A user may cancel (delete own row).
create table if not exists public.buddy_queue (
  user_id uuid primary key references auth.users (id) on delete cascade,
  age_band int not null, -- 1 = 13–15, 2 = 16–17, 3 = 18+
  enqueued_at timestamptz not null default now()
);
create index if not exists buddy_queue_match_idx on public.buddy_queue (age_band, enqueued_at);

-- Active and past pairings. One week long, then auto-ended (lazily, on next match call).
create table if not exists public.buddy_pairs (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'active', -- active | ended
  ended_reason text,                     -- expired | left | reported | ghost
  a_wants_friend boolean not null default false,
  b_wants_friend boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists buddy_pairs_a_idx on public.buddy_pairs (user_a, status);
create index if not exists buddy_pairs_b_idx on public.buddy_pairs (user_b, status);

-- Canned cheers (no free text). Also drives the ~1/day rate limit.
create table if not exists public.buddy_nudges (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.buddy_pairs (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  kind text not null, -- preset cheer id (e.g. 'keep_going')
  created_at timestamptz not null default now()
);
create index if not exists buddy_nudges_pair_idx on public.buddy_nudges (pair_id, created_at desc);

-- ── Row level security ───────────────────────────────────────────────────────

alter table public.study_days enable row level security;
create policy "study_days own" on public.study_days for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.buddy_queue enable row level security;
-- A user can see ONLY their own waiting row and cancel it. There is deliberately no
-- broad SELECT — the pool of opted-in minors must never be readable by a client.
create policy "buddy_queue own select" on public.buddy_queue for select
  using (auth.uid() = user_id);
create policy "buddy_queue own delete" on public.buddy_queue for delete
  using (auth.uid() = user_id);
-- (no insert/update policy: enqueueing happens only inside match_study_buddy())

alter table public.buddy_pairs enable row level security;
create policy "buddy_pairs member select" on public.buddy_pairs for select
  using (auth.uid() = user_a or auth.uid() = user_b);
-- (no insert/update policy: all writes go through the SECURITY DEFINER RPCs)

alter table public.buddy_nudges enable row level security;
create policy "buddy_nudges member select" on public.buddy_nudges for select
  using (exists (
    select 1 from public.buddy_pairs bp
    where bp.id = buddy_nudges.pair_id
      and (bp.user_a = auth.uid() or bp.user_b = auth.uid())
  ));
-- (no insert policy: cheers go through send_cheer() so the 1/day limit is enforced)

-- ── Helpers ──────────────────────────────────────────────────────────────────

-- Age band from a stored ISO birthday. Returns null if under 13 or unparseable, so
-- such accounts can never be matched. STABLE (depends on current_date), not immutable.
create or replace function public.age_band_from_birthday(bday text)
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

-- How many distinct accounts have reported this user (via the existing user_reports
-- moderation table, keyed by friend_code). Used to auto-exclude repeat offenders.
create or replace function public.buddy_report_count(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(distinct r.reporter_id)::int
  from public.user_reports r
  join public.profiles p on p.friend_code = r.reported_code
  where p.user_id = p_user;
$$;

-- ── Matching RPC ─────────────────────────────────────────────────────────────

-- Find or create this user's active buddy. Atomic + concurrency-safe (FOR UPDATE
-- SKIP LOCKED). Returns ('matched', pair_id, ends_at) or ('waiting', null, null).
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

  -- Lazy housekeeping: end any pairs whose week is up.
  update public.buddy_pairs
    set status = 'ended', ended_reason = coalesce(ended_reason, 'expired')
    where status = 'active' and ends_at <= now();

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

  -- Excessively-reported accounts cannot be matched (in either direction).
  if public.buddy_report_count(me) >= 3 then
    raise exception 'account restricted';
  end if;

  -- Oldest compatible waiter: same age band, not me, not over the report threshold,
  -- not mutually blocked, and not already paired.
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

-- ── Buddy status (what the check-in screen reads) ────────────────────────────

-- Returns only the safe, display-level facts about the partner: NO friend_code,
-- NO birthday, NO total minutes. studied_today is computed against the PARTNER's own
-- timezone (stored in study_days.tz), so it means "did they study on their today".
create or replace function public.buddy_status(p_pair uuid)
returns table (
  ends_at timestamptz,
  pair_status text,
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
  ptoday text;
begin
  select * into bp from public.buddy_pairs where id = p_pair;
  if not found or (bp.user_a <> me and bp.user_b <> me) then
    raise exception 'not your buddy';
  end if;
  partner := case when bp.user_a = me then bp.user_b else bp.user_a end;
  select last_study_date, tz into pday, ptz from public.study_days where user_id = partner;
  -- The partner's "today" in THEIR timezone — they stored last_study_date the same way.
  begin
    ptoday := to_char((now() at time zone coalesce(nullif(ptz, ''), 'UTC')), 'YYYY-MM-DD');
  exception when others then
    ptoday := to_char(now() at time zone 'UTC', 'YYYY-MM-DD');
  end;

  return query
    select bp.ends_at,
           bp.status,
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

-- ── Cheers (canned, rate-limited ~1/day) ─────────────────────────────────────

create or replace function public.send_cheer(p_pair uuid, p_kind text)
returns boolean language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); bp public.buddy_pairs; recent int;
begin
  select * into bp from public.buddy_pairs where id = p_pair and status = 'active';
  if not found or (bp.user_a <> me and bp.user_b <> me) then raise exception 'not your buddy'; end if;
  select count(*) into recent from public.buddy_nudges
    where pair_id = p_pair and from_user = me and created_at > now() - interval '20 hours';
  if recent > 0 then return false; end if; -- one cheer per ~day
  insert into public.buddy_nudges (pair_id, from_user, kind) values (p_pair, me, p_kind);
  return true;
end;
$$;

-- ── Leave / report ───────────────────────────────────────────────────────────

create or replace function public.leave_buddy(p_pair uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); bp public.buddy_pairs;
begin
  select * into bp from public.buddy_pairs where id = p_pair;
  if not found or (bp.user_a <> me and bp.user_b <> me) then raise exception 'not your buddy'; end if;
  update public.buddy_pairs set status = 'ended', ended_reason = coalesce(ended_reason, 'left')
    where id = p_pair and status = 'active';
  return true;
end;
$$;

-- Report ends the pair, files a row in the existing user_reports moderation table,
-- and blocks the partner so they can never be re-matched. The client never sees the
-- partner's friend_code — it is resolved here, server-side.
create or replace function public.report_buddy(p_pair uuid, p_reason text, p_details text)
returns boolean language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); bp public.buddy_pairs; partner uuid; my_code text; partner_code text;
begin
  select * into bp from public.buddy_pairs where id = p_pair;
  if not found or (bp.user_a <> me and bp.user_b <> me) then raise exception 'not your buddy'; end if;
  partner := case when bp.user_a = me then bp.user_b else bp.user_a end;
  select friend_code into my_code from public.profiles where user_id = me;
  select friend_code into partner_code from public.profiles where user_id = partner;

  insert into public.user_reports (reporter_id, reporter_code, reported_code, reason, details)
    values (me, my_code, coalesce(partner_code, ''), coalesce(nullif(p_reason, ''), 'study_buddy'), coalesce(p_details, ''));

  if partner_code is not null and partner_code <> '' then
    insert into public.blocked_codes (user_id, blocked_code)
      values (me, partner_code)
      on conflict (user_id, blocked_code) do nothing;
  end if;

  update public.buddy_pairs set status = 'ended', ended_reason = 'reported' where id = p_pair;
  return true;
end;
$$;

-- ── Become friends (mutual, the only path that reveals identity) ──────────────

create or replace function public.buddy_become_friends(p_pair uuid)
returns table (now_friends boolean, partner_code text)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  bp public.buddy_pairs;
  partner uuid;
  a_flag boolean;
  b_flag boolean;
  my_code text;
  partner_c text;
begin
  select * into bp from public.buddy_pairs where id = p_pair;
  if not found or (bp.user_a <> me and bp.user_b <> me) then raise exception 'not your buddy'; end if;

  if bp.user_a = me then
    update public.buddy_pairs set a_wants_friend = true where id = p_pair
      returning a_wants_friend, b_wants_friend into a_flag, b_flag;
  else
    update public.buddy_pairs set b_wants_friend = true where id = p_pair
      returning a_wants_friend, b_wants_friend into a_flag, b_flag;
  end if;

  partner := case when bp.user_a = me then bp.user_b else bp.user_a end;
  select friend_code into my_code from public.profiles where user_id = me;
  select friend_code into partner_c from public.profiles where user_id = partner;

  if a_flag and b_flag then
    -- Only now, with both sides opted in, create a normal accepted friend link and
    -- reveal the code. Idempotent.
    insert into public.friend_requests (from_user, from_code, to_user, to_code, status)
      values (me, my_code, partner, partner_c, 'accepted')
      on conflict (from_user, to_user) do update set status = 'accepted';
    return query select true, partner_c;
  else
    return query select false, null::text;
  end if;
end;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────────

grant execute on function public.match_study_buddy() to authenticated;
grant execute on function public.buddy_status(uuid) to authenticated;
grant execute on function public.send_cheer(uuid, text) to authenticated;
grant execute on function public.leave_buddy(uuid) to authenticated;
grant execute on function public.report_buddy(uuid, text, text) to authenticated;
grant execute on function public.buddy_become_friends(uuid) to authenticated;
