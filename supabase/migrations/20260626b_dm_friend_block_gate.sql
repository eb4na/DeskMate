-- Gate direct-message sends to actual friends, and honor blocks — server-side.
--
-- Before: dm_insert only checked `auth.uid() = from_user`. Combined with the old
-- blanket profiles read (now removed in 20260626), anyone could resolve any user_id
-- and DM a stranger, or DM someone who had blocked them (blocking was only a
-- client-side filter). Now a message is allowed only when an ACCEPTED friendship
-- exists between the two users AND neither has blocked the other.
--
-- The check lives in can_dm(), a SECURITY DEFINER function, on purpose: an RLS policy's
-- subqueries are themselves subject to the referenced tables' RLS, and `profiles`
-- (owner-only since 20260626) + `blocked_codes` (owner-only) would hide the OTHER
-- party's rows from the sender — silently defeating the block check. Running the check
-- as definer bypasses that so the block is actually enforced. It keys off the
-- authoritative user_ids, so a forged from_code/to_code can't slip past it.
--
-- Run in Supabase (SQL editor, service role). Safe to re-run.

create or replace function public.can_dm(p_from uuid, p_to uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    -- The caller must be one of the two parties — stops using this as an oracle to
    -- probe whether two other people are friends. (In the DM policy from_user is
    -- pinned to auth.uid(), so this is always true there.)
    (auth.uid() = p_from or auth.uid() = p_to)
    -- An accepted friendship must exist in either direction.
    and exists (
      select 1 from public.friend_requests fr
      where fr.status = 'accepted'
        and ((fr.from_user = p_from and fr.to_user = p_to)
          or (fr.from_user = p_to  and fr.to_user = p_from))
    )
    -- And neither party may have blocked the other (block list is keyed by friend_code,
    -- mapped back to user_ids via profiles).
    and not exists (
      select 1
      from public.blocked_codes b
      join public.profiles p on p.friend_code = b.blocked_code
      where (b.user_id = p_to   and p.user_id = p_from)
         or (b.user_id = p_from and p.user_id = p_to)
    );
$$;

revoke all on function public.can_dm(uuid, uuid) from public;
grant execute on function public.can_dm(uuid, uuid) to authenticated;

drop policy if exists "dm_insert" on public.direct_messages;
create policy "dm_insert" on public.direct_messages for insert
  with check (
    auth.uid() = from_user
    and public.can_dm(direct_messages.from_user, direct_messages.to_user)
  );
