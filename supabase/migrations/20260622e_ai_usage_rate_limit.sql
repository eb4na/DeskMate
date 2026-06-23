-- Server-side per-user daily rate limit for the AI Edge Functions. The app enforces
-- ticket limits client-side only, so a modified/scripted client could call the AI
-- endpoints unlimited times → unbounded OpenAI cost. This atomic counter caps usage
-- on the server, per user, per kind ('chat' / 'image'), per day.

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, kind, day)
);

alter table public.ai_usage enable row level security;
-- No table policies: only the SECURITY DEFINER function below touches it.

-- Atomically increment today's counter for the calling user + kind, and return TRUE
-- when still within the cap (i.e. this call is allowed), FALSE once over it.
create or replace function public.bump_ai_usage(p_kind text, p_cap int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    return false;
  end if;
  insert into public.ai_usage (user_id, kind, day, count)
    values (auth.uid(), p_kind, current_date, 1)
  on conflict (user_id, kind, day)
    do update set count = ai_usage.count + 1
  returning count into v_count;
  return v_count <= p_cap;
end;
$$;

revoke all on function public.bump_ai_usage(text, int) from public;
grant execute on function public.bump_ai_usage(text, int) to authenticated;
