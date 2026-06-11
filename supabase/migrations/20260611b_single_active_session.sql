-- Single active session per account. Each login claims `active_device_id`; the
-- previously-active device hears the change over Realtime and signs itself out.
-- Reuses the owner-only RLS already on user_state (Realtime honors the SELECT
-- policy, so a user only receives their own row's changes).

alter table public.user_state
  add column if not exists active_device_id text;

-- Let a device claim the session (insert its row) before any game-state blob
-- exists, without violating the `data not null` constraint.
alter table public.user_state
  alter column data set default '{}'::jsonb;

-- Broadcast row updates so the old device is kicked instantly. Guarded so
-- re-running the migration doesn't error if the table is already published.
do $$
begin
  alter publication supabase_realtime add table public.user_state;
exception
  when duplicate_object then null;
end $$;
