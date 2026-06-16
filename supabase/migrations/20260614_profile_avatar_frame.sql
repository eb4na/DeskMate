-- Plus avatar frame shown around a user's avatar in friends' lists/cards.
-- Synced through the public profile so friends see the frame the user chose.
alter table public.profiles
  add column if not exists avatar_frame text not null default 'none';
