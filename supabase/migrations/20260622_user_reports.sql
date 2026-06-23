-- User reports for moderation. Any signed-in user can file a report against a
-- friend code (harassment / spam / inappropriate / etc). Users can insert reports
-- and read only their OWN; the founder reviews every report from the Supabase
-- dashboard (the service role bypasses RLS) — there is no in-app moderation view.

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reporter_code text,
  reported_code text not null,
  reason text not null,
  details text,
  created_at timestamptz default now()
);

create index if not exists user_reports_reported_idx on public.user_reports (reported_code);
create index if not exists user_reports_created_idx on public.user_reports (created_at desc);

alter table public.user_reports enable row level security;

-- Users may file reports…
create policy "file own reports"
  on public.user_reports
  for insert
  with check (auth.uid() = reporter_id);

-- …and read back only their own (the founder uses the dashboard/service role to see all).
create policy "read own reports"
  on public.user_reports
  for select
  using (auth.uid() = reporter_id);
