-- Mail to ONE player, and mail that gifts Plus.
--
-- target_user_id: null = broadcast (as before); set = only that player can see or
--   claim it. Enforced by RLS + claim_mail, so it works on app builds that predate
--   this column (their `select` just never receives other players' mail).
-- grants_plus / plus_until: claiming records the player in public.plus_comps
--   (20261117_plus_comps.sql) — lifetime when plus_until is null. Builds with comp
--   support turn Plus on at claim and keep it on every launch; older iOS builds
--   ignore the flag (their launch check revokes non-store Plus), but the comp row is
--   already there for when they update.
--
-- Send targeted Plus mail:
--   insert into public.mail (title, body, coins, target_user_id, grants_plus, active)
--   values ('A gift for you!', '...', 0,
--           (select user_id from public.profiles where upper(friend_code) = '<CODE>'),
--           true, true);

alter table public.mail add column if not exists target_user_id uuid references auth.users (id) on delete cascade;
alter table public.mail add column if not exists grants_plus boolean not null default false;
alter table public.mail add column if not exists plus_until timestamptz;

create index if not exists mail_target_user_id_idx on public.mail (target_user_id) where target_user_id is not null;

drop policy if exists "mail_read" on public.mail;
create policy "mail_read"
  on public.mail
  for select
  to authenticated, anon
  using (
    active
    and (expires_at is null or expires_at > now())
    and (target_user_id is null or target_user_id = (select auth.uid()))
  );

create or replace function public.claim_mail(p_mail_id uuid, p_item_id text default null)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  m public.mail;
  v_new boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Mail must exist, be active, not expired, and be addressed to everyone or to me.
  select * into m
  from public.mail
  where id = p_mail_id
    and active
    and (expires_at is null or expires_at > now())
    and (target_user_id is null or target_user_id = auth.uid());
  if not found then
    return false;
  end if;

  -- Validate the chosen item against what the mail actually offers.
  if m.item_choices is not null and array_length(m.item_choices, 1) > 0 then
    -- "pick one" mail: the item must be one of the offered choices.
    if p_item_id is null or not (p_item_id = any (m.item_choices)) then
      raise exception 'invalid item choice for this mail';
    end if;
  elsif m.item_id is not null then
    -- fixed-item mail: only that item (or nothing) is acceptable.
    if p_item_id is not null and p_item_id <> m.item_id then
      raise exception 'invalid item choice for this mail';
    end if;
  else
    -- announcement / coins-only mail: ignore any provided item id.
    p_item_id := null;
  end if;

  -- Record the claim; a conflict means it was already claimed → report no new claim.
  insert into public.mail_claims (user_id, mail_id, item_id)
  values (auth.uid(), p_mail_id, p_item_id)
  on conflict (user_id, mail_id) do nothing;
  v_new := found;  -- captured BEFORE any later statement resets FOUND

  -- Plus gift: record the comp. Lifetime (null) always wins; otherwise keep the later date.
  if v_new and m.grants_plus then
    insert into public.plus_comps (user_id, until, note)
    values (auth.uid(), m.plus_until, 'mail ' || p_mail_id::text)
    on conflict (user_id) do update
      set until = case
        when public.plus_comps.until is null or excluded.until is null then null
        else greatest(public.plus_comps.until, excluded.until)
      end;
  end if;

  return v_new;  -- true only if a claim row was actually inserted
end;
$function$;
