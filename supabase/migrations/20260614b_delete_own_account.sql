-- Self-serve account deletion.
--
-- SECURITY DEFINER so the function can remove the row from auth.users (which the
-- app's authenticated role can't do directly). It is scoped to auth.uid(), so a
-- caller can only ever delete THEMSELVES. Deleting the auth user cascades and
-- wipes the player's rows in profiles / user_state / friend_requests /
-- direct_messages / blocked_codes (all FK ON DELETE CASCADE on auth.users).
--
-- Called from the app via: supabase.rpc('delete_own_account').

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
