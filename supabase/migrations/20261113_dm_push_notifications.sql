-- Push notification for every incoming friend DM.
--
-- Each device registers its Expo push token in `push_tokens` (keyed by token, so a
-- device that switches accounts moves its row instead of notifying both). An
-- AFTER INSERT trigger on direct_messages posts to Expo's push API via pg_net —
-- no edge function needed. Runs after dm_mask_body_trg, so `body` is already
-- profanity-masked. Skipped when the recipient has blocked the sender. The push also
-- carries the app-icon badge (unread DMs from current friends); the app re-syncs
-- the badge itself whenever it is open (invite-listener).

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text,
  lang text not null default 'en',
  -- True when the registering build keeps the app-icon badge in sync itself. Older
  -- builds (1.1.4 b50) can't clear a badge, so their pushes carry none.
  supports_badge boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- Signed-in clients delete their own row on sign-out (RLS below limits them to it);
-- anon gets nothing. Explicit so it doesn't depend on the project's Data API defaults.
revoke all on public.push_tokens from anon;
grant select, insert, update, delete on public.push_tokens to authenticated;

-- A device may only register / refresh / remove its own token rows.
drop policy if exists "push_tokens_select" on public.push_tokens;
create policy "push_tokens_select" on public.push_tokens for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "push_tokens_insert" on public.push_tokens;
create policy "push_tokens_insert" on public.push_tokens for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "push_tokens_update" on public.push_tokens;
create policy "push_tokens_update" on public.push_tokens for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "push_tokens_delete" on public.push_tokens;
create policy "push_tokens_delete" on public.push_tokens for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Claim a token for the signed-in user. A token row can belong to a previous
-- account on the same device, which RLS would hide from an upsert — so this
-- security-definer RPC moves it to the caller.
create or replace function public.register_push_token(p_token text, p_platform text, p_lang text, p_badge boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_token is null or length(p_token) = 0 or length(p_token) > 256 then
    return;
  end if;
  insert into public.push_tokens (token, user_id, platform, lang, supports_badge, updated_at)
  values (p_token, auth.uid(), left(p_platform, 16), coalesce(left(p_lang, 16), 'en'), coalesce(p_badge, false), now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        lang = excluded.lang,
        supports_badge = excluded.supports_badge,
        updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text, text, boolean) from public, anon;
grant execute on function public.register_push_token(text, text, text, boolean) to authenticated;

create or replace function public.dm_send_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  msgs jsonb;
  unread int;
begin
  -- Recipient blocked the sender: no notification.
  if exists (
    select 1 from public.blocked_codes b
    where b.user_id = new.to_user and upper(b.blocked_code) = upper(new.from_code)
  ) then
    return new;
  end if;

  select nullif(trim(p.display_name), '') into sender_name
  from public.profiles p where p.user_id = new.from_user;
  sender_name := coalesce(sender_name, new.from_code);

  -- App-icon badge = the recipient's unread DMs from CURRENT friends who aren't
  -- blocked (same rule as the in-app red dot; an ex-friend's unread rows can never
  -- be opened, so counting them would pin the badge forever). Includes this row.
  select least(count(*), 99) into unread
  from public.direct_messages m
  where m.to_user = new.to_user
    and m.read_at is null
    and exists (
      select 1 from public.friend_requests fr
      where fr.status = 'accepted'
        and ((fr.from_user = m.from_user and fr.to_user = m.to_user)
          or (fr.from_user = m.to_user and fr.to_user = m.from_user))
    )
    and not exists (
      select 1 from public.blocked_codes b
      where b.user_id = m.to_user and upper(b.blocked_code) = upper(m.from_code)
    );

  select jsonb_agg(jsonb_build_object(
    'to', t.token,
    'title', sender_name,
    'body', case
      when new.kind = 'invite' then case t.lang
        when 'zh' then '邀请你一起玩'
        when 'zh-Hant' then '邀請你一起玩'
        when 'ja' then '招待が届きました'
        when 'ko' then '초대를 보냈어요'
        when 'es' then 'Te envió una invitación'
        when 'fr' then 'T''a envoyé une invitation'
        else 'Sent you an invite' end
      when new.kind = 'emote' then case t.lang
        when 'zh' then '发送了一个贴纸'
        when 'zh-Hant' then '傳送了一個貼圖'
        when 'ja' then 'スタンプを送りました'
        when 'ko' then '스티커를 보냈어요'
        when 'es' then 'Envió un sticker'
        when 'fr' then 'A envoyé un sticker'
        else 'Sent a sticker' end
      else left(coalesce(new.body, ''), 180) end,
    'sound', 'default',
    'channelId', 'direct-messages',
    'data', jsonb_build_object('kind', 'dm', 'fromCode', upper(new.from_code))
  ) || case when t.supports_badge then jsonb_build_object('badge', greatest(unread, 1)) else '{}'::jsonb end)
  into msgs
  from public.push_tokens t
  where t.user_id = new.to_user;

  if msgs is null then
    return new;
  end if;

  -- Async: never blocks or fails the message insert.
  begin
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := msgs,
      headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb
    );
  exception when others then
    null;
  end;
  return new;
end;
$$;

revoke all on function public.dm_send_push() from public, anon, authenticated;

drop trigger if exists dm_send_push_trg on public.direct_messages;
create trigger dm_send_push_trg
  after insert on public.direct_messages
  for each row execute function public.dm_send_push();
