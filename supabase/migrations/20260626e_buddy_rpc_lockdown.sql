-- Lock down the study-buddy RPCs (defense-in-depth).
--
-- Postgres grants EXECUTE to PUBLIC by default. The buddy functions (20260622b) were
-- granted to `authenticated` but never revoked from PUBLIC, and buddy_report_count()
-- was never granted/revoked at all — so it was callable by anyone and leaked a
-- moderation signal (how close a given user is to the 3-report auto-exclude threshold).
--
-- Fix: revoke EXECUTE from PUBLIC on every buddy function, then re-grant only the ones
-- the client actually calls to `authenticated`. The internal-only helpers
-- (buddy_report_count, age_band_from_birthday) get NO grant, so they can't be called
-- directly from a client. They're still reachable from the matching RPC, which is
-- SECURITY DEFINER and runs as the function owner, so internal calls keep working.
--
-- Each statement is wrapped in its own DO block so a function that doesn't exist in
-- your project is skipped independently (no rollback of the others).
-- Run in Supabase (SQL editor, service role). Safe to re-run.

-- Internal-only helpers: revoke from everyone (callable only by SECURITY DEFINER owners).
do $$ begin revoke all on function public.buddy_report_count(uuid) from public, authenticated;
  exception when undefined_function then null; end $$;
do $$ begin revoke all on function public.age_band_from_birthday(text) from public, authenticated;
  exception when undefined_function then null; end $$;

-- Client-facing RPCs: PUBLIC off, authenticated on.
do $$ begin revoke all on function public.match_study_buddy() from public;
  grant execute on function public.match_study_buddy() to authenticated;
  exception when undefined_function then null; end $$;
do $$ begin revoke all on function public.buddy_status(uuid) from public;
  grant execute on function public.buddy_status(uuid) to authenticated;
  exception when undefined_function then null; end $$;
do $$ begin revoke all on function public.send_cheer(uuid, text) from public;
  grant execute on function public.send_cheer(uuid, text) to authenticated;
  exception when undefined_function then null; end $$;
do $$ begin revoke all on function public.leave_buddy(uuid) from public;
  grant execute on function public.leave_buddy(uuid) to authenticated;
  exception when undefined_function then null; end $$;
do $$ begin revoke all on function public.report_buddy(uuid, text, text) from public;
  grant execute on function public.report_buddy(uuid, text, text) to authenticated;
  exception when undefined_function then null; end $$;
do $$ begin revoke all on function public.buddy_become_friends(uuid) from public;
  grant execute on function public.buddy_become_friends(uuid) to authenticated;
  exception when undefined_function then null; end $$;
