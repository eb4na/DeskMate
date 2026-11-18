-- Free ("comp") Plus gifted by the founder, independent of RevenueCat.
--
-- The app's cold-launch Plus reconcile (src/app/_layout.tsx) turns Plus OFF when
-- RevenueCat reports no entitlement, so hand-editing user_state.data can't gift Plus
-- — the next launch revokes it. A row here tells the app "this account has Plus
-- regardless of the store": it grants Plus on launch and the reconcile never revokes
-- it.
--
-- Grant (lifetime):  insert into public.plus_comps (user_id, note)
--                    values ('<uuid>', '<who / why>');
-- Grant (dated):     ... (user_id, until, note) values ('<uuid>', '2027-06-01', '...');
-- Revoke:            delete from public.plus_comps where user_id = '<uuid>';
-- Look up a user by friend code:
--                    select user_id from public.profiles where upper(friend_code) = '<CODE>';

create table if not exists public.plus_comps (
  -- Cascades with account deletion (delete_own_account deletes the auth user).
  user_id    uuid primary key references auth.users (id) on delete cascade,
  -- null = lifetime.
  until      timestamptz,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.plus_comps enable row level security;

-- A player may read ONLY their own row. There are deliberately no insert / update /
-- delete policies: grants are made by the founder through SQL, never by the client.
drop policy if exists "plus_comps_select_own" on public.plus_comps;
create policy "plus_comps_select_own"
  on public.plus_comps
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.plus_comps from anon;
revoke insert, update, delete on public.plus_comps from authenticated;
grant select on public.plus_comps to authenticated;
