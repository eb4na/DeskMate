-- Track each user's highest "chef" (companion bond) level so the founder can see the
-- top level reached across the whole user base after the app's been out a while.
-- The app computes max(companion level) client-side and upserts it into this column
-- on the normal profile sync; no per-companion detail is stored, just the peak level.
--
-- Run in Supabase (SQL editor, service role). Safe to re-run. After running, reload the
-- API schema cache so the new column is writable:  notify pgrst, 'reload schema';

alter table public.profiles
  add column if not exists top_chef_level int not null default 1;

-- How to read it once players have been studying for a while:
--
--   -- the single highest chef level anyone has reached
--   select max(top_chef_level) as highest_chef_level from public.profiles;
--
--   -- how many players are at each level (engagement curve)
--   select top_chef_level, count(*) as players
--   from public.profiles
--   group by top_chef_level
--   order by top_chef_level desc;
