-- Tighten profile reads. The original policy was `using (true)`, which let ANYONE
-- holding the app's public anon key — including unauthenticated requests — read every
-- profile (display name, description, birthday, stats) by friend code, i.e. scrape the
-- whole user base. Require a signed-in user instead. Friend cards / friends list still
-- work because those screens query while authenticated; only anonymous scraping is cut.
drop policy if exists "profiles_public_read" on public.profiles;

create policy "profiles_authed_read"
  on public.profiles
  for select
  to authenticated
  using (true);
