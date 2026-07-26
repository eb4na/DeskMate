-- Mail "pick one" rewards.
--
-- Adds item_choices to broadcast mail (see 20260624d_mail.sql). When a mail has a
-- non-empty item_choices array, the player chooses exactly ONE of the listed shop
-- item ids to claim (the client renders a chooser). item_id (single fixed reward)
-- and coins still work alongside it.
--
-- NOTE: claiming an outfit only adds it to the player's wardrobe. Outfits are tied
-- to a companion, so a player still has to unlock that character (e.g. Miel, the
-- honey-bear chef, for the ZZZ pajamas) before they can actually wear it.

alter table public.mail add column if not exists item_choices text[];

-- ─────────────────────────────────────────────────────────────────────────────
-- THE TWO GIFTS (run these inserts in the Supabase SQL editor as the service role)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Welcome gift: claim any ONE of the three pajama sets, free.
insert into public.mail (title, body, item_choices)
values (
  'Welcome — pick a pajama set!',
  'A cozy welcome gift: choose any one of our three pajama outfits, on the house. (You''ll need to unlock its character before you can wear it.)',
  array['outfit_bun_dreams', 'outfit_tira_sleepover', 'outfit_honey_zzz']
);

-- 2) Thanks-for-downloading gift: 5,000 coins (separate mail).
insert into public.mail (title, body, coins)
values (
  'Thanks for downloading!',
  'Here are 5,000 coins to get you started. Happy studying!',
  5000
);

-- To retract either later:  update public.mail set active = false where id = '<uuid>';
