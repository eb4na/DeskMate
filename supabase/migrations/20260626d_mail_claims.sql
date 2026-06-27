-- Server-side mail-claim tracking, so a broadcast mail's reward can't be claimed twice.
--
-- Before: "claimed" lived only in the client save (claimedMailIds). Editing local/cloud
-- state let a user re-claim coins, or claim every option of a "pick one" mail. Now each
-- claim is recorded in `mail_claims` with a (user_id, mail_id) primary key, and the
-- claim_mail() RPC is the only way to record one. The client grants the reward only when
-- the RPC reports a NEW claim, so replaying the claim is a no-op.
--
-- NOTE: coins/items still live in the client-authoritative save (a separate, broader
-- limitation). This change closes the easy mail-replay dupe and validates the chosen
-- item server-side; it doesn't make the whole economy server-authoritative.
--
-- Run in Supabase (SQL editor, service role). Safe to re-run.

create table if not exists public.mail_claims (
  user_id    uuid not null references auth.users (id) on delete cascade,
  mail_id    uuid not null references public.mail (id) on delete cascade,
  item_id    text,
  claimed_at timestamptz not null default now(),
  primary key (user_id, mail_id)
);

alter table public.mail_claims enable row level security;

-- A user can read their own claims (so the client can show the right claimed state,
-- even on a fresh device). There is deliberately NO insert/update/delete policy —
-- claims are written only through the claim_mail() SECURITY DEFINER RPC below.
drop policy if exists mail_claims_own_select on public.mail_claims;
create policy mail_claims_own_select on public.mail_claims
  for select using (auth.uid() = user_id);

-- Record a claim for the calling user. Validates the mail is live and (for reward mail)
-- that the chosen item is actually offered. Returns TRUE if this call recorded a new
-- claim (caller should grant the reward), FALSE if the mail is gone/expired or was
-- already claimed (caller should NOT grant again).
create or replace function public.claim_mail(p_mail_id uuid, p_item_id text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.mail;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Mail must exist, be active, and not expired.
  select * into m
  from public.mail
  where id = p_mail_id and active and (expires_at is null or expires_at > now());
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

  return found;  -- true only if a row was actually inserted
end;
$$;

revoke all on function public.claim_mail(uuid, text) from public;
grant execute on function public.claim_mail(uuid, text) to authenticated;
