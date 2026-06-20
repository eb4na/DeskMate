-- Profile card colour — controls the accent on a user's shareable friend card
-- and the Plus frame border colour in friends' lists. Silently missing from the
-- initial schema, which caused the entire profile upsert to fail (column error),
-- so no display names or companion avatars were ever written to Supabase.
alter table public.profiles
  add column if not exists card_color text not null default 'pink';
